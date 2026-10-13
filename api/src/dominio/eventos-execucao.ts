import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { PAUSA_MOTIVOS, apr, aprParticipante, evidencia, execucao, execucaoAssinatura, execucaoPausa, os, usuario } from "../db/schema";
import { instanteIso, uuid } from "../http/validacao";
import { criarAlertas } from "./alertas";
import {
  avisarConflitoDePlanejamento,
  carregarOsDoUsuario,
  evidenciaPayload,
  exigirArquivosDasEvidencias,
  lerPayload,
  linhaDeEvidencia,
  rejeitar,
  adiar,
  type Contexto,
  type EvidenciaPayload,
} from "./eventos-base";
import { diaDe } from "./tempo";
import { enfileirarTarefa } from "../servicos/fila";

const vazio = (s: string | null | undefined) => !s || s.trim() === "";
const MAX_FOTOS = 10;
/** Documentos em PDF (laudos, relatórios) anexados ao encerramento ou à interrupção, além das fotos. */
const MAX_PDFS = 5;
const CANCELAR_ATE_MS = 10 * 60_000;

/** Execução do evento, ainda em andamento e do usuário logado (ninguém encerra a execução de outro). */
async function carregarExecucaoDoUsuario(ctx: Contexto, id: string, opcoes: { aceitarFinalizada?: boolean } = {}) {
  const [e] = await ctx.tx.select().from(execucao).where(eq(execucao.id, id));
  if (!e) throw adiar("execucao_ausente", "A execução ainda não foi recebida");
  await carregarOsDoUsuario(ctx, e.osId);
  if (e.executorId !== ctx.usuario.id) throw rejeitar("execucao_de_outro", "Só quem iniciou a execução pode alterá-la");
  ctx.saida.osAfetadas.add(e.osId);
  if (e.resultado !== null && !opcoes.aceitarFinalizada) throw rejeitar("execucao_finalizada", "A execução já foi finalizada");
  return e;
}

/** Fecha a pausa aberta (se houver) no instante dado: encerrar, interromper ou suspender com o cronômetro em pausa. */
async function fecharPausaAberta(ctx: Contexto, execucaoId: string, fim: Date) {
  await ctx.tx.update(execucaoPausa).set({ fim }).where(and(eq(execucaoPausa.execucaoId, execucaoId), isNull(execucaoPausa.fim)));
}

const contar = (evidencias: EvidenciaPayload[]) => ({
  fotos: evidencias.filter((e) => e.tipo === "foto").length,
  pdfs: evidencias.filter((e) => e.tipo === "pdf").length,
});

/** Fotos e PDFs da execução: no máximo `MAX_FOTOS` fotos e `MAX_PDFS` PDFs. */
function conferirArquivos(evidencias: EvidenciaPayload[]) {
  const { fotos, pdfs } = contar(evidencias);
  if (fotos > MAX_FOTOS) throw rejeitar("fotos_demais", `No máximo ${MAX_FOTOS} fotos por execução`);
  if (pdfs > MAX_PDFS) throw rejeitar("pdfs_demais", `No máximo ${MAX_PDFS} documentos em PDF por execução`);
}

const gravarEvidencias = (ctx: Contexto, execucaoId: string, evidencias: EvidenciaPayload[]) =>
  evidencias.length === 0 ? Promise.resolve() : ctx.tx.insert(evidencia).values(evidencias.map((e) => linhaDeEvidencia(e, { execucaoId })));

// ---------------------------------------------------------------------------------------------------------------

const esquemaIniciada = z.object({ id: uuid, os_id: uuid.optional(), apr_id: uuid, numero_pessoas: z.number().int().min(1).optional(), inicio: instanteIso });

/** `execucao_iniciada`: exige a APR aprovada, do dia, da própria OS e ainda não usada (Decisão-chave 4). */
export async function aplicarExecucaoIniciada(ctx: Contexto, osIdEnvelope: string | null, bruto: unknown) {
  const p = lerPayload(esquemaIniciada, bruto);
  const osId = osIdEnvelope ?? p.os_id;
  if (!osId) throw rejeitar("os_obrigatoria", "Informe a OS da execução");

  const [jaExiste] = await ctx.tx.select({ id: execucao.id, osId: execucao.osId }).from(execucao).where(eq(execucao.id, p.id));
  if (jaExiste) {
    ctx.saida.osAfetadas.add(jaExiste.osId);
    return;
  }

  const { os: ordem, mudou } = await carregarOsDoUsuario(ctx, osId);
  ctx.saida.osAfetadas.add(ordem.id);

  const [a] = await ctx.tx.select().from(apr).where(eq(apr.id, p.apr_id));
  if (!a) throw adiar("apr_ausente", "A APR ainda não foi recebida");
  if (a.osId !== ordem.id || a.resultado !== "aprovada") throw rejeitar("apr_invalida", "Preencha a APR antes de iniciar");
  if (diaDe(a.concluidaEm) !== diaDe(p.inicio)) throw rejeitar("apr_vencida", "A APR é de outro dia: faça uma APR nova");
  const [participante] = await ctx.tx.select().from(aprParticipante).where(and(eq(aprParticipante.aprId, a.id), eq(aprParticipante.usuarioId, ctx.usuario.id)));
  if (!participante) throw rejeitar("fora_da_apr", "Você não é participante desta APR");
  const [usada] = await ctx.tx.select({ id: execucao.id }).from(execucao).where(and(eq(execucao.aprId, a.id), sql`${execucao.resultado} is distinct from 'cancelada'`));
  if (usada) throw rejeitar("apr_ja_usada", "Esta APR já amparou uma execução: faça uma APR nova");

  // Execução esquecida de outro dia: o técnico a suspende antes (ninguém a encerra sozinho).
  const minhasAbertas = await ctx.tx.select().from(execucao).where(and(eq(execucao.executorId, ctx.usuario.id), isNull(execucao.resultado)));
  if (minhasAbertas.some((e) => diaDe(e.inicio) !== diaDe(p.inicio))) throw rejeitar("execucao_esquecida", "Suspenda a execução de outro dia antes de iniciar uma nova");

  const abertasNaOs = (await ctx.tx.select({ id: execucao.id }).from(execucao).where(and(eq(execucao.osId, ordem.id), isNull(execucao.resultado)))).length;
  const jaEncerrada = ordem.status === "encerrada";
  if (!ctx.offline) {
    if (abertasNaOs > 0) throw rejeitar("os_em_execucao", "Esta OS já está em execução");
    if (jaEncerrada) throw rejeitar("os_encerrada", "Esta OS já foi encerrada");
  }

  const total = await ctx.tx.select({ n: sql<number>`count(*)::int` }).from(aprParticipante).where(eq(aprParticipante.aprId, a.id));
  await ctx.tx.insert(execucao).values({ id: p.id, osId: ordem.id, aprId: a.id, executorId: ctx.usuario.id, numeroPessoas: p.numero_pessoas ?? total[0]!.n, inicio: p.inicio });

  if (abertasNaOs > 0 || jaEncerrada) {
    ctx.saida.alertas.push(
      ...(await criarAlertas(ctx.tx, { tipo: "execucao_duplicada", osId: ordem.id, equipeId: ordem.equipeId, detalhe: `OS ${ordem.numeroOrdem ?? ordem.titulo}: mais de uma execução (${jaEncerrada ? "OS já encerrada" : "outra em andamento"})` })),
    );
  }
  if (mudou) await avisarConflitoDePlanejamento(ctx, ordem, "a execução começou depois que o planejamento mudou (equipe ou data)");
  if (ordem.status === "cancelada") await avisarConflitoDePlanejamento(ctx, ordem, "a execução começou numa OS cancelada");
}

// ---------------------------------------------------------------------------------------------------------------

const esquemaPausaIniciada = z.object({ id: uuid, execucao_id: uuid, inicio: instanteIso, motivo: z.enum(PAUSA_MOTIVOS).nullable().optional() });

export async function aplicarPausaIniciada(ctx: Contexto, bruto: unknown) {
  const p = lerPayload(esquemaPausaIniciada, bruto);
  const [jaExiste] = await ctx.tx.select({ id: execucaoPausa.id }).from(execucaoPausa).where(eq(execucaoPausa.id, p.id));
  if (jaExiste) return;
  const e = await carregarExecucaoDoUsuario(ctx, p.execucao_id);
  if (p.inicio < e.inicio) throw rejeitar("pausa_antes_do_inicio", "A pausa não pode começar antes da execução");
  const [aberta] = await ctx.tx.select({ id: execucaoPausa.id }).from(execucaoPausa).where(and(eq(execucaoPausa.execucaoId, e.id), isNull(execucaoPausa.fim)));
  if (aberta) throw rejeitar("pausa_aberta", "Já existe uma pausa aberta nesta execução");
  await ctx.tx.insert(execucaoPausa).values({ id: p.id, execucaoId: e.id, inicio: p.inicio, motivo: p.motivo ?? null });
}

const esquemaPausaEncerrada = z.object({ pausa_id: uuid, fim: instanteIso });

/** Continuar só vale na mesma execução, no mesmo dia e pelo mesmo usuário; senão é uma nova APR (Execução, tabela de estados). */
export async function aplicarPausaEncerrada(ctx: Contexto, bruto: unknown) {
  const p = lerPayload(esquemaPausaEncerrada, bruto);
  const [pausa] = await ctx.tx.select().from(execucaoPausa).where(eq(execucaoPausa.id, p.pausa_id));
  if (!pausa) throw adiar("pausa_ausente", "A pausa ainda não foi recebida");
  if (pausa.fim) return;
  await carregarExecucaoDoUsuario(ctx, pausa.execucaoId);
  if (p.fim < pausa.inicio) throw rejeitar("fim_antes_do_inicio", "O fim da pausa é anterior ao início");
  if (diaDe(pausa.inicio) !== diaDe(p.fim)) throw rejeitar("continuar_invalido", "Faça uma APR nova para retomar");
  await ctx.tx.update(execucaoPausa).set({ fim: p.fim }).where(eq(execucaoPausa.id, pausa.id));
}

// ---------------------------------------------------------------------------------------------------------------

const esquemaEncerrada = z.object({
  execucao_id: uuid,
  fim: instanteIso,
  descricao_atividade: z.string().nullable().optional(),
  /** Leituras do formulário de inspeção das preventivas (estrutura em aberto, questão 57). */
  dados_inspecao: z.unknown().optional(),
  evidencias: z.array(evidenciaPayload).default([]),
  assinaturas: z.array(z.object({ usuario_id: uuid, assinada_em: instanteIso.optional() })).default([]),
});

/**
 * `execucao_encerrada`: descrição, ao menos uma foto e a assinatura de todos os participantes da APR. Documentos em PDF
 * (laudo, relatório de medição) podem acompanhar as fotos, mas não as substituem.
 */
export async function aplicarExecucaoEncerrada(ctx: Contexto, bruto: unknown) {
  const p = lerPayload(esquemaEncerrada, bruto);
  const e = await carregarExecucaoDoUsuario(ctx, p.execucao_id, { aceitarFinalizada: true });
  if (e.resultado === "encerrada") return;
  if (e.resultado !== null) throw rejeitar("execucao_finalizada", "A execução já foi finalizada");
  if (p.fim < e.inicio) throw rejeitar("fim_antes_do_inicio", "O fim é anterior ao início da execução");

  const participantes = await ctx.tx.select({ usuarioId: aprParticipante.usuarioId, assinaturaPath: usuario.assinaturaPath, nome: usuario.nome }).from(aprParticipante).innerJoin(usuario, eq(usuario.id, aprParticipante.usuarioId)).where(eq(aprParticipante.aprId, e.aprId));
  const assinaram = new Set(p.assinaturas.map((a) => a.usuario_id));
  const todosAssinaram = participantes.every((x) => assinaram.has(x.usuarioId)) && p.assinaturas.every((a) => participantes.some((x) => x.usuarioId === a.usuario_id));
  if (vazio(p.descricao_atividade) || contar(p.evidencias).fotos === 0 || !todosAssinaram) {
    throw rejeitar("encerramento_incompleto", "Descrição, foto e assinaturas de todos são obrigatórias");
  }
  conferirArquivos(p.evidencias);
  const semAssinatura = participantes.find((x) => !x.assinaturaPath);
  if (semAssinatura) throw rejeitar("assinatura_ausente", `${semAssinatura.nome} ainda não cadastrou a assinatura no perfil`);
  await exigirArquivosDasEvidencias(ctx, p.evidencias);

  await fecharPausaAberta(ctx, e.id, p.fim);
  await ctx.tx.update(execucao).set({ fim: p.fim, resultado: "encerrada", descricaoAtividade: p.descricao_atividade!.trim(), dadosInspecao: p.dados_inspecao ?? null }).where(eq(execucao.id, e.id));
  await ctx.tx.insert(execucaoAssinatura).values(
    participantes.map((x) => ({ execucaoId: e.id, usuarioId: x.usuarioId, assinaturaPath: x.assinaturaPath!, assinadaEm: p.assinaturas.find((a) => a.usuario_id === x.usuarioId)?.assinada_em ?? p.fim })),
  );
  await gravarEvidencias(ctx, e.id, p.evidencias);

  const [ordem] = await ctx.tx.select().from(os).where(eq(os.id, e.osId));
  const [outra] = await ctx.tx.select({ id: execucao.id }).from(execucao).where(and(eq(execucao.osId, e.osId), eq(execucao.resultado, "encerrada"), ne(execucao.id, e.id)));
  if (outra) {
    // Vale a primeira encerrada; a segunda fica guardada com um alerta.
    ctx.saida.alertas.push(...(await criarAlertas(ctx.tx, { tipo: "execucao_duplicada", osId: e.osId, equipeId: ordem!.equipeId, detalhe: `OS ${ordem!.numeroOrdem ?? ordem!.titulo}: duas execuções encerradas; vale a primeira` })));
  } else {
    await enfileirarTarefa(ctx.tx, "pdf_os", e.osId);
  }

  // OS de apoio encerrada: a original continua pendente, mas o supervisor dela é avisado.
  if (ordem!.osOrigemId && !outra) {
    const [original] = await ctx.tx.select().from(os).where(eq(os.id, ordem!.osOrigemId));
    if (original) {
      ctx.saida.alertas.push(...(await criarAlertas(ctx.tx, { tipo: "apoio_encerrado", osId: original.id, equipeId: original.equipeId, detalhe: `A OS de apoio ${ordem!.numeroOrdem ?? ordem!.titulo} foi encerrada` })));
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------

const esquemaInterrompida = z.object({ execucao_id: uuid, fim: instanteIso, motivo: z.string().nullable().optional(), evidencias: z.array(evidenciaPayload).default([]) });

/**
 * `execucao_interrompida` (por risco): motivo e ao menos uma foto, com PDFs opcionais; a OS fica pendente e o supervisor
 * é avisado.
 */
export async function aplicarExecucaoInterrompida(ctx: Contexto, bruto: unknown) {
  const p = lerPayload(esquemaInterrompida, bruto);
  const e = await carregarExecucaoDoUsuario(ctx, p.execucao_id, { aceitarFinalizada: true });
  if (e.resultado === "interrompida") return;
  if (e.resultado !== null) throw rejeitar("execucao_finalizada", "A execução já foi finalizada");
  if (vazio(p.motivo) || contar(p.evidencias).fotos === 0) throw rejeitar("interrupcao_incompleta", "Motivo e ao menos uma foto são obrigatórios");
  if (p.fim < e.inicio) throw rejeitar("fim_antes_do_inicio", "O fim é anterior ao início da execução");
  conferirArquivos(p.evidencias);
  await exigirArquivosDasEvidencias(ctx, p.evidencias);

  await fecharPausaAberta(ctx, e.id, p.fim);
  await ctx.tx.update(execucao).set({ fim: p.fim, resultado: "interrompida", motivo: p.motivo!.trim() }).where(eq(execucao.id, e.id));
  await gravarEvidencias(ctx, e.id, p.evidencias);

  const [ordem] = await ctx.tx.select().from(os).where(eq(os.id, e.osId));
  ctx.saida.alertas.push(...(await criarAlertas(ctx.tx, { tipo: "bloqueio", osId: e.osId, equipeId: ordem!.equipeId, detalhe: `Execução interrompida por risco: ${p.motivo!.trim()}` })));
}

const esquemaSuspensa = z.object({ execucao_id: uuid, fim: instanteIso });

/** `execucao_suspensa` (fim do expediente): a OS fica pendente, sem alerta. */
export async function aplicarExecucaoSuspensa(ctx: Contexto, bruto: unknown) {
  const p = lerPayload(esquemaSuspensa, bruto);
  const e = await carregarExecucaoDoUsuario(ctx, p.execucao_id, { aceitarFinalizada: true });
  if (e.resultado === "suspensa") return;
  if (e.resultado !== null) throw rejeitar("execucao_finalizada", "A execução já foi finalizada");
  if (p.fim < e.inicio) throw rejeitar("fim_antes_do_inicio", "O fim é anterior ao início da execução");
  await fecharPausaAberta(ctx, e.id, p.fim);
  await ctx.tx.update(execucao).set({ fim: p.fim, resultado: "suspensa" }).where(eq(execucao.id, e.id));
}

const esquemaCancelada = z.object({ execucao_id: uuid });

/** `execucao_cancelada` por engano: até 10 minutos depois do início, sem foto nem pausa; devolve a APR para uso. */
export async function aplicarExecucaoCancelada(ctx: Contexto, bruto: unknown) {
  const p = lerPayload(esquemaCancelada, bruto);
  const e = await carregarExecucaoDoUsuario(ctx, p.execucao_id, { aceitarFinalizada: true });
  if (e.resultado === "cancelada") return;
  if (e.resultado !== null) throw rejeitar("execucao_finalizada", "A execução já foi finalizada");
  if (ctx.evento.ocorridoEm.getTime() - e.inicio.getTime() > CANCELAR_ATE_MS) throw rejeitar("cancelamento_fora_do_prazo", "Só dá para cancelar em até 10 minutos depois do início");
  const [pausa] = await ctx.tx.select({ id: execucaoPausa.id }).from(execucaoPausa).where(eq(execucaoPausa.execucaoId, e.id)).limit(1);
  const [foto] = await ctx.tx.select({ id: evidencia.id }).from(evidencia).where(eq(evidencia.execucaoId, e.id)).limit(1);
  if (pausa || foto) throw rejeitar("cancelamento_invalido", "Execução com pausa ou foto não pode ser cancelada");
  await ctx.tx.update(execucao).set({ fim: ctx.evento.ocorridoEm < e.inicio ? e.inicio : ctx.evento.ocorridoEm, resultado: "cancelada" }).where(eq(execucao.id, e.id));
}
