import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createWorker, type Worker } from "tesseract.js";
import { montarLinhas, type LinhaMontada, type PaginaDeTexto, type Pedaco } from "./pdf-texto";

/**
 * OCR local da Digitalização (Tesseract, em português, dentro da própria `api`): lê a parte impressa da folha escaneada e devolve
 * as palavras com a posição, no mesmo formato que o `pdf-texto.ts` monta a partir do texto de um PDF. Assim a leitura pelos
 * rótulos de `importacao-pdf.ts` serve sem mudança. O que o OCR não lê (a letra de mão) é da IA de visão, ou da pessoa.
 */

/** A folha lida: as linhas como o PDF com texto as daria, mais onde cada uma está na imagem e a nitidez média do que foi lido. */
export interface FolhaLidaPorOcr extends PaginaDeTexto {
  /** As mesmas linhas com a posição (`y` cresce para cima, em pixels da imagem). */
  posicoes: LinhaMontada[];
  largura: number;
  altura: number;
  /** Confiança média das palavras lidas, de 0 a 100; 0 quando nada foi lido. */
  confianca: number;
}

export interface MotorOcr {
  /** Lê uma folha (PNG ou JPEG) de `largura` × `altura` pixels. `numero` é o número da folha no PDF. */
  lerFolha(imagem: Uint8Array, numero: number, largura: number, altura: number): Promise<FolhaLidaPorOcr>;
  encerrar(): Promise<void>;
}

/** A pasta do modelo `por` (o "best" em inteiros, de 1,4 MB) que vem no pacote `@tesseract.js-data/por`: nada é baixado em tempo de execução. */
function pastaDoModelo(): string {
  const pacote = createRequire(import.meta.url).resolve("@tesseract.js-data/por/package.json");
  return join(dirname(pacote), "4.0.0_best_int");
}

/** Palavras com a confiança abaixo disto são ruído (borda de tabela, pontinhos do scanner) e ficam de fora. */
const CONFIANCA_MINIMA = 30;

export class MotorOcrTesseract implements MotorOcr {
  private trabalhador: Promise<Worker> | null = null;

  private obter(): Promise<Worker> {
    this.trabalhador ??= createWorker("por", 1, { langPath: pastaDoModelo(), gzip: true, cacheMethod: "none" });
    return this.trabalhador;
  }

  async lerFolha(imagem: Uint8Array, numero: number, largura: number, altura: number): Promise<FolhaLidaPorOcr> {
    const trabalhador = await this.obter();
    const { data } = await trabalhador.recognize(Buffer.from(imagem), {}, { blocks: true });
    const pedacos: Pedaco[] = [];
    let soma = 0;
    for (const bloco of data.blocks ?? []) {
      for (const paragrafo of bloco.paragraphs) {
        for (const linha of paragrafo.lines) {
          for (const palavra of linha.words) {
            const texto = palavra.text.trim();
            if (!texto || palavra.confidence < CONFIANCA_MINIMA) continue;
            const { x0, y0, x1, y1 } = palavra.bbox;
            // O OCR conta o y de cima para baixo; as linhas do PDF, de baixo para cima.
            pedacos.push({ texto, x: x0, y: altura - y1, largura: x1 - x0, altura: y1 - y0 });
            soma += palavra.confidence;
          }
        }
      }
    }
    const posicoes = montarLinhas(pedacos);
    return { numero, linhas: posicoes.map((l) => l.texto), posicoes, largura, altura, confianca: pedacos.length ? soma / pedacos.length : 0 };
  }

  async encerrar(): Promise<void> {
    const t = this.trabalhador;
    this.trabalhador = null;
    if (t) await (await t).terminate();
  }
}
