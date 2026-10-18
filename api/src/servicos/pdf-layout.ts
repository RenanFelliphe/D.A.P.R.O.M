import PDFDocument from "pdfkit";

/**
 * Primitivas de desenho do PDF: caixas com rótulo, tabelas de altura variável, imagens que não derrubam a geração.
 *
 * Cada página do documento (a APR e a OS) é desenhada numa escala: como a planilha da APR em papel, que sai "ajustada à
 * página", o conteúdo que não cabe numa folha A4 é reduzido por inteiro (`doc.scale` a partir do canto da margem). As
 * medidas daqui são da folha lógica, que cresce na mesma proporção em que a escala diminui (`Cursor.largura` e
 * `Cursor.limite`).
 */
export type Doc = InstanceType<typeof PDFDocument>;

export const MARGEM = 30;
export const LARGURA_UTIL = 595.28 - 2 * MARGEM;
/** Limite inferior do conteúdo na folha; abaixo dele ficam só os rodapés. */
export const LIMITE_Y = 792;
/**
 * Altura máxima de qualquer texto: com `height`, o pdfkit não abre página sozinho quando o texto passa da margem da folha
 * (na escala reduzida, a folha lógica é mais alta que a física). Quem abre página é só `garantirEspaco`.
 */
const SEM_LIMITE = 1e6;

export const COR = { borda: "#555555", cinza: "#e6e6e6", rotulo: "#666666", reprovado: "#f8d7d7", alerta: "#fff1c2", texto: "#111111", link: "#1a4fa0", saude: "#f9c9c9" };

export interface Cursor {
  doc: Doc;
  y: number;
  /** Escala da página: 1 é o tamanho natural. */
  escala: number;
  /** Largura útil e limite inferior na folha lógica (na escala 1, `LARGURA_UTIL` e `LIMITE_Y`). */
  largura: number;
  limite: number;
  /** Quantas vezes o conteúdo passou do limite e abriu outra folha. */
  quebras: number;
  /** Medição (prova da escala): não desenha as imagens. */
  medindo: boolean;
}

export function novoCursor(doc: Doc, opcoes: { escala?: number; medindo?: boolean } = {}): Cursor {
  const escala = opcoes.escala ?? 1;
  return {
    doc,
    y: MARGEM,
    escala,
    largura: LARGURA_UTIL / escala,
    limite: MARGEM + (LIMITE_Y - MARGEM) / escala,
    quebras: 0,
    medindo: opcoes.medindo ?? false,
  };
}

/** Passa a desenhar na escala do cursor (sempre fechado por `fecharEscala`, antes do rodapé ou de outra folha). */
export function abrirEscala(c: Cursor) {
  c.doc.save();
  if (c.escala !== 1) c.doc.scale(c.escala, c.escala, { origin: [MARGEM, MARGEM] });
}

export function fecharEscala(c: Cursor) {
  c.doc.restore();
}

/** Abre uma folha nova se não couber `altura` na atual (só acontece quando nem a menor escala basta). */
export function garantirEspaco(c: Cursor, altura: number) {
  if (c.y + altura > c.limite) {
    c.quebras++;
    fecharEscala(c);
    c.doc.addPage();
    abrirEscala(c);
    c.y = MARGEM;
  }
}

/** `doc.text` sem a quebra de página automática do pdfkit. */
export function escrever(doc: Doc, texto: string, x: number, y: number, opcoes: PDFKit.Mixins.TextOptions = {}) {
  doc.text(texto, x, y, { ...opcoes, height: SEM_LIMITE });
}

export function alturaTexto(doc: Doc, texto: string, largura: number, tamanho: number, negrito = false): number {
  doc.font(negrito ? "Helvetica-Bold" : "Helvetica").fontSize(tamanho);
  return doc.heightOfString(texto || " ", { width: largura });
}

export interface Celula {
  /** Fração da largura útil (as frações de uma linha somam 1). */
  fracao: number;
  rotulo?: string;
  valor?: string;
  negrito?: boolean;
  fundo?: string;
}

/** Linha de caixas com rótulo pequeno em cima e valor embaixo; todas ficam com a altura da maior. */
export function linhaDeCelulas(c: Cursor, celulas: Celula[], tamanho = 8): void {
  const { doc } = c;
  const larguras = celulas.map((x) => x.fracao * c.largura);
  const altura = Math.max(
    ...celulas.map((x, i) => (x.rotulo ? 9 : 2) + alturaTexto(doc, x.valor ?? "", larguras[i]! - 6, tamanho, x.negrito) + 4),
    18,
  );
  garantirEspaco(c, altura);
  let x = MARGEM;
  celulas.forEach((cel, i) => {
    const l = larguras[i]!;
    if (cel.fundo) doc.rect(x, c.y, l, altura).fill(cel.fundo);
    doc.lineWidth(0.5).strokeColor(COR.borda).rect(x, c.y, l, altura).stroke();
    let ty = c.y + 2;
    if (cel.rotulo) {
      doc.font("Helvetica").fontSize(5.5).fillColor(COR.rotulo);
      escrever(doc, cel.rotulo, x + 3, ty, { width: l - 6, lineBreak: false });
      ty += 8;
    }
    doc
      .font(cel.negrito ? "Helvetica-Bold" : "Helvetica")
      .fontSize(tamanho)
      .fillColor(COR.texto);
    escrever(doc, cel.valor ?? "", x + 3, ty, { width: l - 6 });
    x += l;
  });
  c.y += altura;
}

/** Faixa de título de seção (fundo cinza, texto em negrito). */
export function faixa(c: Cursor, texto: string, tamanho = 8.5) {
  garantirEspaco(c, 16);
  c.doc.rect(MARGEM, c.y, c.largura, 14).fill(COR.cinza);
  c.doc.lineWidth(0.5).strokeColor(COR.borda).rect(MARGEM, c.y, c.largura, 14).stroke();
  c.doc.font("Helvetica-Bold").fontSize(tamanho).fillColor(COR.texto);
  escrever(c.doc, texto, MARGEM + 4, c.y + 3, { width: c.largura - 8, lineBreak: false });
  c.y += 14;
}

export interface Coluna {
  largura: number;
  texto: string;
  negrito?: boolean;
  /** Torna o texto da célula um link clicável (azul e sublinhado), como o ponto no mapa do relatório da execução. */
  link?: string;
}

/**
 * Linha de tabela com colunas de largura fixa (em pontos) e altura que acompanha o texto mais longo. `respiro` é o espaço
 * vertical somado ao texto (metade em cima) e `minimo`, a altura mínima da linha.
 */
export function linhaDeTabela(c: Cursor, colunas: Coluna[], opcoes: { fundo?: string; tamanho?: number; respiro?: number; minimo?: number } = {}) {
  const { doc } = c;
  const tamanho = opcoes.tamanho ?? 7;
  const respiro = opcoes.respiro ?? 5;
  const altura = Math.max(...colunas.map((x) => alturaTexto(doc, x.texto, x.largura - 6, tamanho, x.negrito) + respiro), opcoes.minimo ?? 12);
  garantirEspaco(c, altura);
  let x = MARGEM;
  for (const col of colunas) {
    if (opcoes.fundo) doc.rect(x, c.y, col.largura, altura).fill(opcoes.fundo);
    doc.lineWidth(0.4).strokeColor(COR.borda).rect(x, c.y, col.largura, altura).stroke();
    doc
      .font(col.negrito ? "Helvetica-Bold" : "Helvetica")
      .fontSize(tamanho)
      .fillColor(col.link ? COR.link : COR.texto);
    escrever(doc, col.texto, x + 3, c.y + respiro / 2, { width: col.largura - 6, ...(col.link ? { link: col.link, underline: true } : {}) });
    x += col.largura;
  }
  c.y += altura;
}

const eJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const ePng = (b: Uint8Array) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

/**
 * Desenha a imagem dentro da caixa, ajustada e centralizada. Imagem ausente ou em formato que o pdfkit não lê
 * (só entende JPEG e PNG) vira o texto "[imagem indisponível]": uma foto ruim não pode impedir o PDF da OS. Na medição a
 * imagem não é desenhada (o espaço dela é a caixa).
 */
export function desenharImagem(c: Cursor, bytes: Uint8Array | null | undefined, x: number, y: number, largura: number, altura: number) {
  if (c.medindo) return;
  const { doc } = c;
  let desenhou = false;
  if (bytes && (eJpeg(bytes) || ePng(bytes))) {
    try {
      doc.image(Buffer.from(bytes), x, y, { fit: [largura, altura], align: "center", valign: "center" });
      desenhou = true;
    } catch {
      desenhou = false;
    }
  }
  if (!desenhou) {
    doc.font("Helvetica-Oblique").fontSize(6.5).fillColor(COR.rotulo);
    escrever(doc, "[imagem indisponível]", x, y + altura / 2 - 4, { width: largura, align: "center", lineBreak: false });
  }
}

/** Texto solto no rodapé da folha atual, fora da escala da página. */
export function rodape(doc: Doc, texto: string) {
  doc.font("Helvetica").fontSize(6.5).fillColor(COR.rotulo);
  escrever(doc, texto, MARGEM, 800, { width: LARGURA_UTIL, align: "center", lineBreak: false });
}
