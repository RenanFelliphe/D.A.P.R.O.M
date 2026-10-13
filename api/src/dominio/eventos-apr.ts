import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/conexao";
import { APR_FUNCOES, APR_RESPOSTAS, APR_RESULTADOS, apr, aprParticipante, aprResposta, aprRisco, evidencia, execucao, itemModeloApr, modeloApr, riscoModeloApr, usuario } from "../db/schema";
import { instanteIso, uuid } from "../http/validacao";
import { criarAlertas } from "./alertas";
import { arquivoExigido } from "./evidencias";
import {
  avisarConflitoDePlanejamento,
  carregarOsDoUsuario,
  evidenciaPayload,
  exigirArquivosDasEvidencias,
  lerPayload,
  linhaDeEvidencia,
  rejeitar,
  type Contexto,
  type EvidenciaPayload,
} from "./eventos-base";

const esquemaApr = z.object({
  /** Id da APR, gerado no cliente. */
  id: uuid,
  os_id: uuid.optional(),
  /** Versão exata do modelo que foi respondida (Decisão-chave 6). */
  modelo_apr_id: uuid,
  participantes: z.array(z.object({ usuario_id: uuid, funcao: z.enum(APR_FUNCOES), assinada_em: instanteIso.optional() })).min(1),
  /** Riscos que a equipe marcou "( )": só as medidas deles são respondidas (questão 59). */
  riscos: z.array(uuid).default([]),
  respostas: z.array(z.object({ item_id: uuid, resposta: z.enum(APR_RESPOSTAS), observacao: z.string().nullable().optional(), respondida_em: instanteIso.optional() })),
  /** Fotos e PDFs dos itens reprovados. */
  evidencias: z.array(evidenciaPayload).default([]),
  observacao_geral: z.string().nullable().optional(),
  concluida_em: instanteIso,
  /** Só conferido: o servidor recalcula o resultado. */
  resultado: z.enum(APR_RESULTADOS).optional(),
});
type PayloadApr = z.infer<typeof esquemaApr>;

/**
 * Corpo de `POST /aprs/avaliar`: a APR inteira, menos as fotos (o técnico ainda não sabe o que reprovou). Se reprovar, é
 * com isto que a APR é registrada.
 */
export const esquemaAvaliacaoApr = esquemaApr.omit({ evidencias: true, resultado: true }).extend({ os_id: uuid });

const vazio = (s: string | null | undefined) => !s || s.trim() === "";

/** Item reprovado = eliminatório respondido com a resposta bloqueante. É o único lugar que decide isso. */
const reprovou = (item: { tipo: string; respostaBloqueante: string | null }, resposta: string | undefined) =>
  item.tipo === "eliminatorio" && item.respostaBloqueante !== null && resposta === item.respostaBloqueante;

/**
 * Confere a APR contra a OS, a equipe e o modelo, sem gravar nada, e diz quais itens reprovaram, na ordem do modelo. As
 * mesmas regras valem na validação (`POST /aprs/avaliar`) e no registro (`apr_concluida`), e todas são conferidas antes
 * do resultado: o que recusa a APR nunca depende de ela reprovar, então a recusa não revela o que é eliminatório.
 */
export async function conferirApr(ctx: Contexto, osId: string, p: Omit<PayloadApr, "evidencias" | "resultado">) {
  const { os: ordem, mudou } = await carregarOsDoUsuario(ctx, osId);

  // Conflitos de estado: online recusam; vindo da fila offline, aplicam e viram alerta (Decisão-chave 2).
  const abertas = (await ctx.tx.select({ resultado: execucao.resultado, executorId: execucao.executorId }).from(execucao).where(eq(execucao.osId, ordem.id))).filter((e) => e.resultado === null);
  if (abertas.length > 0 && !ctx.offline) throw rejeitar("os_em_execucao", "Esta OS já está em execução");
  if (ordem.status === "encerrada" && !ctx.offline) throw rejeitar("os_encerrada", "Esta OS já foi encerrada");

  const [modelo] = await ctx.tx.select().from(modeloApr).where(eq(modeloApr.id, p.modelo_apr_id));
  if (!modelo || !modelo.publicadoEm) throw rejeitar("modelo_invalido", "Modelo de APR inexistente ou não publicado");

  // Participantes: o técnico logado sempre participa, exatamente um responsável, só gente da equipe da OS.
  const ids = p.participantes.map((x) => x.usuario_id);
  if (new Set(ids).size !== ids.length) throw rejeitar("participante_repetido", "Participante repetido");
  if (!ids.includes(ctx.usuario.id)) throw rejeitar("participante_obrigatorio", "O técnico logado precisa ser participante da APR");
  if (p.participantes.filter((x) => x.funcao === "responsavel").length !== 1) throw rejeitar("responsavel_obrigatorio", "A APR precisa de exatamente um responsável");
  const pessoas = await ctx.tx.select().from(usuario).where(inArray(usuario.id, ids));
  if (pessoas.length !== ids.length) throw rejeitar("participante_invalido", "Participante não encontrado");
  const equipesAceitas = new Set([ordem.equipeId, ctx.usuario.equipeId]);
  for (const pessoa of pessoas) {
    if (!pessoa.equipeId || !equipesAceitas.has(pessoa.equipeId)) throw rejeitar("participante_fora_da_equipe", `${pessoa.nome} não é da equipe da OS`);
    if (!pessoa.assinaturaPath) throw rejeitar("assinatura_ausente", `${pessoa.nome} ainda não cadastrou a assinatura no perfil`);
  }

  // Riscos marcados e respostas precisam ser do modelo.
  const riscosDoModelo = await ctx.tx.select().from(riscoModeloApr).where(eq(riscoModeloApr.modeloAprId, modelo.id));
  const idsDeRisco = new Set(riscosDoModelo.map((r) => r.id));
  if (new Set(p.riscos).size !== p.riscos.length) throw rejeitar("risco_repetido", "Risco marcado repetido");
  if (p.riscos.some((r) => !idsDeRisco.has(r))) throw rejeitar("risco_invalido", "Risco que não pertence ao modelo da APR");
  const marcados = new Set(p.riscos);

  const itens = await ctx.tx.select().from(itemModeloApr).where(eq(itemModeloApr.modeloAprId, modelo.id));
  const itemPorId = new Map(itens.map((i) => [i.id, i]));
  const respostaPorItem = new Map<string, PayloadApr["respostas"][number]>();
  for (const r of p.respostas) {
    const item = itemPorId.get(r.item_id);
    if (!item) throw rejeitar("item_invalido", "Resposta a um item que não pertence ao modelo da APR");
    if (respostaPorItem.has(r.item_id)) throw rejeitar("resposta_repetida", "Item respondido mais de uma vez");
    if (item.secao === "medida_preventiva" && !marcados.has(item.riscoId!)) {
      throw rejeitar("resposta_fora_dos_riscos", "Resposta a uma medida de um risco que não foi marcado");
    }
    if (r.resposta === "na" && !item.permiteNa) throw rejeitar("na_nao_permitido", `"NA" não é permitido em: ${item.texto}`);
    if (r.resposta === "na" && vazio(r.observacao)) throw rejeitar("observacao_obrigatoria", `"NA" exige observação em: ${item.texto}`);
    respostaPorItem.set(r.item_id, r);
  }

  // A APR é respondida por inteiro: itens de verificação e medidas dos riscos marcados.
  const faltando = itens.filter((i) => (i.secao === "verificacao" || marcados.has(i.riscoId!)) && !respostaPorItem.has(i.id));
  if (faltando.length > 0) throw rejeitar("respostas_incompletas", `Faltam respostas em ${faltando.length} item(ns)`);

  const reprovados = itens.filter((i) => reprovou(i, respostaPorItem.get(i.id)?.resposta)).sort((a, b) => a.ordem - b.ordem);
  return { ordem, mudou, abertas, modelo, pessoas, respostaPorItem, reprovados };
}

/** Respostas gravadas de uma APR, com o item do modelo; `reprovado` diz se o item reprovou a APR. */
async function respostasGravadas(db: Db, aprId: string) {
  const linhas = await db
    .select({
      id: itemModeloApr.id,
      texto: itemModeloApr.texto,
      tipo: itemModeloApr.tipo,
      respostaBloqueante: itemModeloApr.respostaBloqueante,
      evidencia: itemModeloApr.evidencia,
      ordem: itemModeloApr.ordem,
      resposta: aprResposta.resposta,
      observacao: aprResposta.observacao,
    })
    .from(aprResposta)
    .innerJoin(itemModeloApr, eq(itemModeloApr.id, aprResposta.itemId))
    .where(eq(aprResposta.aprId, aprId));
  return linhas.sort((a, b) => a.ordem - b.ordem).map((l) => ({ ...l, reprovado: reprovou(l, l.resposta) }));
}

/** Os itens que reprovaram uma APR já gravada, na ordem do modelo. */
export const reprovadosDaAprGravada = async (db: Db, aprId: string) => (await respostasGravadas(db, aprId)).filter((r) => r.reprovado);

/** O item tem o arquivo que a evidência dele exige (foto ou PDF), entre os já gravados e os que chegaram agora? */
const temOArquivoExigido = (item: { id: string; evidencia: string }, arquivos: { itemId: string | null | undefined; tipo: string }[]) => {
  const exigido = arquivoExigido(item.evidencia);
  return exigido === null || arquivos.some((a) => a.itemId === item.id && a.tipo === exigido);
};
const doPayload = (evidencias: EvidenciaPayload[]) => evidencias.map((e) => ({ itemId: e.item_id, tipo: e.tipo }));

/**
 * Completa a APR bloqueada na validação com a evidência dos itens reprovados: a observação de cada um e os arquivos
 * (fotos e PDFs). As respostas não mudam, e a APR que já tem a evidência completa não aceita mais nada. Online, a
 * evidência precisa vir inteira; da fila offline, vale o que chegou.
 */
async function completarEvidencia(ctx: Contexto, aprId: string, p: PayloadApr) {
  const gravadas = await respostasGravadas(ctx.tx, aprId);
  const reprovados = gravadas.filter((r) => r.reprovado);
  const jaGravados = await ctx.tx.select({ itemId: evidencia.itemId, tipo: evidencia.tipo }).from(evidencia).where(eq(evidencia.aprId, aprId));
  const completo = (r: (typeof reprovados)[number], observacao: string | null | undefined, novos: EvidenciaPayload[] = []) =>
    !vazio(observacao) && temOArquivoExigido(r, [...jaGravados, ...doPayload(novos)]);
  if (reprovados.every((r) => completo(r, r.observacao))) return;

  for (const e of p.evidencias) {
    if (!e.item_id || !gravadas.some((r) => r.id === e.item_id)) throw rejeitar("evidencia_invalida", "Evidência ligada a um item que a APR não respondeu");
  }
  const observacaoEnviada = new Map(p.respostas.map((r) => [r.item_id, r.observacao]));
  const observacaoDe = (r: (typeof reprovados)[number]) => (vazio(r.observacao) ? observacaoEnviada.get(r.id) : r.observacao);
  const semEvidencia = reprovados.filter((r) => !completo(r, observacaoDe(r), p.evidencias));
  if (semEvidencia.length > 0 && !ctx.offline) throw rejeitar("evidencia_faltando", `Falta evidência em ${semEvidencia.length} item(ns)`);
  await exigirArquivosDasEvidencias(ctx, p.evidencias);

  for (const r of reprovados) {
    const texto = observacaoEnviada.get(r.id);
    if (vazio(r.observacao) && !vazio(texto)) {
      await ctx.tx.update(aprResposta).set({ observacao: texto!.trim() }).where(and(eq(aprResposta.aprId, aprId), eq(aprResposta.itemId, r.id)));
    }
  }
  if (p.evidencias.length > 0) {
    await ctx.tx
      .insert(evidencia)
      .values(p.evidencias.map((e) => linhaDeEvidencia(e, { aprId, itemId: e.item_id! })))
      .onConflictDoNothing();
  }
}

/**
 * `apr_concluida`: grava a APR inteira (participantes, riscos, respostas, fotos), recalcula o resultado a partir das
 * respostas e do modelo, e, se bloqueada, avisa o supervisor. O servidor não confia no `resultado` do aparelho. Para a
 * APR que já foi bloqueada na validação, só traz a evidência dos itens reprovados.
 */
export async function aplicarAprConcluida(ctx: Contexto, osIdEnvelope: string | null, bruto: unknown) {
  const p = lerPayload(esquemaApr, bruto);
  const osId = osIdEnvelope ?? p.os_id;
  if (!osId) throw rejeitar("os_obrigatoria", "Informe a OS da APR");
  if (p.os_id && p.os_id !== osId) throw rejeitar("os_divergente", "A OS do evento difere da OS do payload");

  // A mesma APR já gravada (evento reenviado com outro id, ou a APR bloqueada na validação): as respostas não mudam; a
  // bloqueada recebe a evidência de quem a preencheu.
  const [existente] = await ctx.tx.select({ id: apr.id, resultado: apr.resultado, osId: apr.osId, preenchidaPor: apr.preenchidaPor }).from(apr).where(eq(apr.id, p.id));
  if (existente) {
    if (existente.resultado === "bloqueada" && existente.preenchidaPor === ctx.usuario.id) await completarEvidencia(ctx, existente.id, p);
    ctx.saida.aprs.push({ id: existente.id, resultado: existente.resultado });
    ctx.saida.osAfetadas.add(existente.osId);
    return;
  }

  const { ordem, mudou, abertas, modelo, pessoas, respostaPorItem, reprovados } = await conferirApr(ctx, osId, p);
  ctx.saida.osAfetadas.add(ordem.id);

  // Item reprovado: exige observação e, se o item pede foto ou PDF, ao menos um arquivo desse tipo. O aparelho só conhece
  // os reprovados depois de `POST /aprs/avaliar`, que já registra a APR bloqueada sem a evidência (ela chega depois); o
  // que veio da fila offline não pôde perguntar, então a APR vale mesmo sem a evidência.
  for (const e of p.evidencias) {
    if (!e.item_id || !respostaPorItem.has(e.item_id)) throw rejeitar("evidencia_invalida", "Evidência ligada a um item que a APR não respondeu");
  }
  const arquivos = doPayload(p.evidencias);
  const semEvidencia = reprovados.filter((i) => vazio(respostaPorItem.get(i.id)!.observacao) || !temOArquivoExigido(i, arquivos));
  if (semEvidencia.length > 0 && !ctx.offline && !ctx.evidenciaDepois) throw rejeitar("evidencia_faltando", `Falta evidência em ${semEvidencia.length} item(ns)`);
  await exigirArquivosDasEvidencias(ctx, p.evidencias);

  const resultado = reprovados.length > 0 ? "bloqueada" : "aprovada";

  await ctx.tx.insert(apr).values({
    id: p.id,
    osId: ordem.id,
    modeloAprId: modelo.id,
    preenchidaPor: ctx.usuario.id,
    resultado,
    observacaoGeral: vazio(p.observacao_geral) ? null : p.observacao_geral!.trim(),
    concluidaEm: p.concluida_em,
  });
  await ctx.tx.insert(aprParticipante).values(
    p.participantes.map((x) => ({
      aprId: p.id,
      usuarioId: x.usuario_id,
      funcao: x.funcao,
      assinaturaPath: pessoas.find((u) => u.id === x.usuario_id)!.assinaturaPath!,
      assinadaEm: x.assinada_em ?? p.concluida_em,
    })),
  );
  if (p.riscos.length > 0) await ctx.tx.insert(aprRisco).values(p.riscos.map((riscoId) => ({ aprId: p.id, riscoId })));
  if (p.respostas.length > 0) {
    await ctx.tx.insert(aprResposta).values(
      p.respostas.map((r) => ({ aprId: p.id, itemId: r.item_id, resposta: r.resposta, observacao: vazio(r.observacao) ? null : r.observacao!.trim(), respondidaEm: r.respondida_em ?? p.concluida_em })),
    );
  }
  if (p.evidencias.length > 0) {
    await ctx.tx.insert(evidencia).values(p.evidencias.map((e) => linhaDeEvidencia(e, { aprId: p.id, itemId: e.item_id! })));
  }
  ctx.saida.aprs.push({ id: p.id, resultado });

  if (resultado === "bloqueada") {
    const detalhe = reprovados
      .map((i) => {
        const observacao = respostaPorItem.get(i.id)!.observacao?.trim();
        return observacao ? `${i.texto} — ${observacao}` : i.texto;
      })
      .join("; ");
    ctx.saida.alertas.push(
      ...(await criarAlertas(ctx.tx, { tipo: "bloqueio", osId: ordem.id, equipeId: ordem.equipeId, detalhe: `APR bloqueada (${reprovados.length} item(ns) reprovado(s)): ${detalhe}` })),
    );
  }
  if (mudou) await avisarConflitoDePlanejamento(ctx, ordem, "a APR foi aplicada depois que o planejamento mudou (equipe ou data)");
  if (ordem.status === "cancelada") await avisarConflitoDePlanejamento(ctx, ordem, "a APR foi aplicada numa OS cancelada");
  if (abertas.length > 0 || ordem.status === "encerrada") {
    ctx.saida.alertas.push(...(await criarAlertas(ctx.tx, { tipo: "execucao_duplicada", osId: ordem.id, equipeId: ordem.equipeId, detalhe: `OS ${ordem.numeroOrdem ?? ordem.titulo}: APR registrada enquanto a OS já estava ${abertas.length > 0 ? "em execução" : "encerrada"}` })));
  }
}
