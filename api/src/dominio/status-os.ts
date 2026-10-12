import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { apr, execucao, os, type OsStatus } from "../db/schema";

/**
 * Deriva o `status` da OS a partir das APRs e Execuções (Decisão-chave 3: nenhum cliente o grava), nesta ordem:
 * `cancelada` se já foi cancelada (SAP ou OS de apoio, e fica); `encerrada` se há Execução encerrada; `em_execucao` se há
 * Execução em andamento (inclui em pausa); `pendente` se há APR bloqueada, ou Execução interrompida ou suspensa;
 * `liberada` nos demais casos. A Execução cancelada por engano não conta, então a OS volta ao status anterior.
 */
export async function recalcularStatusOs(db: Db, osId: string): Promise<OsStatus> {
  const [atual] = await db.select({ status: os.status }).from(os).where(eq(os.id, osId));
  if (!atual) throw new Error(`OS ${osId} não existe`);
  if (atual.status === "cancelada") return "cancelada";

  const execucoes = await db
    .select({ resultado: execucao.resultado, n: sql<number>`count(*)::int` })
    .from(execucao)
    .where(and(eq(execucao.osId, osId), sql`${execucao.resultado} is distinct from 'cancelada'`))
    .groupBy(execucao.resultado);
  const tem = (r: string | null) => execucoes.some((e) => e.resultado === r);

  let novo: OsStatus;
  if (tem("encerrada")) novo = "encerrada";
  else if (tem(null)) novo = "em_execucao";
  else if (tem("interrompida") || tem("suspensa")) novo = "pendente";
  else {
    const [bloqueada] = await db.select({ id: apr.id }).from(apr).where(and(eq(apr.osId, osId), eq(apr.resultado, "bloqueada"))).limit(1);
    novo = bloqueada ? "pendente" : "liberada";
  }

  if (novo !== atual.status) await db.update(os).set({ status: novo }).where(eq(os.id, osId));
  return novo;
}
