import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { APR_FUNCOES, APR_RESPOSTAS, APR_RESULTADOS, apr, aprParticipante, aprResposta, aprRisco, evidencia, execucao, itemModeloApr, modeloApr, riscoModeloApr, usuario } from "../db/schema";
import { instanteIso, uuid } from "../http/validacao";
import { criarAlertas } from "./alertas";
import { avisarConflitoDePlanejamento, carregarOsDoUsuario, evidenciaPayload, exigirArquivo, lerPayload, rejeitar, type Contexto } from "./eventos-base";

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
  /** Fotos dos itens reprovados. */
  evidencias: z.array(evidenciaPayload).default([]),
  observacao_geral: z.string().nullable().optional(),
  concluida_em: instanteIso,
  /** Só conferido: o servidor recalcula o resultado. */
  resultado: z.enum(APR_RESULTADOS).optional(),
});

const vazio = (s: string | null | undefined) => !s || s.trim() === "";

/**
 * `apr_concluida`: grava a APR inteira (participantes, riscos, respostas, fotos), recalcula o resultado a partir das
 * respostas e do modelo, e, se bloqueada, avisa o supervisor. O servidor não confia no `resultado` do aparelho.
 */
export async function aplicarAprConcluida(ctx: Contexto, osIdEnvelope: string | null, bruto: unknown) {
  const p = lerPayload(esquemaApr, bruto);
  const osId = osIdEnvelope ?? p.os_id;
  if (!osId) throw rejeitar("os_obrigatoria", "Informe a OS da APR");
  if (p.os_id && p.os_id !== osId) throw rejeitar("os_divergente", "A OS do evento difere da OS do payload");

  // A mesma APR já gravada (evento reenviado com outro id): nada a fazer.
  const [existente] = await ctx.tx.select({ id: apr.id, resultado: apr.resultado, osId: apr.osId }).from(apr).where(eq(apr.id, p.id));
  if (existente) {
    ctx.saida.aprs.push({ id: existente.id, resultado: existente.resultado });
    ctx.saida.osAfetadas.add(existente.osId);
    return;
  }

  const { os: ordem, mudou } = await carregarOsDoUsuario(ctx, osId);
  ctx.saida.osAfetadas.add(ordem.id);

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
  const respostaPorItem = new Map<string, (typeof p.respostas)[number]>();
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

  // Item reprovado = eliminatório com a resposta bloqueante: exige observação e, se o item pede foto, ao menos uma.
  const reprovados = itens.filter((i) => i.tipo === "eliminatorio" && respostaPorItem.get(i.id)?.resposta === i.respostaBloqueante);
  for (const e of p.evidencias) {
    if (!e.item_id || !respostaPorItem.has(e.item_id)) throw rejeitar("evidencia_invalida", "Foto ligada a um item que a APR não respondeu");
  }
  const semEvidencia = reprovados.filter(
    (i) => vazio(respostaPorItem.get(i.id)!.observacao) || (i.evidencia === "foto" && !p.evidencias.some((e) => e.item_id === i.id)),
  );
  if (semEvidencia.length > 0) throw rejeitar("evidencia_faltando", `Falta evidência em ${semEvidencia.length} item(ns)`);
  for (const e of p.evidencias) await exigirArquivo(ctx, "fotos", e.arquivo_id ?? e.id);

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
    await ctx.tx.insert(evidencia).values(
      p.evidencias.map((e) => ({ id: e.id, aprId: p.id, itemId: e.item_id!, fotoPath: e.arquivo_id ?? e.id, capturadaEm: e.capturada_em, latitude: e.latitude ?? null, longitude: e.longitude ?? null })),
    );
  }
  ctx.saida.aprs.push({ id: p.id, resultado });

  if (resultado === "bloqueada") {
    const detalhe = reprovados.map((i) => `${i.texto} — ${respostaPorItem.get(i.id)!.observacao?.trim()}`).join("; ");
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
