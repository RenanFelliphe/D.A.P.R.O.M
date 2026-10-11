import { and, desc, eq, gte, inArray, isNotNull, or } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { apr, aprParticipante, atividade, execucao, execucaoPausa, itemModeloApr, localInstalacao, modeloApr, os, riscoModeloApr, usuario } from "../db/schema";
import { usuarioParaApi } from "./usuarios";

const DIAS_DE_HISTORICO = 60;

/**
 * Snapshot da equipe para o modo offline (Eventos, tabela "Dados do snapshot"): as OS `liberada`, `pendente` e
 * `em_execucao` da equipe, as `encerrada` do próprio técnico dos últimos 60 dias, com o resumo das APRs e execuções de
 * cada uma, os modelos publicados (mais as versões que as APRs do snapshot usaram), a tabela de atividades, os locais
 * dessas OS e os usuários da equipe. No MVP é sempre completo: o `cursor` devolvido é só o instante da geração.
 */
export async function montarSnapshot(db: Db, usuarioLogado: { id: string; equipeId: string }, agora: Date) {
  const desde = new Date(agora.getTime() - DIAS_DE_HISTORICO * 86_400_000);

  const minhasEncerradas = db
    .select({ osId: execucao.osId })
    .from(execucao)
    .where(and(eq(execucao.executorId, usuarioLogado.id), eq(execucao.resultado, "encerrada"), gte(execucao.fim, desde)));

  const ordens = await db
    .select()
    .from(os)
    .where(
      and(
        eq(os.equipeId, usuarioLogado.equipeId),
        or(inArray(os.status, ["liberada", "pendente", "em_execucao"]), and(eq(os.status, "encerrada"), inArray(os.id, minhasEncerradas))),
      ),
    );
  const osIds = ordens.map((o) => o.id);

  const aprs = osIds.length
    ? await db
        .select({ id: apr.id, osId: apr.osId, modeloAprId: apr.modeloAprId, preenchidaPor: apr.preenchidaPor, resultado: apr.resultado, concluidaEm: apr.concluidaEm })
        .from(apr)
        .where(inArray(apr.osId, osIds))
        .orderBy(desc(apr.concluidaEm))
    : [];
  const participantes = aprs.length
    ? await db.select({ aprId: aprParticipante.aprId, usuarioId: aprParticipante.usuarioId, funcao: aprParticipante.funcao }).from(aprParticipante).where(inArray(aprParticipante.aprId, aprs.map((a) => a.id)))
    : [];
  const execucoes = osIds.length ? await db.select().from(execucao).where(inArray(execucao.osId, osIds)) : [];
  const pausas = execucoes.length ? await db.select().from(execucaoPausa).where(inArray(execucaoPausa.execucaoId, execucoes.map((e) => e.id))) : [];

  const locais = osIds.length ? await db.select().from(localInstalacao).where(inArray(localInstalacao.id, [...new Set(ordens.map((o) => o.localInstalacaoId))])) : [];
  const atividades = await db.select().from(atividade);

  // Modelos: a publicada mais recente de cada código e as versões usadas pelas APRs do snapshot.
  const publicados = await db.select().from(modeloApr).where(isNotNull(modeloApr.publicadoEm)).orderBy(desc(modeloApr.versao));
  const maisRecentes = new Map<string, string>();
  for (const m of publicados) if (!maisRecentes.has(m.codigo)) maisRecentes.set(m.codigo, m.id);
  const idsDosModelos = new Set([...maisRecentes.values(), ...aprs.map((a) => a.modeloAprId)]);
  const modelos = publicados.filter((m) => idsDosModelos.has(m.id));
  const ids = modelos.map((m) => m.id);
  const riscos = ids.length ? await db.select().from(riscoModeloApr).where(inArray(riscoModeloApr.modeloAprId, ids)) : [];
  const itens = ids.length ? await db.select().from(itemModeloApr).where(inArray(itemModeloApr.modeloAprId, ids)) : [];

  const equipe = await db.select().from(usuario).where(and(eq(usuario.equipeId, usuarioLogado.equipeId), eq(usuario.ativo, true)));

  return {
    os: ordens,
    aprs: aprs.map((a) => ({ ...a, participantes: participantes.filter((p) => p.aprId === a.id).map(({ usuarioId, funcao }) => ({ usuarioId, funcao })) })),
    execucoes: execucoes.map((e) => ({ ...e, pausas: pausas.filter((p) => p.execucaoId === e.id) })),
    locais,
    atividades,
    modelosApr: modelos.map((m) => ({ ...m, riscos: riscos.filter((r) => r.modeloAprId === m.id), itens: itens.filter((i) => i.modeloAprId === m.id) })),
    usuarios: equipe.map((u) => usuarioParaApi(u, { semEmail: true })),
    cursor: agora.toISOString(),
  };
}
