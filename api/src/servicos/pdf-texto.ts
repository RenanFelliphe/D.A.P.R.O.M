import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { invalido } from "../http/erros";

/**
 * Texto de um PDF, página a página e linha a linha, para a leitura da OS impressa pelo SAP (`importacao-pdf.ts`). Quem lê é
 * o pdf.js (o leitor de PDF do Firefox): os pedaços de texto na mesma altura formam uma linha, da esquerda para a direita;
 * entre dois pedaços entra um espaço quando há um vão pequeno e uma tabulação quando o vão é de outra célula da tabela.
 * Um PDF digitalizado (só imagem) não tem texto: as páginas voltam sem linhas.
 */

export interface PaginaDeTexto {
  /** A partir de 1. */
  numero: number;
  linhas: string[];
}

export interface Pedaco {
  texto: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Vão, em proporção da altura da letra, a partir do qual dois pedaços da mesma linha são células diferentes. */
const VAO_DE_CELULA = 1.2;
/** Vão mínimo para separar duas palavras com espaço. */
const VAO_DE_PALAVRA = 0.12;
export const LIMITE_DE_PAGINAS = 60;

/** Uma linha montada: o texto e onde ela está (o `y` do primeiro pedaço e a altura da letra, na unidade dos pedaços). */
export interface LinhaMontada {
  texto: string;
  y: number;
  altura: number;
}

/**
 * Agrupa pedaços de texto em linhas, de cima para baixo. É o mesmo agrupamento para o texto do PDF e para as palavras do OCR
 * (`ocr.ts`): `y` cresce para cima, como no PDF.
 */
export function montarLinhas(pedacos: Pedaco[]): LinhaMontada[] {
  // De cima para baixo (no PDF o y cresce para cima) e da esquerda para a direita.
  const ordenados = pedacos.filter((p) => p.texto.trim() !== "").sort((a, b) => b.y - a.y || a.x - b.x);
  const linhas: Pedaco[][] = [];
  for (const p of ordenados) {
    const atual = linhas[linhas.length - 1];
    const referencia = atual?.[0];
    // Mesma linha: a diferença de altura é menor que metade da letra.
    if (atual && referencia && Math.abs(referencia.y - p.y) <= Math.max(1.5, Math.min(referencia.altura, p.altura) * 0.5)) atual.push(p);
    else linhas.push([p]);
  }
  return linhas.map((linha) => {
    const { y, altura: alturaDaLinha } = linha[0]!;
    linha.sort((a, b) => a.x - b.x);
    let texto = "";
    let fim = Number.NEGATIVE_INFINITY;
    for (const p of linha) {
      const vao = p.x - fim;
      const altura = Math.max(p.altura, 1);
      if (texto !== "") {
        if (vao > altura * VAO_DE_CELULA) texto = `${texto.trimEnd()}\t`;
        else if (vao > altura * VAO_DE_PALAVRA && !texto.endsWith(" ") && !p.texto.startsWith(" ")) texto += " ";
      }
      texto += p.texto;
      fim = Math.max(fim, p.x + p.largura);
    }
    const limpo = texto.replace(/[  ]+/g, " ").replace(/ *\t */g, "\t").trim();
    return { texto: limpo, y, altura: alturaDaLinha };
  });
}

const linhasDaPagina = (pedacos: Pedaco[]): string[] => montarLinhas(pedacos).map((l) => l.texto);

/** Lê o texto de cada página. Arquivo que não é PDF (ou está protegido por senha): `422`. */
export async function lerTextoDoPdf(bytes: Uint8Array): Promise<PaginaDeTexto[]> {
  // O pdf.js toma posse do buffer: vai uma cópia.
  const tarefa = getDocument({ data: new Uint8Array(bytes), disableFontFace: true, useSystemFonts: false, verbosity: 0 });
  let documento;
  try {
    documento = await tarefa.promise;
  } catch (erro) {
    await tarefa.destroy().catch(() => undefined);
    const nome = erro instanceof Error ? erro.name : "";
    if (nome === "PasswordException") throw invalido("pdf_protegido", "O PDF está protegido por senha");
    throw invalido("pdf_invalido", "O arquivo não é um PDF válido");
  }
  try {
    if (documento.numPages > LIMITE_DE_PAGINAS) throw invalido("pdf_grande", `O PDF tem mais de ${LIMITE_DE_PAGINAS} páginas`);
    const paginas: PaginaDeTexto[] = [];
    for (let numero = 1; numero <= documento.numPages; numero++) {
      const pagina = await documento.getPage(numero);
      const conteudo = await pagina.getTextContent();
      const pedacos: Pedaco[] = [];
      for (const item of conteudo.items) {
        if (!("str" in item)) continue;
        const [a, b, , d, x, y] = item.transform as number[];
        pedacos.push({ texto: item.str, x: x!, y: y!, largura: item.width, altura: item.height || Math.hypot(a!, b!) || Math.abs(d!) || 10 });
      }
      paginas.push({ numero, linhas: linhasDaPagina(pedacos) });
      pagina.cleanup();
    }
    return paginas;
  } finally {
    await tarefa.destroy();
  }
}
