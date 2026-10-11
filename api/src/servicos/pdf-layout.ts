import PDFDocument from "pdfkit";

/** Primitivas de desenho do PDF: caixas com rótulo, tabelas de altura variável, imagens que não derrubam a geração. */
export type Doc = InstanceType<typeof PDFDocument>;

export const MARGEM = 30;
export const LARGURA_UTIL = 595.28 - 2 * MARGEM;
/** Limite inferior do conteúdo; abaixo dele ficam só os rodapés. */
export const LIMITE_Y = 792;

export const COR = { borda: "#555555", cinza: "#e6e6e6", rotulo: "#666666", reprovado: "#f8d7d7", alerta: "#fff1c2", texto: "#111111" };

export interface Cursor {
  doc: Doc;
  y: number;
}

export function novoCursor(doc: Doc): Cursor {
  return { doc, y: MARGEM };
}

/** Abre uma página nova se não couber `altura` na atual. */
export function garantirEspaco(c: Cursor, altura: number) {
  if (c.y + altura > LIMITE_Y) {
    c.doc.addPage();
    c.y = MARGEM;
  }
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
  const larguras = celulas.map((x) => x.fracao * LARGURA_UTIL);
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
      doc.font("Helvetica").fontSize(5.5).fillColor(COR.rotulo).text(cel.rotulo, x + 3, ty, { width: l - 6, lineBreak: false });
      ty += 8;
    }
    doc
      .font(cel.negrito ? "Helvetica-Bold" : "Helvetica")
      .fontSize(tamanho)
      .fillColor(COR.texto)
      .text(cel.valor ?? "", x + 3, ty, { width: l - 6 });
    x += l;
  });
  c.y += altura;
}

/** Faixa de título de seção (fundo cinza, texto em negrito). */
export function faixa(c: Cursor, texto: string, tamanho = 8.5) {
  garantirEspaco(c, 16);
  c.doc.rect(MARGEM, c.y, LARGURA_UTIL, 14).fill(COR.cinza);
  c.doc.lineWidth(0.5).strokeColor(COR.borda).rect(MARGEM, c.y, LARGURA_UTIL, 14).stroke();
  c.doc.font("Helvetica-Bold").fontSize(tamanho).fillColor(COR.texto).text(texto, MARGEM + 4, c.y + 3, { width: LARGURA_UTIL - 8, lineBreak: false });
  c.y += 14;
}

export interface Coluna {
  largura: number;
  texto: string;
  negrito?: boolean;
}

/** Linha de tabela com colunas de largura fixa (em pontos) e altura que acompanha o texto mais longo. */
export function linhaDeTabela(c: Cursor, colunas: Coluna[], opcoes: { fundo?: string; tamanho?: number } = {}) {
  const { doc } = c;
  const tamanho = opcoes.tamanho ?? 7;
  const altura = Math.max(...colunas.map((x) => alturaTexto(doc, x.texto, x.largura - 6, tamanho, x.negrito) + 5), 12);
  garantirEspaco(c, altura);
  let x = MARGEM;
  for (const col of colunas) {
    if (opcoes.fundo) doc.rect(x, c.y, col.largura, altura).fill(opcoes.fundo);
    doc.lineWidth(0.4).strokeColor(COR.borda).rect(x, c.y, col.largura, altura).stroke();
    doc
      .font(col.negrito ? "Helvetica-Bold" : "Helvetica")
      .fontSize(tamanho)
      .fillColor(COR.texto)
      .text(col.texto, x + 3, c.y + 2.5, { width: col.largura - 6 });
    x += col.largura;
  }
  c.y += altura;
}

const eJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const ePng = (b: Uint8Array) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

/**
 * Desenha a imagem dentro da caixa, ajustada e centralizada. Imagem ausente ou em formato que o pdfkit não lê
 * (só entende JPEG e PNG) vira o texto "[imagem indisponível]": uma foto ruim não pode impedir o PDF da OS.
 */
export function desenharImagem(doc: Doc, bytes: Uint8Array | null | undefined, x: number, y: number, largura: number, altura: number) {
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
    doc
      .font("Helvetica-Oblique")
      .fontSize(6.5)
      .fillColor(COR.rotulo)
      .text("[imagem indisponível]", x, y + altura / 2 - 4, { width: largura, align: "center", lineBreak: false });
  }
}

/** Texto solto no rodapé da página atual. */
export function rodape(doc: Doc, texto: string) {
  doc.font("Helvetica").fontSize(6.5).fillColor(COR.rotulo).text(texto, MARGEM, 800, { width: LARGURA_UTIL, align: "center", lineBreak: false });
}
