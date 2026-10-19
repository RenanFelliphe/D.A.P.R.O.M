import { createCanvas, loadImage } from "@napi-rs/canvas";
import PDFDocument from "pdfkit";
import { invalido } from "../http/erros";

/**
 * O PDF das folhas de uma OS digitalizada: uma página A4 por folha, com a imagem inteira (as assinaturas e as rubricas ficam
 * só nela). É o "PDF da OS" das OS de histórico (`os.pdf_path`): não é a folha que o SYNQ OS gera, é o que foi escaneado.
 */
export async function montarPdfDasFolhas(jpegs: Uint8Array[], titulo: string): Promise<Uint8Array> {
  const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false, info: { Title: titulo, Author: "SYNQ OS" } });
  const pedacos: Buffer[] = [];
  doc.on("data", (p: Buffer) => pedacos.push(p));
  const pronto = new Promise<void>((resolver, rejeitar) => {
    doc.on("end", resolver);
    doc.on("error", rejeitar);
  });
  for (const jpeg of jpegs) {
    doc.addPage({ size: "A4", margin: 0 });
    doc.image(Buffer.from(jpeg), 0, 0, { fit: [doc.page.width, doc.page.height], align: "center", valign: "center" });
  }
  doc.end();
  await pronto;
  return new Uint8Array(Buffer.concat(pedacos));
}

/** Fotos de folhas avulsas por envio: a câmera é para 1 ou 2 folhas (um acervo vai pelo PDF escaneado), com folga para uma OS de 4 folhas e a APR. */
export const MAX_FOTOS_POR_ENVIO = 8;
/** Maior lado, em pixels, da foto guardada: a foto de celular passa de 4.000 px, e o OCR e a letra de mão não ganham com isso. */
const LADO_MAXIMO_DA_FOTO_PX = 2800;
const QUALIDADE_DA_FOTO = 85;
/** Largura de uma página A4, em pontos: a página da foto tem essa largura e a altura que a foto pedir (a folha fotografada de lado não encolhe). */
const LARGURA_A4_PT = 595.28;

const COMECO_JPEG = [0xff, 0xd8, 0xff];
const COMECO_PNG = [0x89, 0x50, 0x4e, 0x47];
/** O arquivo é um JPEG ou um PNG pelos primeiros bytes (o nome e o tipo informado pelo navegador não valem). */
export function ehFotoAceita(bytes: Uint8Array): boolean {
  const comeca = (assinatura: number[]) => assinatura.every((b, i) => bytes[i] === b);
  return comeca(COMECO_JPEG) || comeca(COMECO_PNG);
}

/** A foto em JPEG sobre fundo branco (o PNG com transparência não vira preto), reduzida ao `LADO_MAXIMO_DA_FOTO_PX`. */
async function normalizarFoto(bytes: Uint8Array): Promise<{ jpeg: Uint8Array; largura: number; altura: number }> {
  let imagem;
  try {
    imagem = await loadImage(Buffer.from(bytes));
  } catch {
    throw invalido("foto_invalida", "Uma das fotos não pôde ser aberta: envie imagens JPEG ou PNG");
  }
  const escala = Math.min(1, LADO_MAXIMO_DA_FOTO_PX / Math.max(imagem.width, imagem.height));
  const largura = Math.max(1, Math.round(imagem.width * escala));
  const altura = Math.max(1, Math.round(imagem.height * escala));
  const canvas = createCanvas(largura, altura);
  const contexto = canvas.getContext("2d");
  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, largura, altura);
  contexto.drawImage(imagem, 0, 0, largura, altura);
  return { jpeg: canvas.toBuffer("image/jpeg", QUALIDADE_DA_FOTO), largura, altura };
}

/**
 * As fotos de folhas avulsas (câmera) como um PDF, uma página por foto, na ordem em que vieram: a Digitalização lê esse PDF pelo
 * mesmo caminho do PDF escaneado. A página tem a proporção da foto, para a folha fotografada de lado não encolher.
 */
export async function montarPdfDeFotos(fotos: Uint8Array[], titulo: string): Promise<Uint8Array> {
  const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false, info: { Title: titulo, Author: "SYNQ OS" } });
  const pedacos: Buffer[] = [];
  doc.on("data", (p: Buffer) => pedacos.push(p));
  const pronto = new Promise<void>((resolver, rejeitar) => {
    doc.on("end", resolver);
    doc.on("error", rejeitar);
  });
  try {
    for (const foto of fotos) {
      const { jpeg, largura, altura } = await normalizarFoto(foto);
      const alturaPt = (LARGURA_A4_PT * altura) / largura;
      doc.addPage({ size: [LARGURA_A4_PT, alturaPt], margin: 0 });
      doc.image(Buffer.from(jpeg), 0, 0, { width: LARGURA_A4_PT, height: alturaPt });
    }
  } catch (erro) {
    doc.end();
    await pronto.catch(() => undefined);
    throw erro;
  }
  doc.end();
  await pronto;
  return new Uint8Array(Buffer.concat(pedacos));
}
