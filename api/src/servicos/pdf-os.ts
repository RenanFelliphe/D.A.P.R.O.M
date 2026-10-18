import PDFDocument from "pdfkit";
import { eq } from "drizzle-orm";
import { os } from "../db/schema";
import type { Deps } from "../deps";
import { avisarAdmins } from "../dominio/alertas";
import { carregarDadosPdf } from "./pdf-dados";
import { abrirEscala, fecharEscala, MARGEM, novoCursor, rodape, type Cursor, type Doc } from "./pdf-layout";
import { paginaApr, paginaOs } from "./pdf-paginas";

export { manipularEmailAlerta } from "./email-alerta";

type TarefaAtual = { id: string; referenciaId: string | null };

const MARGENS = { top: MARGEM, bottom: MARGEM, left: MARGEM, right: MARGEM };

/**
 * Escalas tentadas, da natural para a menor. A APR em papel sai "ajustada à página" entre 41% e 61%; com todos os riscos
 * marcados, a maior APR da carga inicial (APR 05) cabe em 60%. Abaixo de 45% o texto dos itens (7 pt) fica pequeno demais
 * para ler, e o conteúdo que nem assim couber continua na folha seguinte.
 */
const ESCALAS = [1, 0.95, 0.9, 0.85, 0.8, 0.76, 0.72, 0.68, 0.64, 0.6, 0.55, 0.5, 0.45];

/** Desenha uma página do documento e devolve o texto do rodapé. */
type Pagina = (c: Cursor) => string;

/** A maior escala em que a página cabe numa folha, medida num documento de rascunho (sem as imagens). */
function escalaQueCabe(pagina: Pagina): number {
  for (const escala of ESCALAS) {
    const rascunho = new PDFDocument({ size: "A4", margins: MARGENS });
    const c = novoCursor(rascunho, { escala, medindo: true });
    abrirEscala(c);
    pagina(c);
    fecharEscala(c);
    rascunho.end();
    if (c.quebras === 0) return escala;
  }
  return ESCALAS[ESCALAS.length - 1]!;
}

/** A página na escala que a faz caber numa folha, com o rodapé na última folha dela. */
function desenharPagina(doc: Doc, pagina: Pagina) {
  const c = novoCursor(doc, { escala: escalaQueCabe(pagina) });
  abrirEscala(c);
  const textoDoRodape = pagina(c);
  fecharEscala(c);
  rodape(doc, textoDoRodape);
}

/**
 * PDF de 2 páginas da OS, como o papel: página 1 = APR da Execução que encerrou; página 2 = a OS (execução com tempo
 * líquido somado dos trechos, assinaturas, ciência e fotos). Cada página é reduzida até caber numa folha A4, como a
 * planilha da APR impressa; só o que não couber nem na menor escala (APR muito longa, fotos demais) continua em outra
 * folha, em vez de cortar. Lança erro se a OS não tem Execução encerrada.
 */
export async function gerarPdfOs(deps: Deps, osId: string, opcoes: { comprimir?: boolean } = {}): Promise<Uint8Array> {
  const dados = await carregarDadosPdf(deps, osId);
  const geradoEm = deps.agora();

  const doc = new PDFDocument({
    size: "A4",
    compress: opcoes.comprimir ?? true,
    margins: MARGENS,
    info: { Title: `OS ${dados.os.numeroOrdem ?? dados.os.id}`, Author: "SYNQ OS", CreationDate: geradoEm },
  });
  const pedacos: Buffer[] = [];
  doc.on("data", (p: Buffer) => pedacos.push(p));
  const pronto = new Promise<void>((resolver, rejeitar) => {
    doc.on("end", resolver);
    doc.on("error", rejeitar);
  });

  desenharPagina(doc, (c) => paginaApr(c, dados));
  doc.addPage();
  desenharPagina(doc, (c) => paginaOs(c, dados, geradoEm));
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

/**
 * A tarefa `pdf_os` esgotou as tentativas: os administradores recebem o aviso `pdf_os_falhou` (o PDF é a evidência da OS
 * executada). Abrir o PDF no painel tenta gerá-lo de novo, na hora.
 */
export async function alertarFalhaDoPdf(deps: Deps, tarefa: { referenciaId: string | null }, erro: string): Promise<void> {
  if (!tarefa.referenciaId) return;
  const [o] = await deps.db.select({ id: os.id, numero: os.numeroOrdem, titulo: os.titulo }).from(os).where(eq(os.id, tarefa.referenciaId));
  if (!o) return;
  await avisarAdmins(deps.db, {
    tipo: "pdf_os_falhou",
    osId: o.id,
    detalhe: `O PDF da OS ${o.numero ?? "de apoio"} (${o.titulo}) não foi gerado depois de várias tentativas: ${erro.replace(/\.$/, "")}. A execução continua registrada; abrir o PDF da OS no painel tenta gerá-lo de novo.`,
    agora: deps.agora(),
  });
}
