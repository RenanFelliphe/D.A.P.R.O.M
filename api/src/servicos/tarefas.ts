import { and, asc, eq, inArray, lt, lte, or } from "drizzle-orm";
import { tarefa } from "../db/schema";
import type { Deps } from "../deps";
import { enfileirarTarefa } from "./fila";
import { manipularEmailAlerta, manipularPdfOs } from "./pdf-os";
import { manipularLeituraSap } from "./leitura-sap";

type Tarefa = typeof tarefa.$inferSelect;
type Manipulador = (deps: Deps, tarefa: { id: string; referenciaId: string | null }) => Promise<void>;

const MANIPULADORES: Record<string, Manipulador> = {
  pdf_os: manipularPdfOs,
  email_alerta: manipularEmailAlerta,
  leitura_sap: manipularLeituraSap,
};

/** Máximo de tentativas; a quinta falha deixa a tarefa em `falhou`. */
export const MAX_TENTATIVAS = 5;
/** Espera (minutos) antes da nova tentativa, depois da 1ª, 2ª, 3ª e 4ª falha. */
export const ESPERAS_MIN = [1, 5, 15, 15] as const;
/** Uma tarefa `em_andamento` há mais que isto é de um processo que caiu: volta para `pendente`. */
export const LIMITE_EM_ANDAMENTO_MIN = 10;
const INTERVALO_EXECUTOR_MS = 5_000;

const minutos = (n: number) => n * 60_000;

/**
 * Reserva a tarefa vencida mais antiga: `pendente` com `proxima_em` no passado. Um único `UPDATE` com
 * `FOR UPDATE SKIP LOCKED` na subconsulta: dois processos nunca pegam a mesma linha. `proxima_em` passa a guardar
 * o instante da reserva, que a recuperação de queda usa.
 */
async function reservar(deps: Deps): Promise<Tarefa | null> {
  const agora = deps.agora();
  const proxima = deps.db
    .select({ id: tarefa.id })
    .from(tarefa)
    .where(and(eq(tarefa.estado, "pendente"), lte(tarefa.proximaEm, agora)))
    .orderBy(asc(tarefa.proximaEm), asc(tarefa.criadaEm))
    .limit(1)
    .for("update", { skipLocked: true });
  const [reservada] = await deps.db
    .update(tarefa)
    .set({ estado: "em_andamento", proximaEm: agora })
    .where(inArray(tarefa.id, proxima))
    .returning();
  return reservada ?? null;
}

async function registrarSucesso(deps: Deps, t: Tarefa) {
  await deps.db.update(tarefa).set({ estado: "concluida", erro: null }).where(eq(tarefa.id, t.id));
}

async function registrarFalha(deps: Deps, t: Tarefa, erro: unknown) {
  const tentativas = t.tentativas + 1;
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  const esgotada = tentativas >= MAX_TENTATIVAS;
  await deps.db
    .update(tarefa)
    .set({
      estado: esgotada ? "falhou" : "pendente",
      tentativas,
      erro: mensagem,
      proximaEm: new Date(deps.agora().getTime() + minutos(ESPERAS_MIN[Math.min(tentativas, ESPERAS_MIN.length) - 1]!)),
    })
    .where(eq(tarefa.id, t.id));
}

/** Processa, uma a uma, as tarefas vencidas. Devolve quantas foram tentadas (com sucesso ou não). */
export async function executarTarefasPendentes(deps: Deps): Promise<number> {
  let processadas = 0;
  for (;;) {
    const t = await reservar(deps);
    if (!t) return processadas;
    processadas++;

    const manipular = MANIPULADORES[t.tipo];
    if (!manipular) {
      await deps.db.update(tarefa).set({ estado: "falhou", erro: `Tipo de tarefa desconhecido: ${t.tipo}` }).where(eq(tarefa.id, t.id));
      continue;
    }
    try {
      await manipular(deps, { id: t.id, referenciaId: t.referenciaId });
    } catch (erro) {
      await registrarFalha(deps, t, erro);
      continue;
    }
    await registrarSucesso(deps, t);
  }
}

/** Devolve a `pendente` as tarefas que ficaram `em_andamento` por mais de 10 minutos (o processo caiu no meio). */
export async function recuperarTarefasPresas(deps: Deps): Promise<number> {
  const limite = new Date(deps.agora().getTime() - minutos(LIMITE_EM_ANDAMENTO_MIN));
  const recuperadas = await deps.db
    .update(tarefa)
    .set({ estado: "pendente", proximaEm: deps.agora() })
    .where(and(eq(tarefa.estado, "em_andamento"), lt(tarefa.proximaEm, limite)))
    .returning({ id: tarefa.id });
  return recuperadas.length;
}

/** Agenda a leitura periódica do SAP, a menos que já haja uma `pendente` ou `em_andamento`. Devolve se agendou. */
export async function agendarLeituraSap(deps: Deps): Promise<boolean> {
  const [aberta] = await deps.db
    .select({ id: tarefa.id })
    .from(tarefa)
    .where(and(eq(tarefa.tipo, "leitura_sap"), or(eq(tarefa.estado, "pendente"), eq(tarefa.estado, "em_andamento"))))
    .limit(1);
  if (aberta) return false;
  await enfileirarTarefa(deps.db, "leitura_sap", null, deps.agora());
  return true;
}

/**
 * Liga o executor no processo da `api`: a cada ~5 s recupera as tarefas presas, agenda a leitura do SAP (quando
 * `SAP_API_URL` está configurada, a cada `SAP_LEITURA_INTERVALO_MIN` minutos) e executa as tarefas vencidas, sem que
 * duas rodadas se sobreponham. Devolve a função que o encerra.
 */
export function iniciarTarefas(deps: Deps): () => void {
  let rodando = false;
  let parado = false;
  let ultimoAgendamento = 0;

  async function rodada() {
    if (rodando || parado) return;
    rodando = true;
    try {
      await recuperarTarefasPresas(deps);
      const agora = deps.agora().getTime();
      if (deps.config.sapApiUrl && agora - ultimoAgendamento >= minutos(deps.config.sapLeituraIntervaloMin)) {
        await agendarLeituraSap(deps);
        ultimoAgendamento = agora;
      }
      await executarTarefasPendentes(deps);
    } catch (erro) {
      console.error("Falha no executor de tarefas:", erro);
    } finally {
      rodando = false;
    }
  }

  const temporizador = setInterval(() => void rodada(), INTERVALO_EXECUTOR_MS);
  temporizador.unref();
  void rodada();
  return () => {
    parado = true;
    clearInterval(temporizador);
  };
}
