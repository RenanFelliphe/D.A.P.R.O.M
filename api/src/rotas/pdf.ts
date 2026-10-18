import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { os } from "../db/schema";
import type { Deps } from "../deps";
import { podeSupervisionarEquipe, podeVerEquipe, type Ambiente, type Autenticacao } from "../http/autenticacao";
import { conflito, naoEncontrado, proibido } from "../http/erros";
import { lerId } from "../http/validacao";
import { gerarEGuardarPdfOs } from "../servicos/pdf-os";
import { gerarRelatorioDaExecucao, osTemExecucaoFinalizada } from "../servicos/relatorio-execucao";

/**
 * `GET /os/{id}/pdf`: o PDF da OS (a APR e a folha do SAP, sem nada a mais), para quem enxerga a OS (a de outra equipe não existe: 404).
 * `GET /os/{id}/relatorio-execucao`: o relatório da execução, à parte, só para quem supervisiona a equipe da OS e para o admin.
 */
export function rotasPdf(deps: Deps, { autenticar }: Autenticacao) {
  const r = new Hono<Ambiente>();

  r.get("/os/:id/pdf", autenticar(), async (c) => {
    const id = lerId(c);
    const [o] = await deps.db.select({ equipeId: os.equipeId, status: os.status, pdfPath: os.pdfPath }).from(os).where(eq(os.id, id));
    if (!o || !podeVerEquipe(c.get("usuario"), o.equipeId)) throw naoEncontrado("OS não encontrada");

    let bytes = o.pdfPath ? await deps.armazenamento.ler("pdfs", o.pdfPath) : null;
    if (!bytes) {
      // Sem PDF guardado (a tarefa ainda não rodou, ou o arquivo sumiu): gera na hora, se a OS já foi concluída (com a assinatura do supervisor).
      if (o.status !== "encerrada") throw conflito("os_nao_encerrada", "A OS ainda não foi encerrada");
      bytes = (await gerarEGuardarPdfOs(deps, id)).bytes;
    }
    return c.body(bytes as unknown as ArrayBuffer, 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="os-${id}.pdf"`,
      "Cache-Control": "private, no-store",
    });
  });

  r.get("/os/:id/relatorio-execucao", autenticar(), async (c) => {
    const id = lerId(c);
    const eu = c.get("usuario");
    const [o] = await deps.db.select({ equipeId: os.equipeId }).from(os).where(eq(os.id, id));
    if (!o || !podeVerEquipe(eu, o.equipeId)) throw naoEncontrado("OS não encontrada");
    if (!podeSupervisionarEquipe(eu, o.equipeId)) throw proibido("Só o supervisor da equipe da OS e o administrador veem o relatório da execução");
    if (!(await osTemExecucaoFinalizada(deps, id))) throw conflito("os_sem_execucao", "A OS ainda não tem execução finalizada");

    // Gerado na hora, do banco (não guarda arquivo): reflete as pausas, a localização e as assinaturas de agora.
    const bytes = await gerarRelatorioDaExecucao(deps, id);
    return c.body(bytes as unknown as ArrayBuffer, 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="relatorio-execucao-${id}.pdf"`,
      "Cache-Control": "private, no-store",
    });
  });

  return r;
}
