import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/conexao";
import { APR_FUNCOES, APR_RESPOSTAS, APR_RESULTADOS, apr, aprParticipante, aprResposta, aprRisco, evidencia, execucao, itemModeloApr, modeloApr, os, riscoModeloApr, usuario } from "../db/schema";
import { instanteIso, uuid } from "../http/validacao";
import { criarAlertas, criarAviso } from "./alertas";
import { fecharConvitesDaApr, MENSAGEM_DO_PROBLEMA_DE_CONVITE, problemasDeConvite } from "./apr-convites";
import { MIN_PARTICIPANTES, participantesDaApr, resolverAvisoDeAssinatura, situacaoDasAssinaturas } from "./apr-assinaturas";
import { ausentesEm } from "./ausencia";
import { esquemaClimaRegistrado, gravarClimaDaApr } from "./clima-registro";
import { arquivoExigido } from "./evidencias";
import { executouAteOFim } from "./status-os";
import { diaDe } from "./tempo";
import { pontuarApr } from "./pontuacao";
import {
  adiar,
  avisarConflitoDePlanejamento,
  carregarOsDoUsuario,
  conferirReserva,
  contextoDePontos,
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
  /** Versão exata do modelo que foi respondida (decisão-chave 6, `docs/especificacao.md`, seção 2.6). */
  modelo_apr_id: uuid,
  participantes: z.array(z.object({ usuario_id: uuid, funcao: z.enum(APR_FUNCOES), assinada_em: instanteIso.optional() })).min(1),
  /**
   * Padrão (`false`): a APR é registrada e cada participante a assina depois, na própria conta (`apr_assinada`); a execução só
   * começa com a assinatura de todos. Modo offline (contingência): `true` = os participantes assinaram no aparelho do responsável,
   * e as assinaturas do perfil são copiadas já, marcadas como presenciais (`assinada_em` de cada um, se vier).
   */
  assinatura_presencial: z.boolean().default(false),
  /** Riscos que a equipe marcou "( )": só as medidas deles são respondidas (`pendencias.md`, pergunta 59). */
  riscos: z.array(uuid).default([]),
  respostas: z.array(z.object({ item_id: uuid, resposta: z.enum(APR_RESPOSTAS), observacao: z.string().nullable().optional(), respondida_em: instanteIso.optional() })),
  /** Fotos e PDFs dos itens reprovados. */
  evidencias: z.array(evidenciaPayload).default([]),
  observacao_geral: z.string().nullable().optional(),
  /** A previsão do tempo que a pessoa viu na pergunta de clima (`shared/api/clima.ts`): só informativa, vai para o relatório. */
  clima: esquemaClimaRegistrado.nullish(),
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
  const desvio = await conferirReserva(ctx, ordem);

  // Conflitos de estado: online recusam; vindo da fila offline, aplicam e viram alerta (decisão-chave 2, `docs/especificacao.md`, seção 2.2).
  const abertas = (await ctx.tx.select({ resultado: execucao.resultado, executorId: execucao.executorId }).from(execucao).where(eq(execucao.osId, ordem.id))).filter((e) => e.resultado === null);
  if (abertas.length > 0 && !ctx.offline) throw rejeitar("os_em_execucao", "Esta OS já está em execução");
  if (executouAteOFim(ordem.status) && !ctx.offline) throw rejeitar("os_encerrada", "Esta OS já foi encerrada");

  const [modelo] = await ctx.tx.select().from(modeloApr).where(eq(modeloApr.id, p.modelo_apr_id));
  if (!modelo || !modelo.publicadoEm) throw rejeitar("modelo_invalido", "Modelo de APR inexistente ou não publicado");

  // Participantes: o técnico logado sempre participa, exatamente um responsável, só gente da equipe da OS. Ninguém trabalha
  // sozinho: a APR exige ao menos 2 participantes, sem máximo.
  const ids = p.participantes.map((x) => x.usuario_id);
  if (new Set(ids).size !== ids.length) throw rejeitar("participante_repetido", "Participante repetido");
  if (ids.length < MIN_PARTICIPANTES) throw rejeitar("participantes_insuficientes", `A APR precisa de ao menos ${MIN_PARTICIPANTES} participantes: ninguém executa o serviço sozinho`);
  if (!ids.includes(ctx.usuario.id)) throw rejeitar("participante_obrigatorio", "O técnico logado precisa ser participante da APR");
  if (p.participantes.filter((x) => x.funcao === "responsavel").length !== 1) throw rejeitar("responsavel_obrigatorio", "A APR precisa de exatamente um responsável");
  const pessoas = await ctx.tx.select().from(usuario).where(inArray(usuario.id, ids));
  if (pessoas.length !== ids.length) throw rejeitar("participante_invalido", "Participante não encontrado");
  const equipesAceitas = new Set([ordem.equipeId, ctx.usuario.equipeId]);
  // O ausente não entra em APR (vale a ausência na hora do evento: a fila offline traz eventos de antes do início).
  const ausentes = await ausentesEm(ctx.tx, ids, diaDe(ctx.evento.ocorridoEm));
  for (const pessoa of pessoas) {
    if (ausentes.has(pessoa.id)) throw rejeitar("participante_ausente", `${pessoa.nome} está ausente e não pode entrar na APR`);
    if (!pessoa.ativo || pessoa.liberacao !== "liberado") throw rejeitar("participante_inativo", `${pessoa.nome} está desligado ou sem acesso e não pode entrar na APR`);
    if (!pessoa.equipeId || !equipesAceitas.has(pessoa.equipeId)) throw rejeitar("participante_fora_da_equipe", `${pessoa.nome} não é da equipe da OS`);
    if (!pessoa.assinaturaPath) throw rejeitar("assinatura_ausente", `${pessoa.nome} ainda não cadastrou a assinatura no perfil`);
  }
  // Quem o responsável convidou precisa ter aceitado. Sem sinal não há convite (o aparelho não podia convidar), então a fila offline não é cobrada.
  if (!ctx.offline) {
    const [problema] = await problemasDeConvite(ctx.tx, ordem.id, ctx.usuario.id, ids, ctx.recebidoEm);
    if (problema) throw rejeitar(problema.codigo, MENSAGEM_DO_PROBLEMA_DE_CONVITE[problema.codigo](problema.nome));
  }

  // Riscos marcados e respostas precisam ser do modelo.
  const riscosDoModelo = await ctx.tx.select().from(riscoModeloApr).where(eq(riscoModeloApr.modeloAprId, modelo.id));
  const idsDeRisco = new Set(riscosDoModelo.map((r) => r.id));
  if (new Set(p.riscos).size !== p.riscos.length) throw rejeitar("risco_repetido", "Risco marcado repetido");
  if (p.riscos.some((r) => !idsDeRisco.has(r))) throw rejeitar("risco_invalido", "Risco que não pertence ao modelo da APR");
  const marcados = new Set(p.riscos);
  // Na OS reservada, o responsável da APR é a pessoa designada pelo supervisor.
  const responsavelDaApr = p.participantes.find((x) => x.funcao === "responsavel")!.usuario_id;
  let divergencia = desvio;
  if (ordem.responsavelId && responsavelDaApr !== ordem.responsavelId) {
    if (!ctx.offline) throw rejeitar("responsavel_reservado", "Esta OS está reservada: o responsável da APR é a pessoa que o supervisor designou");
    divergencia ??= "o responsável da APR não era o responsável reservado da OS";
  }

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
  return { ordem, mudou, desvio: divergencia, abertas, modelo, pessoas, respostaPorItem, reprovados, itens };
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

/** A APR bloqueada já tem a evidência de todos os itens reprovados (a observação e, se o item pede, a foto ou o PDF)? A pontuação espera por isso. */
export async function aprEstaCompleta(db: Db, aprId: string): Promise<boolean> {
  const reprovados = (await respostasGravadas(db, aprId)).filter((r) => r.reprovado);
  const arquivos = await db.select({ itemId: evidencia.itemId, tipo: evidencia.tipo }).from(evidencia).where(eq(evidencia.aprId, aprId));
  return reprovados.every((r) => !vazio(r.observacao) && temOArquivoExigido(r, arquivos));
}

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
  // A evidência completa é o que faz a APR bloqueada pontuar (sem ela, os pontos esperam).
  ctx.saida.ganhos.push(...(await pontuarApr(contextoDePontos(ctx), aprId, ctx.evento.ocorridoEm, { evidenciaCompleta: await aprEstaCompleta(ctx.tx, aprId) })));
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

  const { ordem, mudou, desvio, abertas, modelo, pessoas, respostaPorItem, reprovados, itens } = await conferirApr(ctx, osId, p);
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

  // Previsão de risco extremo e a pergunta de clima respondida "Sim": a pessoa pode seguir (a previsão é regional e é só uma
  // probabilidade), mas com a foto do local, que prova o tempo no ponto do serviço. Offline não dá para exigir (como a evidência).
  const perguntaDeClima = itens.find((i) => i.mostrarClima);
  const climaExtremoSeguido = resultado === "aprovada" && p.clima?.nivel === "extremo" && !!perguntaDeClima && respostaPorItem.get(perguntaDeClima.id)?.resposta === "sim";
  if (climaExtremoSeguido && !ctx.offline && !ctx.evidenciaDepois && !p.evidencias.some((e) => e.item_id === perguntaDeClima!.id && e.tipo === "foto")) {
    throw rejeitar("foto_do_clima_faltando", "Com risco climático extremo previsto, a APR só segue com a foto do local");
  }

  await ctx.tx.insert(apr).values({
    id: p.id,
    osId: ordem.id,
    modeloAprId: modelo.id,
    preenchidaPor: ctx.usuario.id,
    resultado,
    observacaoGeral: vazio(p.observacao_geral) ? null : p.observacao_geral!.trim(),
    concluidaEm: p.concluida_em,
  });
  // As assinaturas: na conta de cada um, depois (padrão), ou já copiadas, no aparelho do responsável (offline). A APR bloqueada não é assinada.
  const presencial = p.assinatura_presencial && resultado === "aprovada";
  await ctx.tx.insert(aprParticipante).values(
    p.participantes.map((x) => ({
      aprId: p.id,
      usuarioId: x.usuario_id,
      funcao: x.funcao,
      assinaturaPath: presencial ? pessoas.find((u) => u.id === x.usuario_id)!.assinaturaPath! : null,
      assinadaEm: presencial ? (x.assinada_em ?? p.concluida_em) : null,
      assinaturaPresencial: presencial,
    })),
  );
  // Os convites aceitos viram parte da APR; os que sobraram (de quem ficou de fora) são desfeitos.
  await fecharConvitesDaApr(ctx.tx, { osId: ordem.id, responsavelId: ctx.usuario.id, aprId: p.id, participantes: p.participantes.map((x) => x.usuario_id), agora: ctx.recebidoEm });
  if (p.riscos.length > 0) await ctx.tx.insert(aprRisco).values(p.riscos.map((riscoId) => ({ aprId: p.id, riscoId })));
  if (p.respostas.length > 0) {
    await ctx.tx.insert(aprResposta).values(
      p.respostas.map((r) => ({ aprId: p.id, itemId: r.item_id, resposta: r.resposta, observacao: vazio(r.observacao) ? null : r.observacao!.trim(), respondidaEm: r.respondida_em ?? p.concluida_em })),
    );
  }
  if (p.evidencias.length > 0) {
    await ctx.tx.insert(evidencia).values(p.evidencias.map((e) => linhaDeEvidencia(e, { aprId: p.id, itemId: e.item_id! })));
  }
  if (p.clima) await gravarClimaDaApr(ctx.tx, p.id, ctx.usuario.id, p.clima);
  ctx.saida.aprs.push({ id: p.id, resultado });
  // A aprovada pontua quando todos assinaram (já aqui, se as assinaturas vieram presenciais; senão, na última `apr_assinada`); a
  // bloqueada, quando chega a evidência dos itens reprovados.
  if (resultado === "bloqueada" || presencial) {
    ctx.saida.ganhos.push(
      ...(await pontuarApr(contextoDePontos(ctx), p.id, ctx.evento.ocorridoEm, { evidenciaCompleta: resultado === "aprovada" || (await aprEstaCompleta(ctx.tx, p.id)) })),
    );
  }
  if (resultado === "aprovada" && !presencial) {
    // Cada um assina na própria conta: os demais participantes recebem o aviso (só no sino).
    await criarAviso(ctx.tx, p.participantes.map((x) => x.usuario_id).filter((id) => id !== ctx.usuario.id), {
      tipo: "apr_para_assinar",
      osId: ordem.id,
      detalhe: `${ctx.usuario.nome} registrou a APR da OS ${ordem.numeroOrdem ?? ordem.titulo} e aguarda a sua assinatura para começar a execução.`,
      agora: ctx.recebidoEm,
    });
  }

  if (resultado === "bloqueada") {
    const itens = reprovados.map((i) => {
      const observacao = respostaPorItem.get(i.id)!.observacao?.trim();
      return observacao ? `${i.texto} — ${observacao}` : i.texto;
    });
    ctx.saida.alertas.push(
      ...(await criarAlertas(ctx.tx, { tipo: "bloqueio", osId: ordem.id, equipeId: ordem.equipeId, detalhe: `APR bloqueada (${reprovados.length} item(ns) reprovado(s)): ${itens.join("; ")}` })),
    );
  }
  if (climaExtremoSeguido) {
    ctx.saida.alertas.push(
      ...(await criarAlertas(ctx.tx, {
        tipo: "clima_extremo",
        osId: ordem.id,
        equipeId: ordem.equipeId,
        detalhe: `OS ${ordem.numeroOrdem ?? ordem.titulo}: ${ctx.usuario.nome} registrou a APR com risco climático extremo previsto (${p.clima!.titulo}) e respondeu que o clima estava favorável. A foto do local está na APR. ${p.clima!.orientacao}`,
        agora: ctx.recebidoEm,
      })),
    );
  }
  if (mudou) await avisarConflitoDePlanejamento(ctx, ordem, "a APR foi aplicada depois que o planejamento mudou (equipe ou data)");
  if (ordem.status === "cancelada") await avisarConflitoDePlanejamento(ctx, ordem, "a APR foi aplicada numa OS cancelada");
  if (desvio) await avisarConflitoDePlanejamento(ctx, ordem, `a APR foi aplicada, mas ${desvio}`);
  if (abertas.length > 0 || executouAteOFim(ordem.status)) {
    ctx.saida.alertas.push(...(await criarAlertas(ctx.tx, { tipo: "execucao_duplicada", osId: ordem.id, equipeId: ordem.equipeId, detalhe: `OS ${ordem.numeroOrdem ?? ordem.titulo}: APR registrada enquanto a OS já estava ${abertas.length > 0 ? "em execução" : "encerrada"}` })));
  }
}

// ---------------------------------------------------------------------------------------------------------------

const esquemaAssinada = z.object({ apr_id: uuid, assinada_em: instanteIso.optional() });

/** A APR e o participante que age, para assinar ou recusar; a APR que ainda não chegou deixa o evento pendente. */
async function carregarParticipante(ctx: Contexto, aprId: string) {
  const [a] = await ctx.tx.select({ id: apr.id, osId: apr.osId, resultado: apr.resultado, concluidaEm: apr.concluidaEm }).from(apr).where(eq(apr.id, aprId));
  if (!a) throw adiar("apr_ausente", "A APR ainda não foi recebida");
  ctx.saida.osAfetadas.add(a.osId);
  const [participante] = await ctx.tx.select().from(aprParticipante).where(and(eq(aprParticipante.aprId, a.id), eq(aprParticipante.usuarioId, ctx.usuario.id)));
  if (!participante) throw rejeitar("fora_da_apr", "Você não é participante desta APR");
  if (a.resultado !== "aprovada") throw rejeitar("apr_bloqueada", "Esta APR foi bloqueada: não há o que assinar");
  const [usada] = await ctx.tx.select({ id: execucao.id }).from(execucao).where(and(eq(execucao.aprId, a.id), sql`${execucao.resultado} is distinct from 'cancelada'`));
  return { apr: a, participante, usada: Boolean(usada) };
}

/**
 * `apr_assinada`: o participante assina a APR na própria conta, com a assinatura do perfil, depois da validação (Reunião 3). A
 * execução só começa quando todos os participantes assinaram. A assinatura só vale no dia da APR; reenviar não muda nada.
 */
export async function aplicarAprAssinada(ctx: Contexto, bruto: unknown) {
  const p = lerPayload(esquemaAssinada, bruto);
  const { apr: a, participante } = await carregarParticipante(ctx, p.apr_id);
  ctx.saida.aprs.push({ id: a.id, resultado: a.resultado });
  if (participante.recusouEm) throw rejeitar("apr_recusada_por_voce", "Você recusou esta APR e saiu dela");
  if (participante.assinadaEm) return;
  if (diaDe(a.concluidaEm) !== diaDe(ctx.evento.ocorridoEm)) throw rejeitar("apr_vencida", "A APR é de outro dia: faça uma APR nova");
  if (!ctx.usuario.assinaturaPath) throw rejeitar("assinatura_ausente", "Cadastre a sua assinatura no perfil antes de assinar");

  const quando = p.assinada_em ?? ctx.evento.ocorridoEm;
  await ctx.tx
    .update(aprParticipante)
    .set({ assinaturaPath: ctx.usuario.assinaturaPath, assinadaEm: quando })
    .where(and(eq(aprParticipante.aprId, a.id), eq(aprParticipante.usuarioId, ctx.usuario.id)));
  await resolverAvisoDeAssinatura(ctx.tx, ctx.usuario.id, a.osId, ctx.recebidoEm);

  // A última assinatura completa a APR: é aí que ela pontua (a APR completa e a responsabilidade por ela).
  const situacao = situacaoDasAssinaturas(await participantesDaApr(ctx.tx, a.id));
  if (situacao.pronta) ctx.saida.ganhos.push(...(await pontuarApr(contextoDePontos(ctx), a.id, ctx.evento.ocorridoEm, { evidenciaCompleta: true })));
}

const esquemaRecusada = z.object({ apr_id: uuid, motivo: z.string().nullable().optional(), recusada_em: instanteIso.optional() });

/**
 * `apr_recusada`: o direito de recusa. O participante que não concorda com a APR sai dela, deixando o motivo, e o supervisor é
 * avisado na hora (sino e e-mail). Se sobrarem menos de 2 participantes, ou se quem recusou foi o responsável, a APR não
 * serve mais: é preciso uma nova. Só vale antes de a execução começar e para quem ainda não assinou.
 */
export async function aplicarAprRecusada(ctx: Contexto, bruto: unknown) {
  const p = lerPayload(esquemaRecusada, bruto);
  const { apr: a, participante, usada } = await carregarParticipante(ctx, p.apr_id);
  ctx.saida.aprs.push({ id: a.id, resultado: a.resultado });
  if (participante.recusouEm) return;
  if (vazio(p.motivo)) throw rejeitar("motivo_obrigatorio", "Diga por que você recusa a APR");
  if (participante.assinadaEm) throw rejeitar("ja_assinou", "Você já assinou esta APR");
  if (usada) throw rejeitar("apr_ja_usada", "A execução desta APR já começou");

  await ctx.tx
    .update(aprParticipante)
    .set({ recusouEm: p.recusada_em ?? ctx.evento.ocorridoEm, recusaMotivo: p.motivo!.trim() })
    .where(and(eq(aprParticipante.aprId, a.id), eq(aprParticipante.usuarioId, ctx.usuario.id)));
  await resolverAvisoDeAssinatura(ctx.tx, ctx.usuario.id, a.osId, ctx.recebidoEm);

  const situacao = situacaoDasAssinaturas(await participantesDaApr(ctx.tx, a.id));
  const [ordem] = await ctx.tx.select().from(os).where(eq(os.id, a.osId));
  const consequencia = situacao.responsavelRecusou
    ? "o responsável recusou: é preciso uma APR nova"
    : situacao.semParticipantes
      ? `restam menos de ${MIN_PARTICIPANTES} participantes: é preciso uma APR nova`
      : "a APR segue com os demais participantes";
  ctx.saida.alertas.push(
    ...(await criarAlertas(ctx.tx, {
      tipo: "direito_de_recusa",
      osId: a.osId,
      equipeId: ordem!.equipeId,
      detalhe: `OS ${ordem!.numeroOrdem ?? ordem!.titulo}: ${ctx.usuario.nome} exerceu o direito de recusa na APR — "${p.motivo!.trim()}". Ele saiu da APR; ${consequencia}.`,
      agora: ctx.recebidoEm,
    })),
  );
}
