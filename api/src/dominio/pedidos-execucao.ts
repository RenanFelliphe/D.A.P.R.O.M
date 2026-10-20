import { and, asc, eq, lte } from "drizzle-orm";
import { z } from "zod";
import { PRAZO_DO_PEDIDO_MS } from "../../../shared/api/execucao-pedidos";
import { PEDIDO_TIPOS, SUSPENSAO_MOTIVOS, execucao, execucaoPedido, execucaoPedidoApoio, os, usuario } from "../db/schema";
import type { Db } from "../db/conexao";
import { instanteIso, uuid } from "../http/validacao";
import { enfileirarTarefa } from "../servicos/fila";
import { criarAviso } from "./alertas";
import { adiar, lerPayload, lerPosicao, posicaoPayload, rejeitar, rejeitarOuVersao, type Contexto } from "./eventos-base";
import { avisarOResponsavel, avisarSaude, conferirMotivo, executarEncerramento, executarSuspensao, participaDaApr, type ContextoDeAcao, type Execucao } from "./execucao-acoes";
import { ehMotivoDeSaude } from "./motivos-de-parada";
import { recalcularStatusOs } from "./status-os";

/**
 * Os pedidos da execução compartilhada: o participante que não iniciou a execução pede ao responsável para encerrar a OS ou suspender
 * por um motivo comum; o responsável aceita ou recusa em até 2 minutos (`PRAZO_DO_PEDIDO_MS`, no relógio da `api`); sem resposta, o
 * pedido é aprovado sozinho. A ação vale no instante do clique de quem pediu, não no da aprovação. Sem sinal, nada é pedido: a ação vale
 * na hora no aparelho de quem a fez (`aplicarPedidoAberto` aplica direto quando o evento veio da fila offline).
 */

type Pedido = typeof execucaoPedido.$inferSelect;

const nomeDe = async (tx: ContextoDeAcao["tx"], id: string) => (await tx.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, id)))[0]?.nome ?? "—";
const rotuloDaOs = (o: { numeroOrdem: string | null; titulo: string }) => `OS ${o.numeroOrdem ?? o.titulo}`;
const dizer = (tipo: Pedido["tipo"]) => (tipo === "encerrar" ? "encerrar a OS" : "suspender a execução");

/** Aplica o pedido (aprovado pelo responsável ou por prazo) em nome de quem pediu, no instante do clique dele. */
async function aplicarPedido(c: ContextoDeAcao, p: Pedido) {
  const [e] = await c.tx.select().from(execucao).where(eq(execucao.id, p.execucaoId));
  if (!e || e.resultado !== null) return;
  const posicao = { latitude: p.latitude, longitude: p.longitude };
  c.saida.osAfetadas.add(e.osId);
  if (p.tipo === "encerrar") await executarEncerramento(c, e, { fim: p.instante, posicao, autorId: p.solicitanteId });
  else await executarSuspensao(c, e, { fim: p.instante, motivo: p.motivo as (typeof SUSPENSAO_MOTIVOS)[number], complemento: p.complemento, posicao, autorId: p.solicitanteId });
}

/** Os 2 minutos passaram sem resposta: o pedido é aprovado sozinho, no prazo, e o solicitante e o responsável são avisados. */
async function aprovarPorPrazo(c: ContextoDeAcao, p: Pedido) {
  await c.tx.update(execucaoPedido).set({ estado: "aprovado_por_prazo", decididoEm: p.expiraEm }).where(eq(execucaoPedido.id, p.id));
  await aplicarPedido(c, p);
  const [e] = await c.tx.select().from(execucao).where(eq(execucao.id, p.execucaoId));
  const [ordem] = await c.tx.select().from(os).where(eq(os.id, e!.osId));
  const quem = await nomeDe(c.tx, p.solicitanteId);
  c.saida.alertas.push(
    ...(await criarAviso(c.tx, [p.solicitanteId], {
      tipo: "pedido_decidido",
      osId: e!.osId,
      detalhe: `${rotuloDaOs(ordem!)}: o responsável não respondeu em 2 minutos, e o seu pedido para ${dizer(p.tipo)} foi aprovado sozinho.`,
      agora: c.recebidoEm,
    })),
    ...(await criarAviso(c.tx, [e!.executorId], {
      tipo: "acao_de_participante",
      osId: e!.osId,
      detalhe: `${rotuloDaOs(ordem!)}: o pedido de ${quem} para ${dizer(p.tipo)} passou de 2 minutos sem resposta e foi aprovado sozinho.`,
      agora: c.recebidoEm,
    })),
  );
}

/**
 * Fecha, dentro da transação do evento, os pedidos vencidos da execução (aprovados por prazo). Toda ação sobre a execução chama isto
 * antes de ler o estado dela: o que venceu já valeu, ainda que a tarefa ainda não tenha rodado.
 */
export async function fecharPedidosVencidosDaExecucao(c: ContextoDeAcao, execucaoId: string) {
  const vencidos = await c.tx
    .select()
    .from(execucaoPedido)
    .where(and(eq(execucaoPedido.execucaoId, execucaoId), eq(execucaoPedido.estado, "aberto"), lte(execucaoPedido.expiraEm, c.recebidoEm)))
    .for("update");
  for (const p of vencidos) await aprovarPorPrazo(c, p);
}

/**
 * Fecha os pedidos vencidos de todas as execuções (ou de uma OS), cada um na própria transação, e recalcula o status das OS que mudaram.
 * É o que a tarefa `pedido_prazo` roda e o que as leituras (`GET /os/{id}`, `GET /me/pedidos-abertos`) fazem antes de responder, para a
 * tela nunca mostrar como aberto um pedido que já venceu. Devolve quantos fechou.
 */
export async function fecharPedidosVencidos(db: Db, agora: Date, filtro: { osId?: string; pedidoId?: string } = {}): Promise<number> {
  const candidatos = await db
    .select({ id: execucaoPedido.id, osId: execucao.osId })
    .from(execucaoPedido)
    .innerJoin(execucao, eq(execucao.id, execucaoPedido.execucaoId))
    .where(and(eq(execucaoPedido.estado, "aberto"), lte(execucaoPedido.expiraEm, agora), filtro.osId ? eq(execucao.osId, filtro.osId) : undefined, filtro.pedidoId ? eq(execucaoPedido.id, filtro.pedidoId) : undefined))
    .orderBy(asc(execucaoPedido.expiraEm))
    .limit(50);
  let fechados = 0;
  for (const { id } of candidatos) {
    await db.transaction(async (tx) => {
      const [p] = await tx.select().from(execucaoPedido).where(eq(execucaoPedido.id, id)).for("update");
      // Outra transação (a decisão do responsável, ou a leitura de outra tela) pode ter fechado o pedido no meio-tempo.
      if (!p || p.estado !== "aberto" || p.expiraEm > agora) return;
      const c: ContextoDeAcao = { tx, recebidoEm: agora, saida: { alertas: [], aprs: [], osAfetadas: new Set(), ganhos: [] } };
      await aprovarPorPrazo(c, p);
      for (const osId of c.saida.osAfetadas) await recalcularStatusOs(tx, osId);
      fechados++;
    });
  }
  return fechados;
}

// ---------------------------------------------------------------------------------------------------------------

const esquemaAberto = z.object({
  id: uuid,
  execucao_id: uuid,
  tipo: z.enum(PEDIDO_TIPOS),
  /** O instante do clique: é nele que a ação vale se o pedido for aprovado. */
  instante: instanteIso,
  motivo: z.enum(SUSPENSAO_MOTIVOS).nullable().optional(),
  complemento: z.string().max(500).nullable().optional(),
  ...posicaoPayload,
});

/** Carrega o pedido e fecha, antes, os vencidos da execução dele: a leitura que o evento faz já vê o prazo. */
async function carregarPedido(ctx: Contexto, id: string): Promise<Pedido> {
  const [achado] = await ctx.tx.select().from(execucaoPedido).where(eq(execucaoPedido.id, id));
  if (!achado) throw adiar("pedido_ausente", "O pedido ainda não foi recebido");
  await fecharPedidosVencidosDaExecucao(ctx, achado.execucaoId);
  const [p] = await ctx.tx.select().from(execucaoPedido).where(eq(execucaoPedido.id, id)).for("update");
  return p!;
}

const porQueNaoValeMais = (p: Pedido) =>
  p.estado === "aprovado_por_prazo"
    ? "O prazo de 2 minutos acabou e o pedido foi aprovado sozinho"
    : p.estado === "cancelado"
      ? "Quem pediu cancelou o pedido"
      : p.estado === "obsoleto"
        ? "O pedido perdeu o sentido: a execução mudou"
        : "O pedido já foi respondido";

/**
 * `pedido_aberto`: um participante que não iniciou a execução pede ao responsável para encerrar a OS ou suspender por um motivo comum.
 * A `api` abre o pedido, conta 2 minutos no relógio dela e avisa o responsável. Dois casos aplicam a ação direto, sem pedido: o evento
 * que veio da fila offline (o aparelho decidiu sem sinal) e a suspensão por lesão ou enfermidade (a saúde não espera).
 * O responsável não pede: age direto.
 */
export async function aplicarPedidoAberto(
  ctx: Contexto,
  carregarParaAgir: (ctx: Contexto, id: string) => Promise<{ e: Execucao; papel: "responsavel" | "participante" }>,
  bruto: unknown,
) {
  const p = lerPayload(esquemaAberto, bruto);
  const [jaExiste] = await ctx.tx.select({ id: execucaoPedido.id }).from(execucaoPedido).where(eq(execucaoPedido.id, p.id));
  if (jaExiste) return;
  const { e, papel } = await carregarParaAgir(ctx, p.execucao_id);
  if (papel === "responsavel") throw rejeitar("pedido_do_responsavel", "Quem iniciou a execução age direto, sem pedido");
  if (p.instante < e.inicio) throw rejeitarOuVersao(ctx, "fim_antes_do_inicio", "O instante do pedido é anterior ao início da execução");
  const posicao = lerPosicao(p);
  const complemento = p.tipo === "suspender" ? conferirMotivo(p.motivo, p.complemento, "suspensão") : null;

  const direto = ctx.offline || (p.tipo === "suspender" && ehMotivoDeSaude(p.motivo));
  if (direto) {
    if (p.tipo === "encerrar") {
      await executarEncerramento(ctx, e, { fim: p.instante, posicao, autorId: ctx.usuario.id });
      await avisarOResponsavel(ctx, e, ctx.usuario, "encerrou a OS sem sinal");
    } else {
      await executarSuspensao(ctx, e, { fim: p.instante, motivo: p.motivo!, complemento, posicao, autorId: ctx.usuario.id });
      if (ehMotivoDeSaude(p.motivo)) await avisarSaude(ctx, { osId: e.osId, quem: ctx.usuario.nome, quando: "suspendeu", motivo: p.motivo as "lesao" | "enfermidade", complemento });
      await avisarOResponsavel(ctx, e, ctx.usuario, "suspendeu a execução");
    }
    return;
  }

  const [aberto] = await ctx.tx.select({ id: execucaoPedido.id }).from(execucaoPedido).where(and(eq(execucaoPedido.execucaoId, e.id), eq(execucaoPedido.estado, "aberto")));
  if (aberto) throw rejeitar("pedido_aberto_existente", "Já há um pedido aberto nesta execução: apoie-o");

  const expiraEm = new Date(ctx.recebidoEm.getTime() + PRAZO_DO_PEDIDO_MS);
  await ctx.tx.insert(execucaoPedido).values({
    id: p.id,
    execucaoId: e.id,
    tipo: p.tipo,
    solicitanteId: ctx.usuario.id,
    instante: p.instante,
    motivo: p.tipo === "suspender" ? p.motivo! : null,
    complemento,
    latitude: posicao.latitude,
    longitude: posicao.longitude,
    criadoEm: ctx.recebidoEm,
    expiraEm,
  });
  await enfileirarTarefa(ctx.tx, "pedido_prazo", p.id, expiraEm);
  const [ordem] = await ctx.tx.select().from(os).where(eq(os.id, e.osId));
  ctx.saida.alertas.push(
    ...(await criarAviso(ctx.tx, [e.executorId], {
      tipo: "pedido_de_acao",
      osId: e.osId,
      detalhe: `${rotuloDaOs(ordem!)}: ${ctx.usuario.nome} pediu para ${dizer(p.tipo)}. Responda em até 2 minutos; sem resposta, o pedido é aprovado sozinho.`,
      agora: ctx.recebidoEm,
    })),
  );
}

const esquemaDecidido = z.object({ pedido_id: uuid, decisao: z.enum(["aprovar", "recusar"]), motivo: z.string().trim().max(200).nullable().optional() });

/**
 * `pedido_decidido`: o responsável pela execução aprova ou recusa o pedido aberto. Aprovar aplica a ação em nome de quem pediu, no
 * instante do clique dele. Depois dos 2 minutos o pedido já foi aprovado sozinho: a decisão tardia é recusada com o motivo.
 */
export async function aplicarPedidoDecidido(ctx: Contexto, bruto: unknown) {
  const d = lerPayload(esquemaDecidido, bruto);
  const p = await carregarPedido(ctx, d.pedido_id);
  const [e] = await ctx.tx.select().from(execucao).where(eq(execucao.id, p.execucaoId));
  ctx.saida.osAfetadas.add(e!.osId);
  if (e!.executorId !== ctx.usuario.id) throw rejeitar("so_o_responsavel", "Só quem iniciou a execução responde o pedido");

  const quer = d.decisao === "aprovar" ? "aprovado" : "recusado";
  if (p.estado !== "aberto") {
    if (p.estado === quer && p.decididoPor === ctx.usuario.id) return;
    throw rejeitar("pedido_ja_decidido", porQueNaoValeMais(p));
  }

  const [ordem] = await ctx.tx.select().from(os).where(eq(os.id, e!.osId));
  const motivoDaRecusa = d.decisao === "recusar" ? d.motivo?.trim() || null : null;
  await ctx.tx.update(execucaoPedido).set({ estado: quer, decididoPor: ctx.usuario.id, decididoEm: ctx.recebidoEm, motivoRecusa: motivoDaRecusa }).where(eq(execucaoPedido.id, p.id));
  if (d.decisao === "aprovar") await aplicarPedido(ctx, p);
  ctx.saida.alertas.push(
    ...(await criarAviso(ctx.tx, [p.solicitanteId], {
      tipo: "pedido_decidido",
      osId: e!.osId,
      detalhe:
        d.decisao === "aprovar"
          ? `${rotuloDaOs(ordem!)}: ${ctx.usuario.nome} aprovou o seu pedido para ${dizer(p.tipo)}.`
          : `${rotuloDaOs(ordem!)}: ${ctx.usuario.nome} recusou o seu pedido para ${dizer(p.tipo)}${motivoDaRecusa ? `: ${motivoDaRecusa}` : ""}. A execução continua.`,
      agora: ctx.recebidoEm,
    })),
  );
}

const esquemaDoPedido = z.object({ pedido_id: uuid });

/** `pedido_cancelado`: quem pediu desiste antes da resposta. */
export async function aplicarPedidoCancelado(ctx: Contexto, bruto: unknown) {
  const { pedido_id } = lerPayload(esquemaDoPedido, bruto);
  const p = await carregarPedido(ctx, pedido_id);
  if (p.solicitanteId !== ctx.usuario.id) throw rejeitar("pedido_de_outro", "Só quem pediu pode cancelar o pedido");
  const [e] = await ctx.tx.select({ osId: execucao.osId }).from(execucao).where(eq(execucao.id, p.execucaoId));
  ctx.saida.osAfetadas.add(e!.osId);
  if (p.estado === "cancelado") return;
  if (p.estado !== "aberto") throw rejeitar("pedido_ja_decidido", porQueNaoValeMais(p));
  await ctx.tx.update(execucaoPedido).set({ estado: "cancelado", decididoEm: ctx.recebidoEm }).where(eq(execucaoPedido.id, p.id));
}

/** `pedido_apoiado`: outro participante concorda com o pedido aberto; fica registrado no relatório. */
export async function aplicarPedidoApoiado(ctx: Contexto, bruto: unknown) {
  const { pedido_id } = lerPayload(esquemaDoPedido, bruto);
  const p = await carregarPedido(ctx, pedido_id);
  const [e] = await ctx.tx.select().from(execucao).where(eq(execucao.id, p.execucaoId));
  ctx.saida.osAfetadas.add(e!.osId);
  if (p.solicitanteId === ctx.usuario.id) throw rejeitar("apoio_proprio", "Quem pediu não precisa apoiar o próprio pedido");
  if (e!.executorId === ctx.usuario.id) throw rejeitar("apoio_do_responsavel", "O responsável aprova ou recusa o pedido, não o apoia");
  if (!(await participaDaApr(ctx.tx, e!.aprId, ctx.usuario.id))) throw rejeitar("execucao_de_outro", "Só quem participa da APR da execução pode apoiar o pedido");
  if (p.estado !== "aberto") throw rejeitar("pedido_ja_decidido", porQueNaoValeMais(p));
  await ctx.tx.insert(execucaoPedidoApoio).values({ pedidoId: p.id, usuarioId: ctx.usuario.id, apoiadoEm: ctx.recebidoEm }).onConflictDoNothing();
}
