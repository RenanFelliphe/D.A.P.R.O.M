import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { ausencia, ausenciaAto, equipe, execucao, execucaoPausa, os, usuario, type AlertaTipo, type AusenciaAto } from "../db/schema";
import { criarAviso, destinatariosDaEquipe } from "./alertas";
import { registrarAuditoria } from "./auditoria";
import { recalcularStatusOs } from "./status-os";
import { dataBr, diaDe, inicioDoDia } from "./tempo";

export type LinhaAusencia = typeof ausencia.$inferSelect;

/** Os estados em que a ausência ainda está de pé (a sobreposição e o bloqueio do ausente só leem estes). */
export const ESTADOS_ABERTOS = ["pedida", "aguardando_confirmacao", "confirmada"] as const;

/**
 * Como a ausência está hoje. `agendada`, `em_curso` e `vencida` não são gravadas: saem das datas da ausência `confirmada`
 * (agendada antes do início; em curso até a véspera do retorno; vencida a partir do retorno, até alguém encerrá-la).
 */
export type SituacaoDaAusencia = "pedida" | "aguardando_confirmacao" | "agendada" | "em_curso" | "vencida" | "encerrada" | "recusada" | "cancelada";

export function situacaoDaAusencia(a: Pick<LinhaAusencia, "estado" | "inicio" | "retorno">, hoje: string): SituacaoDaAusencia {
  if (a.estado !== "confirmada") return a.estado;
  if (hoje < a.inicio) return "agendada";
  return hoje < a.retorno ? "em_curso" : "vencida";
}

/** A ausência que está valendo para a pessoa: ela já começou (em curso) e ainda não foi encerrada (em curso ou vencida). */
export interface AusenciaVigente {
  id: string;
  inicio: string;
  retorno: string;
  situacao: "em_curso" | "vencida";
}

const vigenteDe = (a: LinhaAusencia, hoje: string): AusenciaVigente => ({
  id: a.id,
  inicio: a.inicio,
  retorno: a.retorno,
  situacao: hoje < a.retorno ? "em_curso" : "vencida",
});

/** Quem está ausente em `hoje` (id → ausência). Quem não está ausente não aparece. */
export async function ausentesEm(db: Db, usuarioIds: string[], hoje: string): Promise<Map<string, AusenciaVigente>> {
  const mapa = new Map<string, AusenciaVigente>();
  if (usuarioIds.length === 0) return mapa;
  const linhas = await db
    .select()
    .from(ausencia)
    .where(and(inArray(ausencia.usuarioId, usuarioIds), eq(ausencia.estado, "confirmada"), lte(ausencia.inicio, hoje)))
    .orderBy(ausencia.inicio);
  // Com duas abertas (uma vencida e outra já em curso) vale a que começou por último.
  for (const l of linhas) mapa.set(l.usuarioId, vigenteDe(l, hoje));
  return mapa;
}

export async function ausenciaVigenteDe(db: Db, usuarioId: string, hoje: string): Promise<AusenciaVigente | null> {
  return (await ausentesEm(db, [usuarioId], hoje)).get(usuarioId) ?? null;
}

/** O selo das listas de pessoas: "Ausente até 03/11" ou "Ausência vencida desde 03/11". */
export const rotuloDoSelo = (a: AusenciaVigente) => (a.situacao === "vencida" ? `Ausência vencida desde ${dataBr(a.retorno)}` : `Ausente até ${dataBr(a.retorno)}`);

/** O que a API devolve de cada pessoa que está ausente (ou `null`). */
export const ausenciaDaPessoaParaApi = (a: AusenciaVigente | undefined) => (a ? { ...a, rotulo: rotuloDoSelo(a) } : null);

/** O instante em que a ausência começa (0h do `inicio`, em São Paulo); eventos de campo desse instante em diante são recusados. */
export const inicioDaAusencia = (a: Pick<LinhaAusencia, "inicio">): Date => inicioDoDia(a.inicio);

/** A pessoa tem execução aberta (em andamento ou em pausa)? O supervisor é avisado disto ao aprovar ou registrar. */
export async function temExecucaoAberta(db: Db, usuarioId: string): Promise<boolean> {
  const [e] = await db.select({ id: execucao.id }).from(execucao).where(and(eq(execucao.executorId, usuarioId), isNull(execucao.resultado))).limit(1);
  return !!e;
}

// ---------------------------------------------------------------------------------------------------------------

/** Grava um ato na linha do tempo da ausência. */
export async function gravarAto(
  db: Db,
  dados: { ausenciaId: string; tipo: AusenciaAto; autorId: string | null; agora: Date; assinaturaPath?: string | null; dados?: Record<string, unknown> },
) {
  await db.insert(ausenciaAto).values({
    ausenciaId: dados.ausenciaId,
    tipo: dados.tipo,
    autorId: dados.autorId,
    em: dados.agora,
    assinaturaPath: dados.assinaturaPath ?? null,
    dados: dados.dados ?? null,
  });
}

/** Cria o aviso de uma ausência, um por destinatário (sem repetir a pessoa), no sino e por e-mail. Quem chama passa a própria transação. */
export async function avisarAusencia(
  db: Db,
  dados: { tipo: AlertaTipo; ausenciaId: string; usuarioAlvoId: string; destinatarios: string[]; detalhe: string; agora: Date },
): Promise<void> {
  await criarAviso(db, dados.destinatarios, { tipo: dados.tipo, ausenciaId: dados.ausenciaId, usuarioAlvoId: dados.usuarioAlvoId, detalhe: dados.detalhe, agora: dados.agora });
}

/** Quem responde pela equipe: o supervisor ativo dela, o representante no comando (também na equipe sem supervisor) e, sem ninguém, os administradores (mesma regra dos demais alertas da equipe). */
export async function destinatariosDoSupervisor(db: Db, equipeId: string): Promise<string[]> {
  return (await destinatariosDaEquipe(db, equipeId)).map((d) => d.id);
}

// ---------------------------------------------------------------------------------------------------------------

/**
 * Aplica o início da ausência, uma única vez: a execução aberta da pessoa é suspensa (como no fim do expediente: a OS fica
 * pendente e a equipe a retoma com uma APR nova) e toda OS reservada a ela volta para a equipe toda. O que foi feito vai no
 * ato `inicio`, que é de onde a linha do tempo da OS tira a linha "Reserva desfeita: ausência de <nome>". Quem chama passa a
 * própria transação.
 */
export async function aplicarInicioDaAusencia(db: Db, a: LinhaAusencia, agora: Date): Promise<{ reservasDesfeitas: string[]; execucoesSuspensas: string[] }> {
  const abertas = await db.select().from(execucao).where(and(eq(execucao.executorId, a.usuarioId), isNull(execucao.resultado)));
  for (const e of abertas) {
    const fim = agora < e.inicio ? e.inicio : agora;
    await db.update(execucaoPausa).set({ fim }).where(and(eq(execucaoPausa.execucaoId, e.id), isNull(execucaoPausa.fim)));
    await db.update(execucao).set({ fim, resultado: "suspensa", suspensaoMotivo: "outro", suspensaoComplemento: "Início da ausência de quem executava" }).where(eq(execucao.id, e.id));
    await recalcularStatusOs(db, e.osId);
  }

  const reservadas = await db
    .select({ id: os.id })
    .from(os)
    .where(and(eq(os.responsavelId, a.usuarioId), inArray(os.status, ["liberada", "pendente", "em_execucao"])));
  const reservasDesfeitas = reservadas.map((o) => o.id);
  if (reservasDesfeitas.length > 0) {
    await db.update(os).set({ responsavelId: null, reservadaPor: null, reservadaEm: null }).where(inArray(os.id, reservasDesfeitas));
  }

  const execucoesSuspensas = abertas.map((e) => e.id);
  await db.update(ausencia).set({ inicioAplicadoEm: agora }).where(eq(ausencia.id, a.id));
  await gravarAto(db, {
    ausenciaId: a.id,
    tipo: "inicio",
    autorId: null,
    agora,
    dados: { reservas_desfeitas: reservasDesfeitas, execucoes_suspensas: execucoesSuspensas },
  });
  return { reservasDesfeitas, execucoesSuspensas };
}

/** As ausências que desfizeram a reserva de cada OS (a linha do tempo da OS): `{ em, usuarioNome }`. */
export async function reservasDesfeitasPorAusencia(db: Db, osId: string): Promise<{ em: Date; usuarioNome: string }[]> {
  return db
    .select({ em: ausenciaAto.em, usuarioNome: usuario.nome })
    .from(ausenciaAto)
    .innerJoin(ausencia, eq(ausencia.id, ausenciaAto.ausenciaId))
    .innerJoin(usuario, eq(usuario.id, ausencia.usuarioId))
    .where(and(eq(ausenciaAto.tipo, "inicio"), sql`${ausenciaAto.dados} @> ${JSON.stringify({ reservas_desfeitas: [osId] })}::jsonb`))
    .orderBy(ausenciaAto.em);
}

// ---------------------------------------------------------------------------------------------------------------

const SISTEMA = { id: null, nome: "Sistema" } as const;

/**
 * A tarefa periódica (de hora em hora e na subida), idempotente: a subida e a rodada não repetem nada.
 * - cancela o pedido parado (`pedida` ou `aguardando_confirmacao`) cuja data de retorno chegou, avisando as duas pessoas;
 * - aplica o início das ausências confirmadas que já começaram (`aplicarInicioDaAusencia`);
 * - avisa o supervisor das que venceram (a data de retorno chegou e o retorno não foi confirmado).
 */
export async function conferirAusencias(db: Db, agora: Date): Promise<{ canceladas: number; iniciadas: number; vencidas: number }> {
  const hoje = diaDe(agora);
  const resultado = { canceladas: 0, iniciadas: 0, vencidas: 0 };

  const paradas = await db
    .select({ id: ausencia.id })
    .from(ausencia)
    .where(and(inArray(ausencia.estado, ["pedida", "aguardando_confirmacao"]), lte(ausencia.retorno, hoje)));
  for (const { id } of paradas) {
    const feito = await db.transaction(async (transacao) => {
      const tx = transacao as unknown as Db;
      const [a] = await tx.select().from(ausencia).where(eq(ausencia.id, id)).for("update");
      if (!a || (a.estado !== "pedida" && a.estado !== "aguardando_confirmacao") || a.retorno > hoje) return null;
      await tx.update(ausencia).set({ estado: "cancelada", encerradaEm: agora, encerradaPor: null }).where(eq(ausencia.id, id));
      await gravarAto(tx, { ausenciaId: id, tipo: "cancelamento_automatico", autorId: null, agora, dados: { retorno: a.retorno } });
      const [pessoa] = await tx.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, a.usuarioId));
      const detalhe = `O pedido de ausência de ${pessoa?.nome ?? "uma pessoa"} (${dataBr(a.inicio)} a ${dataBr(a.retorno)}) foi cancelado: a data de retorno chegou sem a conclusão do pedido.`;
      await avisarAusencia(tx, {
        tipo: "ausencia_cancelada",
        ausenciaId: id,
        usuarioAlvoId: a.usuarioId,
        destinatarios: [a.usuarioId, ...(await destinatariosDoSupervisor(tx, a.equipeId))],
        detalhe,
        agora,
      });
      return { a, nome: pessoa?.nome ?? "" };
    });
    if (feito) {
      resultado.canceladas++;
      await registrarAuditoria(db, SISTEMA, {
        entidade: "ausencia",
        verbo: "cancelamento_automatico",
        entidadeId: id,
        alvo: feito.nome,
        resumo: `Cancelou o pedido parado de ausência de ${feito.nome}`,
        detalhes: { inicio: feito.a.inicio, retorno: feito.a.retorno },
      });
    }
  }

  const aIniciar = await db
    .select({ id: ausencia.id })
    .from(ausencia)
    .where(and(eq(ausencia.estado, "confirmada"), lte(ausencia.inicio, hoje), isNull(ausencia.inicioAplicadoEm)));
  for (const { id } of aIniciar) {
    const feito = await db.transaction(async (transacao) => {
      const tx = transacao as unknown as Db;
      const [a] = await tx.select().from(ausencia).where(eq(ausencia.id, id)).for("update");
      if (!a || a.estado !== "confirmada" || a.inicioAplicadoEm || a.inicio > hoje) return false;
      await aplicarInicioDaAusencia(tx, a, agora);
      return true;
    });
    if (feito) resultado.iniciadas++;
  }

  const aVencer = await db
    .select({ id: ausencia.id })
    .from(ausencia)
    .where(and(eq(ausencia.estado, "confirmada"), lte(ausencia.retorno, hoje), isNull(ausencia.vencidaAvisadaEm)));
  for (const { id } of aVencer) {
    const feito = await db.transaction(async (transacao) => {
      const tx = transacao as unknown as Db;
      const [a] = await tx.select().from(ausencia).where(eq(ausencia.id, id)).for("update");
      if (!a || a.estado !== "confirmada" || a.vencidaAvisadaEm || a.retorno > hoje) return false;
      await tx.update(ausencia).set({ vencidaAvisadaEm: agora }).where(eq(ausencia.id, id));
      const [pessoa] = await tx.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, a.usuarioId));
      await avisarAusencia(tx, {
        tipo: "ausencia_vencida",
        ausenciaId: id,
        usuarioAlvoId: a.usuarioId,
        destinatarios: await destinatariosDoSupervisor(tx, a.equipeId),
        detalhe: `A ausência de ${pessoa?.nome ?? "uma pessoa"} venceu: o retorno estava previsto para ${dataBr(a.retorno)} e ainda não foi confirmado. Prorrogue ou encerre a ausência.`,
        agora,
      });
      return true;
    });
    if (feito) resultado.vencidas++;
  }

  return resultado;
}

/** O nome da equipe, para as frases dos avisos e da trilha. */
export async function nomeDaEquipe(db: Db, equipeId: string): Promise<string> {
  const [e] = await db.select({ nome: equipe.nome }).from(equipe).where(eq(equipe.id, equipeId));
  return e?.nome ?? "";
}
