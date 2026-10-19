import PDFDocument from "pdfkit";

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
