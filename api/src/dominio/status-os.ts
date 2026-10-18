import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { apr, execucao, os, type OsStatus } from "../db/schema";

/**
 * Os status em que a execução já terminou (o tempo parou) e a OS não pode mais receber APR nem execução: o encerramento em
 * andamento, a espera do supervisor e a concluída. `OS_FINALIZADAS` soma a cancelada e a devolvida.
 */
export const STATUS_APOS_A_EXECUCAO: readonly OsStatus[] = ["encerrando", "aguardando_supervisor", "encerrada"];
export const OS_FINALIZADAS: readonly OsStatus[] = [...STATUS_APOS_A_EXECUCAO, "cancelada", "devolvida"];

/** A OS já passou da execução (encerrando, esperando o supervisor ou concluída). */
export const executouAteOFim = (status: OsStatus) => STATUS_APOS_A_EXECUCAO.includes(status);

/**
 * Deriva o `status` da OS a partir das APRs e Execuções (Decisão-chave 3: nenhum cliente o grava), nesta ordem:
 * `cancelada` se já foi cancelada (SAP ou OS de apoio, e fica) e `devolvida` se o supervisor a devolveu ao SAP (também fica);
 * depois, havendo Execução encerrada (o clique em "Encerrar OS", que para o tempo): `encerrando` até o responsável preencher e
 * assinar o encerramento, `aguardando_supervisor` até o supervisor ler o relatório e assinar (a ciência), e só então `encerrada`
 * (concluída); `em_execucao` se há Execução em andamento (inclui em pausa); `pendente` se há APR bloqueada, ou Execução
 * interrompida ou suspensa; `liberada` nos demais casos. A Execução cancelada por engano não conta, então a OS volta ao status
 * anterior.
 */
export async function recalcularStatusOs(db: Db, osId: string): Promise<OsStatus> {
  const [atual] = await db.select({ status: os.status, cienciaEm: os.cienciaEm }).from(os).where(eq(os.id, osId));
  if (!atual) throw new Error(`OS ${osId} não existe`);
  if (atual.status === "cancelada" || atual.status === "devolvida") return atual.status;

  const execucoes = await db
    .select({ resultado: execucao.resultado, assinada: sql<boolean>`bool_or(${execucao.encerramentoAssinadoEm} is not null)`, n: sql<number>`count(*)::int` })
    .from(execucao)
    .where(and(eq(execucao.osId, osId), sql`${execucao.resultado} is distinct from 'cancelada'`))
    .groupBy(execucao.resultado);
  const tem = (r: string | null) => execucoes.some((e) => e.resultado === r);

  let novo: OsStatus;
  if (tem("encerrada")) {
    const assinada = execucoes.find((e) => e.resultado === "encerrada")!.assinada;
    novo = !assinada ? "encerrando" : atual.cienciaEm ? "encerrada" : "aguardando_supervisor";
  } else if (tem(null)) novo = "em_execucao";
  else if (tem("interrompida") || tem("suspensa")) novo = "pendente";
  else {
    const [bloqueada] = await db.select({ id: apr.id }).from(apr).where(and(eq(apr.osId, osId), eq(apr.resultado, "bloqueada"))).limit(1);
    novo = bloqueada ? "pendente" : "liberada";
  }

  if (novo !== atual.status) await db.update(os).set({ status: novo }).where(eq(os.id, osId));
  return novo;
}
