import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { PAUSA_MOTIVOS, SUSPENSAO_MOTIVOS, apr, aprParticipante, eventoCampo, evidencia, execucao, execucaoAssinatura, execucaoPausa, os } from "../db/schema";
import { instanteIso, uuid } from "../http/validacao";
import { criarAlertas } from "./alertas";
import { participantesDaApr, situacaoDasAssinaturas } from "./apr-assinaturas";
import { esquemaClimaRegistrado, gravarClimaDaExecucao } from "./clima-registro";
import { MAX_OBSERVACAO_DO_ITEM, checklistsDasOs, type DadosDeInspecao, type ItemRespondido } from "./checklist-inspecao";
import {
  avisarConflitoDePlanejamento,
  carregarOsDoUsuario,
  conferirReserva,
  contextoDePontos,
  evidenciaPayload,
  exigirArquivosDasEvidencias,
  lerPayload,
  lerPosicao,
  linhaDeEvidencia,
  posicaoPayload,
  rejeitar,
  rejeitarOuVersao,
  resolverExecucaoId,
  adiar,
  EventoComoVersao,
  type Contexto,
  type EvidenciaPayload,
} from "./eventos-base";
import { avisarOResponsavel, avisarSaude, conferirMotivo, executarEncerramento, executarSuspensao, fecharPausaAberta, participaDaApr, quemEncerrou, tornarPedidoObsoleto, type Execucao, type PapelNaExecucao } from "./execucao-acoes";
import { aplicarPedidoAberto, aplicarPedidoApoiado, aplicarPedidoCancelado, aplicarPedidoDecidido, fecharPedidosVencidosDaExecucao } from "./pedidos-execucao";
import { ROTULO_DA_PAUSA, ehMotivoDeSaude } from "./motivos-de-parada";
import { pontuarExecucao } from "./pontuacao";
import { executouAteOFim } from "./status-os";
import { diaDe } from "./tempo";
import { enfileirarTarefa } from "../servicos/fila";

const vazio = (s: string | null | undefined) => !s || s.trim() === "";
const MAX_FOTOS = 10;
/** Documentos em PDF (laudos, relatórios) anexados ao encerramento ou à interrupção, além das fotos. */
const MAX_PDFS = 5;
const CANCELAR_ATE_MS = 10 * 60_000;

/** A assinatura do perfil de quem interrompe por risco ou cancela por engano, copiada para a execução; sem ela o evento é recusado (o `autenticar` já exige o cadastro). */
function assinarEvento(ctx: Contexto): string {
  if (!ctx.usuario.assinaturaPath) throw rejeitar("assinatura_ausente", "Cadastre a sua assinatura no perfil antes de assinar");
  return ctx.usuario.assinaturaPath;
}

/**
 * A execução do evento e o papel de quem age sobre ela (execução compartilhada): o responsável (quem a iniciou) ou outro participante da
 * APR que não recusou; ninguém mais mexe nela. Antes de ler, fecha os pedidos vencidos da execução (o que passou dos 2 minutos já valeu).
 * `so` restringe a ação: `responsavel` (cancelar, decidir um pedido) ou `quem_encerrou` (assinar o encerramento).
 */
export async function carregarExecucaoParaAgir(ctx: Contexto, idDoAparelho: string, opcoes: { aceitarFinalizada?: boolean; so?: "responsavel" | "quem_encerrou" } = {}): Promise<{ e: Execucao; papel: PapelNaExecucao }> {
  // O id que o aparelho cita pode ser o de uma execução que ele iniciou e que ficou como versão da execução de outro aparelho.
  const id = await resolverExecucaoId(ctx.tx, idDoAparelho);
  const [antes] = await ctx.tx.select().from(execucao).where(eq(execucao.id, id));
  if (!antes) throw adiar("execucao_ausente", "A execução ainda não foi recebida");
  await carregarOsDoUsuario(ctx, antes.osId);
  await fecharPedidosVencidosDaExecucao(ctx, id);
  const [e] = await ctx.tx.select().from(execucao).where(eq(execucao.id, id));
  ctx.saida.osAfetadas.add(e!.osId);
  const papel: PapelNaExecucao | null = e!.executorId === ctx.usuario.id ? "responsavel" : (await participaDaApr(ctx.tx, e!.aprId, ctx.usuario.id)) ? "participante" : null;
  if (!papel) throw rejeitar("execucao_de_outro", "Só quem participa da APR da execução pode agir sobre ela");
  if (opcoes.so === "responsavel" && papel !== "responsavel") throw rejeitar("so_o_responsavel", "Só quem iniciou a execução pode fazer isto");
  if (opcoes.so === "quem_encerrou" && quemEncerrou(e!) !== ctx.usuario.id) throw rejeitar("encerramento_de_outro", "Só quem encerrou a OS assina o encerramento");
  if (e!.resultado !== null && !opcoes.aceitarFinalizada) throw rejeitarOuVersao(ctx, "execucao_finalizada", "A execução já foi finalizada");
  return { e: e!, papel };
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

const esquemaIniciada = z.object({ id: uuid, os_id: uuid.optional(), apr_id: uuid, numero_pessoas: z.number().int().min(1).optional(), inicio: instanteIso, ...posicaoPayload });

/**
 * `execucao_iniciada`: exige a APR aprovada, do dia, da própria OS e ainda não usada (decisão-chave 4, `docs/especificacao.md`, seção 2.4), assinada por todos os
 * participantes que ficaram nela (cada um na própria conta; no offline, presencial), com ao menos 2 participantes e o responsável.
 * Grava a localização do início, se o aparelho deu.
 */
export async function aplicarExecucaoIniciada(ctx: Contexto, osIdEnvelope: string | null, bruto: unknown) {
  const p = lerPayload(esquemaIniciada, bruto);
  const osId = osIdEnvelope ?? p.os_id;
  if (!osId) throw rejeitar("os_obrigatoria", "Informe a OS da execução");

  const [jaExiste] = await ctx.tx.select({ id: execucao.id, osId: execucao.osId }).from(execucao).where(eq(execucao.id, p.id));
  if (jaExiste) {
    ctx.saida.osAfetadas.add(jaExiste.osId);
    return;
  }

  const posicao = lerPosicao(p);
  const { os: ordem, mudou } = await carregarOsDoUsuario(ctx, osId);
  ctx.saida.osAfetadas.add(ordem.id);
  const desvio = await conferirReserva(ctx, ordem);

  const [a] = await ctx.tx.select().from(apr).where(eq(apr.id, p.apr_id));
  if (!a) throw adiar("apr_ausente", "A APR ainda não foi recebida");
  // Sem sinal o aparelho não valida a APR (só o servidor sabe o que bloqueia): a execução feita assim não pode se perder (decisão-chave 2, `docs/especificacao.md`, seção 2.2).
  // Vinda da fila e amparada por uma APR do próprio técnico que o servidor bloqueou, ela é aplicada e vira alerta ao supervisor.
  const bloqueadaSemSinal = ctx.offline && a.resultado === "bloqueada" && a.preenchidaPor === ctx.usuario.id;
  if (a.osId !== ordem.id || (a.resultado !== "aprovada" && !bloqueadaSemSinal)) throw rejeitar("apr_invalida", "Preencha a APR antes de iniciar");
  if (diaDe(a.concluidaEm) !== diaDe(p.inicio)) throw rejeitar("apr_vencida", "A APR é de outro dia: faça uma APR nova");
  const [participante] = await ctx.tx.select().from(aprParticipante).where(and(eq(aprParticipante.aprId, a.id), eq(aprParticipante.usuarioId, ctx.usuario.id)));
  if (!participante || participante.recusouEm) throw rejeitar("fora_da_apr", participante ? "Você saiu desta APR (direito de recusa)" : "Você não é participante desta APR");
  const situacao = situacaoDasAssinaturas(await participantesDaApr(ctx.tx, a.id));
  if (situacao.responsavelRecusou || situacao.semParticipantes) {
    throw rejeitar("apr_sem_participantes", situacao.responsavelRecusou ? "O responsável recusou a APR: faça uma APR nova" : "A APR ficou com menos de 2 participantes: faça uma APR nova");
  }
  // A APR bloqueada não é assinada: não há assinatura a esperar.
  if (situacao.faltam.length > 0 && !bloqueadaSemSinal) {
    // No offline a assinatura de outro aparelho ainda pode chegar: o evento espera. Online, é a equipe que precisa assinar.
    const mensagem = `Faltam as assinaturas da APR: ${situacao.faltam.map((x) => x.nome).join(", ")}`;
    throw ctx.offline ? adiar("apr_sem_assinaturas", mensagem) : rejeitar("apr_sem_assinaturas", mensagem);
  }
  const [usada] = await ctx.tx
    .select({ id: execucao.id, executorId: execucao.executorId })
    .from(execucao)
    .where(and(eq(execucao.aprId, a.id), sql`${execucao.resultado} is distinct from 'cancelada'`));
  if (usada) {
    // Sem sinal, outro participante da APR também registrou a execução no aparelho dele: é a versão dele da mesma execução (a conferência
    // compara depois), não uma execução nova. Os eventos seguintes dele citam o id local e chegam à execução certa (`resolverExecucaoId`).
    if (ctx.offline && usada.executorId !== ctx.usuario.id) {
      ctx.saida.osAfetadas.add(ordem.id);
      throw new EventoComoVersao(usada.id);
    }
    throw rejeitar("apr_ja_usada", "Esta APR já amparou uma execução: faça uma APR nova");
  }

  // Execução esquecida de outro dia: o técnico a suspende antes (ninguém a encerra sozinho).
  const minhasAbertas = await ctx.tx.select().from(execucao).where(and(eq(execucao.executorId, ctx.usuario.id), isNull(execucao.resultado)));
  if (minhasAbertas.some((e) => diaDe(e.inicio) !== diaDe(p.inicio))) throw rejeitar("execucao_esquecida", "Suspenda a execução de outro dia antes de iniciar uma nova");

  const abertasNaOs = (await ctx.tx.select({ id: execucao.id }).from(execucao).where(and(eq(execucao.osId, ordem.id), isNull(execucao.resultado)))).length;
  const jaEncerrada = executouAteOFim(ordem.status);
  if (!ctx.offline) {
    if (abertasNaOs > 0) throw rejeitar("os_em_execucao", "Esta OS já está em execução");
    if (jaEncerrada) throw rejeitar("os_encerrada", "Esta OS já foi encerrada");
  }

  await ctx.tx.insert(execucao).values({
    id: p.id,
    osId: ordem.id,
    aprId: a.id,
    executorId: ctx.usuario.id,
    numeroPessoas: p.numero_pessoas ?? situacao.ativos.length,
    inicio: p.inicio,
    inicioLatitude: posicao.latitude,
    inicioLongitude: posicao.longitude,
  });

  if (bloqueadaSemSinal) {
    ctx.saida.alertas.push(
      ...(await criarAlertas(ctx.tx, {
        tipo: "bloqueio",
        osId: ordem.id,
        equipeId: ordem.equipeId,
        detalhe: `OS ${ordem.numeroOrdem ?? ordem.titulo}: ${ctx.usuario.nome} executou o serviço sem sinal, com uma APR que o servidor bloqueou ao recebê-la. A APR não pôde ser validada no aparelho; confira a execução.`,
        agora: ctx.recebidoEm,
      })),
    );
  }
  if (abertasNaOs > 0 || jaEncerrada) {
    ctx.saida.alertas.push(
      ...(await criarAlertas(ctx.tx, { tipo: "execucao_duplicada", osId: ordem.id, equipeId: ordem.equipeId, detalhe: `OS ${ordem.numeroOrdem ?? ordem.titulo}: mais de uma execução (${jaEncerrada ? "OS já encerrada" : "outra em andamento"})` })),
    );
  }
  if (mudou) await avisarConflitoDePlanejamento(ctx, ordem, "a execução começou depois que o planejamento mudou (equipe ou data)");
  if (ordem.status === "cancelada") await avisarConflitoDePlanejamento(ctx, ordem, "a execução começou numa OS cancelada");
  if (desvio) await avisarConflitoDePlanejamento(ctx, ordem, `a execução começou, mas ${desvio}`);
}

// ---------------------------------------------------------------------------------------------------------------

const esquemaPausaIniciada = z.object({
  id: uuid,
  execucao_id: uuid,
  inicio: instanteIso,
  motivo: z.enum(PAUSA_MOTIVOS).nullable().optional(),
  complemento: z.string().max(500).nullable().optional(),
  ...posicaoPayload,
});

/**
 * `pausa_iniciada`: só o tempo líquido para; a equipe volta ao mesmo serviço no mesmo dia. O motivo é obrigatório (almoço,
 * aguardando, descanso, condição climática, enfermidade, lesão, outro), com o complemento em "aguardando" e "outro", e a
 * localização é gravada. Lesão e enfermidade avisam o supervisor na hora.
 */
export async function aplicarPausaIniciada(ctx: Contexto, bruto: unknown) {
  const p = lerPayload(esquemaPausaIniciada, bruto);
  const [jaExiste] = await ctx.tx.select({ id: execucaoPausa.id }).from(execucaoPausa).where(eq(execucaoPausa.id, p.id));
  if (jaExiste) return;
  const complemento = conferirMotivo(p.motivo, p.complemento, "pausa");
  const posicao = lerPosicao(p);
  const { e } = await carregarExecucaoParaAgir(ctx, p.execucao_id);
  if (p.inicio < e.inicio) throw rejeitarOuVersao(ctx, "pausa_antes_do_inicio", "A pausa não pode começar antes da execução");
  const [aberta] = await ctx.tx.select({ id: execucaoPausa.id }).from(execucaoPausa).where(and(eq(execucaoPausa.execucaoId, e.id), isNull(execucaoPausa.fim)));
  if (aberta) throw rejeitarOuVersao(ctx, "pausa_aberta", "Já existe uma pausa aberta nesta execução");
  await ctx.tx.insert(execucaoPausa).values({ id: p.id, execucaoId: e.id, inicio: p.inicio, motivo: p.motivo!, complemento, latitude: posicao.latitude, longitude: posicao.longitude, iniciadaPor: ctx.usuario.id });
  if (ehMotivoDeSaude(p.motivo)) await avisarSaude(ctx, { osId: e.osId, quem: ctx.usuario.nome, quando: "pausou", motivo: p.motivo, complemento });
  await avisarOResponsavel(ctx, e, ctx.usuario, `pausou a execução (${ROTULO_DA_PAUSA[p.motivo!]}${complemento ? `: ${complemento}` : ""})`);
}

const esquemaPausaEncerrada = z.object({ pausa_id: uuid, fim: instanteIso });

/** Continuar só vale na mesma execução e no mesmo dia (senão é uma nova APR); qualquer participante da APR continua (Execução, tabela de estados). */
export async function aplicarPausaEncerrada(ctx: Contexto, bruto: unknown) {
  const p = lerPayload(esquemaPausaEncerrada, bruto);
  const [pausa] = await ctx.tx.select().from(execucaoPausa).where(eq(execucaoPausa.id, p.pausa_id));
  if (!pausa) {
    // A pausa que este aparelho abriu pode ter ficado como versão (outra estava aberta): o fim dela também.
    const [daVersao] = await ctx.tx
      .select({ execucaoId: eventoCampo.execucaoId })
      .from(eventoCampo)
      .where(and(eq(eventoCampo.tipo, "pausa_iniciada"), eq(eventoCampo.soVersao, true), sql`${eventoCampo.payload}->>'id' = ${p.pausa_id}`));
    if (daVersao?.execucaoId) throw new EventoComoVersao(daVersao.execucaoId);
    throw adiar("pausa_ausente", "A pausa ainda não foi recebida");
  }
  if (pausa.fim) return;
  const { e } = await carregarExecucaoParaAgir(ctx, pausa.execucaoId);
  if (p.fim < pausa.inicio) throw rejeitar("fim_antes_do_inicio", "O fim da pausa é anterior ao início");
  if (diaDe(pausa.inicio) !== diaDe(p.fim)) throw rejeitar("continuar_invalido", "Faça uma APR nova para retomar");
  await ctx.tx.update(execucaoPausa).set({ fim: p.fim, encerradaPor: ctx.usuario.id }).where(eq(execucaoPausa.id, pausa.id));
  await avisarOResponsavel(ctx, e, ctx.usuario, "retomou a execução");
}

// ---------------------------------------------------------------------------------------------------------------

/** As respostas do checklist de inspeção, por pergunta; o texto da pergunta quem copia é o servidor. */
const esquemaInspecao = z.object({
  itens: z.array(z.object({ pergunta_id: uuid, marcado: z.boolean(), observacao: z.string().trim().max(MAX_OBSERVACAO_DO_ITEM).nullable().optional() })),
});

/**
 * O checklist de inspeção do encerramento de uma OS preventiva cujo plano tem perguntas. O servidor confere as respostas com o
 * checklist atual do plano: toda pergunta precisa de resposta (`checklist_incompleto`) e a não marcada pede observação
 * (`observacao_obrigatoria`); a pergunta marcada aceita observação opcional. Da fila offline o aparelho decidiu sem conhecer o
 * que mudou, então a pergunta sem resposta é aceita e fica registrada como não respondida. Devolve o que a execução guarda
 * (a pergunta é copiada como estava) e os itens não marcados, que avisam o supervisor. Sem checklist no plano, o
 * `dados_inspecao` segue como veio.
 */
async function conferirInspecao(ctx: Contexto, ordem: typeof os.$inferSelect, bruto: unknown): Promise<{ dados: unknown; naoMarcados: ItemRespondido[] }> {
  const perguntas = (await checklistsDasOs(ctx.tx, [ordem])).get(ordem.id);
  if (!perguntas) return { dados: bruto ?? null, naoMarcados: [] };
  const enviado = bruto == null ? null : lerPayload(esquemaInspecao, bruto);
  const respostas = new Map<string, z.infer<typeof esquemaInspecao>["itens"][number]>();
  for (const item of enviado?.itens ?? []) if (!respostas.has(item.pergunta_id)) respostas.set(item.pergunta_id, item);

  const itens: ItemRespondido[] = perguntas.map((p) => {
    const r = respostas.get(p.id);
    if (!r) {
      if (!ctx.offline) throw rejeitar("checklist_incompleto", `Responda todas as perguntas do checklist de inspeção (falta: "${p.texto}")`);
      return { pergunta: p.texto, marcado: null, observacao: null };
    }
    const observacao = r.observacao?.trim() || null;
    if (!r.marcado && !observacao) throw rejeitar("observacao_obrigatoria", `Explique na observação o item não marcado: "${p.texto}"`);
    return { pergunta: p.texto, marcado: r.marcado, observacao };
  });
  const dados: DadosDeInspecao = { itens };
  return { dados, naoMarcados: itens.filter((i) => i.marcado === false) };
}

/** O aviso do sino: a OS, o plano e cada item não marcado com a observação. */
function detalheDaInspecao(ordem: typeof os.$inferSelect, naoMarcados: ItemRespondido[]): string {
  const plano = [ordem.planoManutencao, ordem.itemManutencao].filter(Boolean);
  const onde = plano.length > 0 ? ` (plano ${ordem.planoManutencao}${ordem.itemManutencao ? `, item ${ordem.itemManutencao}` : ""})` : "";
  const itens = naoMarcados.map((i) => `"${i.pergunta}": ${i.observacao}`).join("; ");
  return `OS ${ordem.numeroOrdem ?? ordem.titulo}${onde}: inspeção encerrada com ${naoMarcados.length === 1 ? "1 item não marcado" : `${naoMarcados.length} itens não marcados`}. ${itens}`;
}

/**
 * O fim que veio sem sinal, de um aparelho, para uma execução que outro já finalizou (encerrou, suspendeu ou interrompeu): é a versão
 * dele do fim, não um segundo fim. A execução canônica não muda; a conferência compara depois. Com sinal, o conflito continua como sempre.
 */
const jaFinalizadaPorOutroAparelho = (ctx: Contexto, e: Execucao) => ctx.offline && e.resultado !== null && e.resultado !== "cancelada" && quemEncerrou(e) !== ctx.usuario.id;

const esquemaEncerrada = z.object({ execucao_id: uuid, fim: instanteIso, ...posicaoPayload });

/**
 * `execucao_encerrada`: o clique em "Encerrar OS", depois da confirmação. Grava o fim, a localização e quem encerrou, e o tempo para ali:
 * o que vem depois (a descrição, as fotos, o checklist e a assinatura) não entra no tempo, e a execução não retoma. A OS fica
 * `encerrando` até **quem encerrou** assinar (`encerramento_assinado`). O responsável encerra na hora; o outro participante, com sinal,
 * pede ao responsável (`pedido_aberto`); sem sinal, encerra na hora (a conferência resolve depois). Duas execuções encerradas na mesma OS
 * (a fila offline) são guardadas, com um alerta; vale a primeira.
 */
export async function aplicarExecucaoEncerrada(ctx: Contexto, bruto: unknown) {
  const p = lerPayload(esquemaEncerrada, bruto);
  const { e, papel } = await carregarExecucaoParaAgir(ctx, p.execucao_id, { aceitarFinalizada: true });
  if (jaFinalizadaPorOutroAparelho(ctx, e)) throw new EventoComoVersao();
  if (e.resultado === "encerrada") return;
  if (e.resultado !== null) throw rejeitar("execucao_finalizada", "A execução já foi finalizada");
  if (papel === "participante" && !ctx.offline) throw rejeitar("pedido_necessario", "Peça ao responsável pela execução para encerrar a OS");
  if (p.fim < e.inicio) throw rejeitarOuVersao(ctx, "fim_antes_do_inicio", "O fim é anterior ao início da execução");
  await executarEncerramento(ctx, e, { fim: p.fim, posicao: lerPosicao(p), autorId: ctx.usuario.id });
  await avisarOResponsavel(ctx, e, ctx.usuario, "encerrou a OS sem sinal");
}

/**
 * O encerramento preenchido sem sinal por quem encerrou a OS no aparelho dele, quando outro aparelho já tinha encerrado a execução
 * (o `execucao_encerrada` dele ficou como versão): as fotos e os PDFs somam à execução e a descrição preenche o que está em branco; a
 * assinatura é de quem a execução canônica diz que encerrou. O resto fica no evento, para a conferência. Devolve se tratou o evento.
 */
async function somarEncerramentoDeOutroAparelho(ctx: Contexto, p: z.infer<typeof esquemaEncerramentoAssinado>): Promise<boolean> {
  if (!ctx.offline) return false;
  const id = await resolverExecucaoId(ctx.tx, p.execucao_id);
  const [e] = await ctx.tx.select().from(execucao).where(eq(execucao.id, id));
  if (!e || e.resultado !== "encerrada" || quemEncerrou(e) === ctx.usuario.id) return false;
  const [fimDele] = await ctx.tx
    .select({ id: eventoCampo.id })
    .from(eventoCampo)
    .where(and(eq(eventoCampo.usuarioId, ctx.usuario.id), eq(eventoCampo.execucaoId, id), eq(eventoCampo.soVersao, true), inArray(eventoCampo.tipo, ["execucao_encerrada", "pedido_aberto"])))
    .limit(1);
  if (!fimDele) return false;
  conferirArquivos(p.evidencias);
  await exigirArquivosDasEvidencias(ctx, p.evidencias);
  await gravarEvidencias(ctx, e.id, p.evidencias);
  if (vazio(e.descricaoAtividade) && !vazio(p.descricao_atividade)) await ctx.tx.update(execucao).set({ descricaoAtividade: p.descricao_atividade!.trim() }).where(eq(execucao.id, e.id));
  ctx.saida.osAfetadas.add(e.osId);
  ctx.saida.soVersao = true;
  ctx.saida.execucaoId = e.id;
  return true;
}

const esquemaEncerramentoAssinado = z.object({
  execucao_id: uuid,
  assinada_em: instanteIso.optional(),
  /** Opcional: só vale registrar quando aconteceu algo. Em branco, o PDF diz "Executado conforme a OS, sem ocorrências". */
  descricao_atividade: z.string().nullable().optional(),
  /** O checklist de inspeção das preventivas (`{ itens: [{ pergunta_id, marcado, observacao? }] }`); sem checklist no plano, segue como veio. */
  dados_inspecao: z.unknown().optional(),
  /** Fotos e PDFs, opcionais. */
  evidencias: z.array(evidenciaPayload).default([]),
  /** A previsão do tempo no encerramento (`shared/api/clima.ts`): só informativa, vai para o relatório. */
  clima: esquemaClimaRegistrado.nullish(),
});

/**
 * `encerramento_assinado`: depois do fim, o responsável pela execução preenche o encerramento (descrição e fotos, ambas
 * opcionais) e o assina com a assinatura do perfil dele; os demais participantes já assinaram a APR, no começo. A OS preventiva cujo
 * plano tem checklist de inspeção só encerra com ele respondido (`conferirInspecao`); item não marcado não bloqueia, avisa o
 * supervisor. A OS passa a `aguardando_supervisor` e o supervisor é avisado: ele lê o relatório da execução e assina por último.
 * É aqui que a execução pontua.
 */
export async function aplicarEncerramentoAssinado(ctx: Contexto, bruto: unknown) {
  const p = lerPayload(esquemaEncerramentoAssinado, bruto);
  if (await somarEncerramentoDeOutroAparelho(ctx, p)) return;
  const { e } = await carregarExecucaoParaAgir(ctx, p.execucao_id, { aceitarFinalizada: true, so: "quem_encerrou" });
  if (e.resultado !== "encerrada") throw rejeitar("execucao_nao_encerrada", "Clique em Encerrar OS antes de assinar o encerramento");
  if (e.encerramentoAssinadoEm) return;
  conferirArquivos(p.evidencias);

  const [ordem] = await ctx.tx.select().from(os).where(eq(os.id, e.osId));
  const inspecao = await conferirInspecao(ctx, ordem!, p.dados_inspecao);
  await exigirArquivosDasEvidencias(ctx, p.evidencias);
  const assinaturaPath = assinarEvento(ctx);

  // A assinatura nunca antecede o fim da execução (o relógio do aparelho pode estar adiantado ou atrasado).
  const pedida = p.assinada_em ?? ctx.evento.ocorridoEm;
  const quando = pedida < e.fim! ? e.fim! : pedida;
  await ctx.tx
    .update(execucao)
    .set({ descricaoAtividade: vazio(p.descricao_atividade) ? null : p.descricao_atividade!.trim(), dadosInspecao: inspecao.dados, encerramentoAssinadoEm: quando })
    .where(eq(execucao.id, e.id));
  await ctx.tx.insert(execucaoAssinatura).values({ execucaoId: e.id, usuarioId: ctx.usuario.id, assinaturaPath, assinadaEm: quando });
  await gravarEvidencias(ctx, e.id, p.evidencias);
  if (p.clima) await gravarClimaDaExecucao(ctx.tx, e.id, ctx.usuario.id, p.clima);

  // Vale a primeira encerrada e assinada; a segunda (duplicada) fica guardada, sem pontuar.
  const [outraAssinada] = await ctx.tx
    .select({ id: execucao.id })
    .from(execucao)
    .where(and(eq(execucao.osId, e.osId), eq(execucao.resultado, "encerrada"), ne(execucao.id, e.id), sql`${execucao.encerramentoAssinadoEm} is not null`));
  if (!outraAssinada) {
    ctx.saida.ganhos.push(...(await pontuarExecucao(contextoDePontos(ctx), e.id, e.fim!)));
    ctx.saida.alertas.push(
      ...(await criarAlertas(ctx.tx, {
        tipo: "os_para_assinar",
        osId: e.osId,
        equipeId: ordem!.equipeId,
        detalhe: `OS ${ordem!.numeroOrdem ?? ordem!.titulo} encerrada por ${ctx.usuario.nome}: leia o relatório da execução e assine para concluir a OS.`,
        agora: ctx.recebidoEm,
      })),
    );
  }

  if (inspecao.naoMarcados.length > 0) {
    ctx.saida.alertas.push(...(await criarAlertas(ctx.tx, { tipo: "inspecao_com_pendencia", osId: e.osId, equipeId: ordem!.equipeId, detalhe: detalheDaInspecao(ordem!, inspecao.naoMarcados) })));
  }

  // OS de apoio encerrada: a original continua pendente, mas o supervisor dela é avisado.
  if (ordem!.osOrigemId && !outraAssinada) {
    const [original] = await ctx.tx.select().from(os).where(eq(os.id, ordem!.osOrigemId));
    if (original) {
      ctx.saida.alertas.push(...(await criarAlertas(ctx.tx, { tipo: "apoio_encerrado", osId: original.id, equipeId: original.equipeId, detalhe: `A OS de apoio ${ordem!.numeroOrdem ?? ordem!.titulo} foi encerrada` })));
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------

const esquemaInterrompida = z.object({ execucao_id: uuid, fim: instanteIso, motivo: z.string().nullable().optional(), evidencias: z.array(evidenciaPayload).default([]), ...posicaoPayload });

/**
 * `execucao_interrompida` (por risco): motivo, ao menos uma foto (a prova do risco, com PDFs opcionais) e a assinatura; grava a
 * localização. A OS fica pendente e o supervisor é avisado.
 */
export async function aplicarExecucaoInterrompida(ctx: Contexto, bruto: unknown) {
  const p = lerPayload(esquemaInterrompida, bruto);
  const { e } = await carregarExecucaoParaAgir(ctx, p.execucao_id, { aceitarFinalizada: true });
  if (jaFinalizadaPorOutroAparelho(ctx, e)) throw new EventoComoVersao();
  if (e.resultado === "interrompida") return;
  if (e.resultado !== null) throw rejeitar("execucao_finalizada", "A execução já foi finalizada");
  if (vazio(p.motivo) || contar(p.evidencias).fotos === 0) throw rejeitar("interrupcao_incompleta", "Motivo e ao menos uma foto são obrigatórios");
  if (p.fim < e.inicio) throw rejeitarOuVersao(ctx, "fim_antes_do_inicio", "O fim é anterior ao início da execução");
  const posicao = lerPosicao(p);
  conferirArquivos(p.evidencias);
  await exigirArquivosDasEvidencias(ctx, p.evidencias);

  await fecharPausaAberta(ctx, e.id, p.fim, ctx.usuario.id);
  await ctx.tx
    .update(execucao)
    .set({ fim: p.fim, resultado: "interrompida", finalizadaPor: ctx.usuario.id, motivo: p.motivo!.trim(), assinaturaDoResultadoPath: assinarEvento(ctx), fimLatitude: posicao.latitude, fimLongitude: posicao.longitude })
    .where(eq(execucao.id, e.id));
  await tornarPedidoObsoleto(ctx, e.id);
  await gravarEvidencias(ctx, e.id, p.evidencias);
  await avisarOResponsavel(ctx, e, ctx.usuario, `interrompeu a execução por risco: ${p.motivo!.trim()}`);

  const [ordem] = await ctx.tx.select().from(os).where(eq(os.id, e.osId));
  ctx.saida.alertas.push(...(await criarAlertas(ctx.tx, { tipo: "bloqueio", osId: e.osId, equipeId: ordem!.equipeId, detalhe: `Execução interrompida por risco: ${p.motivo!.trim()}` })));
  // Interromper por risco vale o mesmo que encerrar: a segurança não custa pontos.
  ctx.saida.ganhos.push(...(await pontuarExecucao(contextoDePontos(ctx), e.id, p.fim)));
}

const esquemaSuspensa = z.object({
  execucao_id: uuid,
  fim: instanteIso,
  motivo: z.enum(SUSPENSAO_MOTIVOS).nullable().optional(),
  complemento: z.string().max(500).nullable().optional(),
  ...posicaoPayload,
});

/**
 * `execucao_suspensa`: o serviço não continua hoje. Encerra esta execução, a OS fica pendente e a retomada pede uma APR nova. O
 * motivo é obrigatório (enfermidade, lesão, fim de expediente, condição climática, falta de material ou equipamento, outro, com a
 * descrição) e a localização é gravada. Lesão e enfermidade avisam o supervisor na hora. O responsável suspende na hora; o outro
 * participante, na hora só por lesão ou enfermidade (a saúde não espera) ou sem sinal; nos demais motivos, com sinal, pede ao responsável.
 */
export async function aplicarExecucaoSuspensa(ctx: Contexto, bruto: unknown) {
  const p = lerPayload(esquemaSuspensa, bruto);
  const { e, papel } = await carregarExecucaoParaAgir(ctx, p.execucao_id, { aceitarFinalizada: true });
  if (jaFinalizadaPorOutroAparelho(ctx, e)) throw new EventoComoVersao();
  if (e.resultado === "suspensa") return;
  if (e.resultado !== null) throw rejeitar("execucao_finalizada", "A execução já foi finalizada");
  if (papel === "participante" && !ctx.offline && !ehMotivoDeSaude(p.motivo)) throw rejeitar("pedido_necessario", "Peça ao responsável pela execução para suspendê-la");
  if (p.fim < e.inicio) throw rejeitarOuVersao(ctx, "fim_antes_do_inicio", "O fim é anterior ao início da execução");
  const complemento = conferirMotivo(p.motivo, p.complemento, "suspensão");
  const posicao = lerPosicao(p);
  await executarSuspensao(ctx, e, { fim: p.fim, motivo: p.motivo!, complemento, posicao, autorId: ctx.usuario.id });
  if (ehMotivoDeSaude(p.motivo)) await avisarSaude(ctx, { osId: e.osId, quem: ctx.usuario.nome, quando: "suspendeu", motivo: p.motivo, complemento });
  await avisarOResponsavel(ctx, e, ctx.usuario, "suspendeu a execução");
}

const esquemaCancelada = z.object({ execucao_id: uuid });

/** `execucao_cancelada` por engano: até 10 minutos depois do início, sem foto nem pausa; devolve a APR para uso. */
export async function aplicarExecucaoCancelada(ctx: Contexto, bruto: unknown) {
  const p = lerPayload(esquemaCancelada, bruto);
  const { e } = await carregarExecucaoParaAgir(ctx, p.execucao_id, { aceitarFinalizada: true, so: "responsavel" });
  if (e.resultado === "cancelada") return;
  if (e.resultado !== null) throw rejeitar("execucao_finalizada", "A execução já foi finalizada");
  if (ctx.evento.ocorridoEm.getTime() - e.inicio.getTime() > CANCELAR_ATE_MS) throw rejeitar("cancelamento_fora_do_prazo", "Só dá para cancelar em até 10 minutos depois do início");
  const [pausa] = await ctx.tx.select({ id: execucaoPausa.id }).from(execucaoPausa).where(eq(execucaoPausa.execucaoId, e.id)).limit(1);
  const [foto] = await ctx.tx.select({ id: evidencia.id }).from(evidencia).where(eq(evidencia.execucaoId, e.id)).limit(1);
  if (pausa || foto) throw rejeitar("cancelamento_invalido", "Execução com pausa ou foto não pode ser cancelada");
  await ctx.tx.update(execucao).set({ fim: ctx.evento.ocorridoEm < e.inicio ? e.inicio : ctx.evento.ocorridoEm, resultado: "cancelada", assinaturaDoResultadoPath: assinarEvento(ctx) }).where(eq(execucao.id, e.id));
  await tornarPedidoObsoleto(ctx, e.id);
}

// ---------------------------------------------------------------------------------------------------------------
// Execução compartilhada: os pedidos de um participante ao responsável (`pedidos-execucao.ts`).

export const aplicarPedidoAbertoEvento = (ctx: Contexto, bruto: unknown) => aplicarPedidoAberto(ctx, carregarExecucaoParaAgir, bruto);
export { aplicarPedidoApoiado, aplicarPedidoCancelado, aplicarPedidoDecidido };
