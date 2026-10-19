import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { invalido } from "../http/erros";
import { LIMITE_DE_PAGINAS } from "./pdf-texto";

/**
 * As folhas de um PDF como imagem, para a Digitalização: o PDF escaneado (só imagem) não tem texto para o `pdf-texto.ts`, então
 * cada folha é desenhada pelo pdf.js num canvas (o `@napi-rs/canvas`, nativo) e sai em PNG, para o OCR, e em JPEG, que é o que
 * fica guardado e o que a IA recebe. Uma folha de cada vez: um PDF de 60 folhas não cabe inteiro na memória como imagem.
 */

export interface FolhaRenderizada {
  /** A partir de 1. */
  numero: number;
  largura: number;
  altura: number;
  png: Uint8Array;
  jpeg: Uint8Array;
}

/** Largura da folha desenhada, em pixels: uma A4 a cerca de 240 dpi, o que o OCR e a letra miúda do manuscrito pedem. */
const LARGURA_ALVO_PX = 2000;
const QUALIDADE_DO_JPEG = 82;

export interface FolhasDoPdf {
  total: number;
  renderizar(numero: number): Promise<FolhaRenderizada>;
  fechar(): Promise<void>;
}

/** Abre o PDF para desenhar as folhas. Arquivo que não é PDF, com senha ou com mais de `LIMITE_DE_PAGINAS` folhas: `422`. */
export async function abrirFolhas(bytes: Uint8Array): Promise<FolhasDoPdf> {
  // O pdf.js toma posse do buffer: vai uma cópia.
  const tarefa = getDocument({ data: new Uint8Array(bytes), disableFontFace: true, useSystemFonts: false, verbosity: 0 });
  let documento;
  try {
    documento = await tarefa.promise;
  } catch (erro) {
    await tarefa.destroy().catch(() => undefined);
    if (erro instanceof Error && erro.name === "PasswordException") throw invalido("pdf_protegido", "O PDF está protegido por senha");
    throw invalido("pdf_invalido", "O arquivo não é um PDF válido");
  }
  if (documento.numPages > LIMITE_DE_PAGINAS) {
    await tarefa.destroy();
    throw invalido("pdf_grande", `O PDF tem mais de ${LIMITE_DE_PAGINAS} páginas`);
  }
  return {
    total: documento.numPages,
    async renderizar(numero) {
      const pagina = await documento.getPage(numero);
      try {
        const base = pagina.getViewport({ scale: 1 });
        const vista = pagina.getViewport({ scale: LARGURA_ALVO_PX / base.width });
        const canvas = createCanvas(Math.ceil(vista.width), Math.ceil(vista.height));
        const context = canvas.getContext("2d");
        // Fundo branco: a folha escaneada pode ter transparência, que o JPEG tornaria preta.
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        // O canvas do `@napi-rs/canvas` serve ao pdf.js, que o tipa como o do navegador.
        await pagina.render({ canvasContext: context as unknown as CanvasRenderingContext2D, viewport: vista, canvas: canvas as unknown as HTMLCanvasElement }).promise;
        return { numero, largura: canvas.width, altura: canvas.height, png: canvas.toBuffer("image/png"), jpeg: canvas.toBuffer("image/jpeg", QUALIDADE_DO_JPEG) };
      } finally {
        pagina.cleanup();
      }
    },
    fechar: () => tarefa.destroy(),
  };
}
