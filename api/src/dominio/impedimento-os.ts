import { eq } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { equipe, os, reprogramacao, type OsStatus } from "../db/schema";
import { podeSupervisionarEquipe, type UsuarioAutenticado } from "../http/autenticacao";
import { conflito, invalido, naoEncontrado } from "../http/erros";
import { assinaturaDoAto } from "./assinatura";

/** Status em que a OS de apoio ainda pode ser cancelada pelo sistema. */
const STATUS_CANCELAVEIS: readonly OsStatus[] = ["liberada", "pendente"];
/** Reprogramar não faz sentido depois do fim da OS. */
const STATUS_REPROGRAMAVEIS_NEGADOS: readonly OsStatus[] = ["encerrando", "aguardando_supervisor", "encerrada", "cancelada"];

/** Soma `dias` a uma data `AAAA-MM-DD` (calendário UTC, sem fuso nem horário de verão). */
function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

const diasEntre = (de: string, ate: string) => {
  const ms = (x: string) => {
    const [a, m, d] = x.split("-").map(Number) as [number, number, number];
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((ms(ate) - ms(de)) / 86_400_000);
};

/**
 * Nova data (e, se vier, nova equipe) com justificativa. O status não muda; a duração programada se mantém
 * (`data_fim_prog` anda o mesmo número de dias). Para quem não vê a equipe da OS, ela não existe (404).
 */
export async function reprogramarOs(
  db: Db,
  eu: UsuarioAutenticado,
  osId: string,
  dados: { dataInicioProg: string; equipeId?: string; justificativa: string },
) {
  return db.transaction(async (tx) => {
    const [atual] = await tx.select().from(os).where(eq(os.id, osId)).for("update");
    if (!atual || !podeSupervisionarEquipe(eu, atual.equipeId)) throw naoEncontrado("OS não encontrada");
    if (STATUS_REPROGRAMAVEIS_NEGADOS.includes(atual.status)) {
      throw conflito("os_finalizada", `OS ${atual.status === "cancelada" ? "cancelada" : "encerrada"} não pode ser reprogramada`);
    }

    let equipeNovaId = atual.equipeId;
    if (dados.equipeId !== undefined && dados.equipeId !== atual.equipeId) {
      const [e] = await tx.select({ id: equipe.id }).from(equipe).where(eq(equipe.id, dados.equipeId));
      if (!e) throw invalido("equipe_inexistente", "Equipe não encontrada");
      equipeNovaId = e.id;
    }

    const deslocamento = diasEntre(atual.dataInicioProg, dados.dataInicioProg);
    await tx
      .update(os)
      .set({
        dataInicioProg: dados.dataInicioProg,
        dataFimProg: atual.dataFimProg === null ? null : somarDias(atual.dataFimProg, deslocamento),
        equipeId: equipeNovaId,
      })
      .where(eq(os.id, osId));
    await tx.insert(reprogramacao).values({
      osId,
      usuarioId: eu.id,
      dataAnterior: atual.dataInicioProg,
      dataNova: dados.dataInicioProg,
      equipeAnteriorId: atual.equipeId,
      equipeNovaId,
      justificativa: dados.justificativa,
      assinaturaPath: assinaturaDoAto(eu),
    });
    return { id: osId, status: atual.status };
  });
}

/** Cancela a OS de apoio (a do SAP é cancelada pelo próprio SAP, na leitura). Só `liberada` ou `pendente`. */
export async function cancelarOsDeApoio(db: Db, eu: UsuarioAutenticado, osId: string, justificativa: string, agora: Date) {
  return db.transaction(async (tx) => {
    const [atual] = await tx.select().from(os).where(eq(os.id, osId)).for("update");
    if (!atual) throw naoEncontrado("OS não encontrada");
    if (atual.origem !== "apoio") throw invalido("os_nao_apoio", "Só OS de apoio pode ser cancelada pelo sistema");
    if (!STATUS_CANCELAVEIS.includes(atual.status)) {
      throw conflito("status_invalido_para_cancelar", `OS ${atual.status.replace("_", " ")} não pode ser cancelada`);
    }
    await tx
      .update(os)
      .set({ status: "cancelada", canceladaEm: agora, canceladaPor: eu.id, justificativaCancelamento: justificativa, canceladaAssinaturaPath: assinaturaDoAto(eu) })
      .where(eq(os.id, osId));
    return { id: osId, status: "cancelada" as const };
  });
}
