import PDFDocument from "pdfkit";
import { eq } from "drizzle-orm";
import { os } from "../db/schema";
import type { Deps } from "../deps";
import { carregarDadosPdf } from "./pdf-dados";
import { MARGEM, novoCursor } from "./pdf-layout";
import { paginaApr, paginaOs } from "./pdf-paginas";

export { manipularEmailAlerta } from "./email-alerta";

type TarefaAtual = { id: string; referenciaId: string | null };

/**
 * PDF de 2 páginas da OS, como o papel: página 1 = APR da Execução que encerrou; página 2 = a OS (execução com tempo
 * líquido somado dos trechos, assinaturas, ciência e fotos). Lança erro se a OS não tem Execução encerrada. Se o conteúdo
 * não couber (APR muito longa, muitas fotos), o PDF ganha páginas extras em vez de cortar.
 */
export async function gerarPdfOs(deps: Deps, osId: string, opcoes: { comprimir?: boolean } = {}): Promise<Uint8Array> {
  const dados = await carregarDadosPdf(deps, osId);
  const geradoEm = deps.agora();

  const doc = new PDFDocument({
    size: "A4",
    compress: opcoes.comprimir ?? true,
    margins: { top: MARGEM, bottom: MARGEM, left: MARGEM, right: MARGEM },
    info: { Title: `OS ${dados.os.numeroOrdem ?? dados.os.id}`, Author: "D.A.P.R.O.M", CreationDate: geradoEm },
  });
  const pedacos: Buffer[] = [];
  doc.on("data", (p: Buffer) => pedacos.push(p));
  const pronto = new Promise<void>((resolver, rejeitar) => {
    doc.on("end", resolver);
    doc.on("error", rejeitar);
  });

  const cursor = novoCursor(doc);
  paginaApr(cursor, dados);
  doc.addPage();
  cursor.y = MARGEM;
  paginaOs(cursor, dados, geradoEm);
  doc.end();
  await pronto;
  return new Uint8Array(Buffer.concat(pedacos));
}

/** Gera o PDF da OS, guarda no bucket `pdfs` (caminho = id da OS, sobrescrevendo o anterior) e atualiza a OS. */
export async function gerarEGuardarPdfOs(deps: Deps, osId: string): Promise<{ caminho: string; bytes: Uint8Array }> {
  const bytes = await gerarPdfOs(deps, osId);
  await deps.armazenamento.gravar("pdfs", osId, bytes, "application/pdf", { sobrescrever: true });
  await deps.db.update(os).set({ pdfPath: osId, pdfEm: deps.agora() }).where(eq(os.id, osId));
  return { caminho: osId, bytes };
}

/** Tarefa `pdf_os`: `referenciaId` é a OS. A falha (inclusive OS ainda sem Execução encerrada) faz a tarefa tentar de novo. */
export async function manipularPdfOs(deps: Deps, tarefa: TarefaAtual): Promise<void> {
  if (!tarefa.referenciaId) throw new Error("Tarefa pdf_os sem referência à OS");
  await gerarEGuardarPdfOs(deps, tarefa.referenciaId);
}
