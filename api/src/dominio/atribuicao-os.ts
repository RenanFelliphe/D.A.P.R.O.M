import { eq } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { os, usuario, type OsStatus } from "../db/schema";
import { podeVerEquipe, type UsuarioAutenticado } from "../http/autenticacao";
import { conflito, invalido, naoEncontrado, proibido } from "../http/erros";
import { ausentesEm } from "./ausencia";
import { diaDe } from "./tempo";

/** Enquanto a OS não começou, o supervisor pode reservá-la a uma pessoa, trocar o responsável ou liberá-la para a equipe. */
const STATUS_RESERVAVEIS: readonly OsStatus[] = ["liberada", "pendente"];
/** Só devolve a OS que ainda não foi tocada: a que já tem APR bloqueada ou execução segue o caminho dos impedimentos. */
const STATUS_DEVOLVIVEIS: readonly OsStatus[] = ["liberada"];

/**
 * A OS de que o usuário supervisiona a equipe, travada para a alteração. Para quem não vê a equipe da OS ela não existe
 * (`404`); o admin vê, mas a atribuição e a devolução são do supervisor da equipe, então ele recebe `403`.
 */
async function osDoSupervisor(tx: Db, eu: UsuarioAutenticado, osId: string) {
  const [atual] = await tx.select().from(os).where(eq(os.id, osId)).for("update");
  if (!atual || !podeVerEquipe(eu, atual.equipeId)) throw naoEncontrado("OS não encontrada");
  if (!eu.equipesSupervisionadas.includes(atual.equipeId)) throw proibido("Só o supervisor da equipe da OS faz isso");
  return atual;
}

/**
 * Reserva a OS a uma pessoa da equipe (ou troca o responsável): a OS segue no quadro da equipe, com a marca, e só o
 * responsável inicia a APR e a execução. Quem pode ser responsável: técnico ativo e liberado, da equipe da OS.
 */
export async function reservarOs(db: Db, eu: UsuarioAutenticado, osId: string, responsavelId: string, agora: Date) {
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const atual = await osDoSupervisor(tdb, eu, osId);
    if (!STATUS_RESERVAVEIS.includes(atual.status)) {
      throw conflito("status_invalido_para_reservar", `OS ${atual.status.replace("_", " ")} não pode ser reservada`);
    }
    const [pessoa] = await tdb.select().from(usuario).where(eq(usuario.id, responsavelId));
    if (!pessoa || pessoa.perfil !== "tecnico" || !pessoa.ativo || pessoa.liberacao !== "liberado" || pessoa.equipeId !== atual.equipeId) {
      throw invalido("responsavel_invalido", "O responsável precisa ser um técnico ativo da equipe da OS");
    }
    if ((await ausentesEm(tdb, [responsavelId], diaDe(agora))).has(responsavelId)) {
      throw invalido("responsavel_ausente", `${pessoa.nome} está ausente e não pode receber a OS`);
    }
    const anterior = atual.responsavelId;
    if (anterior !== responsavelId) {
      await tdb.update(os).set({ responsavelId, reservadaPor: eu.id, reservadaEm: agora }).where(eq(os.id, osId));
    }
    return { id: osId, status: atual.status, responsavel: { id: pessoa.id, nome: pessoa.nome }, anteriorId: anterior, mudou: anterior !== responsavelId };
  });
}

/** Tira a reserva: a OS volta a ser da equipe toda. Sem reserva, não há o que fazer e a chamada é `409`. */
export async function liberarReserva(db: Db, eu: UsuarioAutenticado, osId: string) {
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const atual = await osDoSupervisor(tdb, eu, osId);
    if (atual.responsavelId === null) throw conflito("os_sem_reserva", "A OS não está reservada");
    await tdb.update(os).set({ responsavelId: null, reservadaPor: null, reservadaEm: null }).where(eq(os.id, osId));
    return { id: osId, status: atual.status, responsavelAnteriorId: atual.responsavelId };
  });
}

/**
 * Devolve a OS ao SAP com a justificativa do supervisor: ela sai do quadro da equipe (`devolvida`), perde a reserva e vai
 * na próxima planilha de baixa. O SYNC OS não escreve no SAP; é quem lê a planilha que corrige a ordem. A OS de apoio nasce
 * no sistema e não tem ordem para onde voltar: ela é cancelada, não devolvida.
 */
export async function devolverOs(db: Db, eu: UsuarioAutenticado, osId: string, justificativa: string, agora: Date) {
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const atual = await osDoSupervisor(tdb, eu, osId);
    if (atual.origem === "apoio") throw invalido("os_apoio", "A OS de apoio não é do SAP: o admin a cancela");
    if (!STATUS_DEVOLVIVEIS.includes(atual.status)) {
      throw conflito("status_invalido_para_devolver", `OS ${atual.status.replace("_", " ")} não pode ser devolvida: só a OS liberada, que ainda não foi iniciada`);
    }
    await tdb
      .update(os)
      .set({
        status: "devolvida",
        devolvidaEm: agora,
        devolvidaPor: eu.id,
        justificativaDevolucao: justificativa,
        devolucaoExportadaEm: null,
        responsavelId: null,
        reservadaPor: null,
        reservadaEm: null,
      })
      .where(eq(os.id, osId));
    return { id: osId, status: "devolvida" as const };
  });
}
