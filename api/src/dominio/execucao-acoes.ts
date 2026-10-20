import { and, eq, isNull, ne } from "drizzle-orm";
import { SUSPENSAO_MOTIVOS, aprParticipante, execucao, execucaoPausa, execucaoPedido, os } from "../db/schema";
import { criarAlertas, criarAviso } from "./alertas";
import { rejeitar, type Contexto } from "./eventos-base";
import { ehMotivoDeSaude, pedeComplemento } from "./motivos-de-parada";

/**
 * As ações sobre a execução que não dependem de quem as pediu: encerrar, suspender, fechar a pausa, avisar. Os eventos
 * (`eventos-execucao.ts`) conferem quem pode agir e chamam daqui; o pedido aprovado em nome de quem pediu (`pedidos-execucao.ts`) também.
 */

/**
 * O que a ação precisa do contexto do evento: a transação, o relógio da `api` e onde acumular o que o evento gerou. É o que permite
 * aplicar a ação fora de uma requisição (o pedido aprovado por prazo, pela tarefa).
 */
export type ContextoDeAcao = Pick<Contexto, "tx" | "recebidoEm" | "saida">;

export type Execucao = typeof execucao.$inferSelect;

/** O papel de quem age sobre uma execução: quem a iniciou (o responsável) ou outro participante da APR. */
export type PapelNaExecucao = "responsavel" | "participante";

export interface Posicao {
  latitude: number | null;
  longitude: number | null;
}

/** O usuário é participante da APR e não recusou: quem pode acompanhar e agir sobre a execução que ela ampara. */
export async function participaDaApr(tx: ContextoDeAcao["tx"], aprId: string, usuarioId: string): Promise<boolean> {
  const [p] = await tx
    .select({ recusouEm: aprParticipante.recusouEm })
    .from(aprParticipante)
    .where(and(eq(aprParticipante.aprId, aprId), eq(aprParticipante.usuarioId, usuarioId)));
  return !!p && !p.recusouEm;
}

/** Quem encerrou a execução e, por isso, assina o encerramento: `finalizada_por`, ou o responsável nas execuções anteriores a ele. */
export const quemEncerrou = (e: Pick<Execucao, "executorId" | "finalizadaPor">) => e.finalizadaPor ?? e.executorId;

/**
 * Fecha a pausa aberta (se houver) no instante dado: encerrar, interromper ou suspender com o cronômetro em pausa. Uma pausa aberta
 * depois do instante (um colega pausou enquanto o pedido esperava) fecha no próprio início, sem duração.
 */
export async function fecharPausaAberta(c: ContextoDeAcao, execucaoId: string, fim: Date, autorId: string) {
  const [aberta] = await c.tx.select().from(execucaoPausa).where(and(eq(execucaoPausa.execucaoId, execucaoId), isNull(execucaoPausa.fim)));
  if (!aberta) return;
  await c.tx
    .update(execucaoPausa)
    .set({ fim: aberta.inicio > fim ? aberta.inicio : fim, encerradaPor: autorId })
    .where(eq(execucaoPausa.id, aberta.id));
}

/** O instante em que a execução termina de fato: o do pedido, mas nunca antes do início de uma pausa que um colega abriu enquanto ele esperava. */
async function fimEfetivo(c: ContextoDeAcao, execucaoId: string, fim: Date): Promise<Date> {
  const [aberta] = await c.tx.select({ inicio: execucaoPausa.inicio }).from(execucaoPausa).where(and(eq(execucaoPausa.execucaoId, execucaoId), isNull(execucaoPausa.fim)));
  return aberta && aberta.inicio > fim ? aberta.inicio : fim;
}

/** O pedido aberto de uma execução perde o sentido quando ela termina por outro caminho (o responsável agiu, ou um colega pela via direta). */
export async function tornarPedidoObsoleto(c: ContextoDeAcao, execucaoId: string) {
  await c.tx
    .update(execucaoPedido)
    .set({ estado: "obsoleto", decididoEm: c.recebidoEm })
    .where(and(eq(execucaoPedido.execucaoId, execucaoId), eq(execucaoPedido.estado, "aberto")));
}

/**
 * O clique em "Encerrar OS", já autorizado (direto, por quem pode, ou por um pedido aprovado): grava o fim, a localização e quem
 * encerrou, e o tempo para ali. Duas execuções encerradas na mesma OS (a fila offline) são guardadas, com um alerta; vale a primeira.
 */
export async function executarEncerramento(c: ContextoDeAcao, e: Execucao, d: { fim: Date; posicao: Posicao; autorId: string }) {
  const fim = await fimEfetivo(c, e.id, d.fim);
  await fecharPausaAberta(c, e.id, fim, d.autorId);
  await c.tx
    .update(execucao)
    .set({ fim, resultado: "encerrada", finalizadaPor: d.autorId, fimLatitude: d.posicao.latitude, fimLongitude: d.posicao.longitude })
    .where(eq(execucao.id, e.id));
  await tornarPedidoObsoleto(c, e.id);

  const [outra] = await c.tx.select({ id: execucao.id }).from(execucao).where(and(eq(execucao.osId, e.osId), eq(execucao.resultado, "encerrada"), ne(execucao.id, e.id)));
  if (outra) {
    const [ordem] = await c.tx.select().from(os).where(eq(os.id, e.osId));
    c.saida.alertas.push(...(await criarAlertas(c.tx, { tipo: "execucao_duplicada", osId: e.osId, equipeId: ordem!.equipeId, detalhe: `OS ${ordem!.numeroOrdem ?? ordem!.titulo}: duas execuções encerradas; vale a primeira` })));
  }
}

/** O motivo e o complemento de uma parada (pausa ou suspensão): o motivo é obrigatório, e "outro" e "aguardando" pedem o texto. */
export function conferirMotivo(motivo: string | null | undefined, complemento: string | null | undefined, parada: "pausa" | "suspensão") {
  if (!motivo) throw rejeitar("motivo_obrigatorio", `Escolha o motivo da ${parada}`);
  const texto = complemento?.trim() || null;
  if (pedeComplemento(motivo) && !texto) {
    throw rejeitar("complemento_obrigatorio", motivo === "aguardando" ? "Diga o que ou quem você está aguardando" : "Descreva o motivo");
  }
  // O complemento é obrigatório em "aguardando" e "outro"; na lesão e na enfermidade é opcional (o que aconteceu) e vai no aviso.
  return pedeComplemento(motivo) || ehMotivoDeSaude(motivo) ? texto : null;
}

/**
 * A suspensão, já autorizada: o serviço não continua hoje. Encerra esta execução e grava o motivo, a localização e quem suspendeu;
 * a OS fica pendente e a retomada pede uma APR nova.
 */
export async function executarSuspensao(
  c: ContextoDeAcao,
  e: Execucao,
  d: { fim: Date; motivo: (typeof SUSPENSAO_MOTIVOS)[number]; complemento: string | null; posicao: Posicao; autorId: string },
) {
  const fim = await fimEfetivo(c, e.id, d.fim);
  await fecharPausaAberta(c, e.id, fim, d.autorId);
  await c.tx
    .update(execucao)
    .set({ fim, resultado: "suspensa", finalizadaPor: d.autorId, suspensaoMotivo: d.motivo, suspensaoComplemento: d.complemento, fimLatitude: d.posicao.latitude, fimLongitude: d.posicao.longitude })
    .where(eq(execucao.id, e.id));
  await tornarPedidoObsoleto(c, e.id);
}

/**
 * Lesão e enfermidade na pausa ou na suspensão avisam o supervisor na hora (sino e e-mail obrigatório): a lesão no trabalho,
 * mesmo leve, é acidente de trabalho e a empresa precisa registrá-la. Também constam no relatório da execução.
 */
export async function avisarSaude(c: ContextoDeAcao, d: { osId: string; quem: string; quando: "pausou" | "suspendeu"; motivo: "lesao" | "enfermidade"; complemento: string | null }) {
  const [ordem] = await c.tx.select().from(os).where(eq(os.id, d.osId));
  const o = ordem!;
  const nome = d.motivo === "lesao" ? "lesão" : "enfermidade";
  const detalhe = `OS ${o.numeroOrdem ?? o.titulo}: ${d.quem} ${d.quando} a execução por ${nome}${d.complemento ? ` (${d.complemento})` : ""}.${d.motivo === "lesao" ? " A lesão no trabalho, mesmo leve, é acidente de trabalho e precisa ser registrada." : ""}`;
  c.saida.alertas.push(...(await criarAlertas(c.tx, { tipo: "lesao_ou_enfermidade", osId: d.osId, equipeId: o.equipeId, detalhe, agora: c.recebidoEm })));
}

/** O que um participante fez, para o responsável saber (sino): só quando quem agiu não é o próprio responsável. */
export async function avisarOResponsavel(c: ContextoDeAcao, e: Pick<Execucao, "osId" | "executorId">, quem: { id: string; nome: string }, fez: string) {
  if (quem.id === e.executorId) return;
  const [ordem] = await c.tx.select({ numeroOrdem: os.numeroOrdem, titulo: os.titulo }).from(os).where(eq(os.id, e.osId));
  c.saida.alertas.push(
    ...(await criarAviso(c.tx, [e.executorId], { tipo: "acao_de_participante", osId: e.osId, detalhe: `OS ${ordem!.numeroOrdem ?? ordem!.titulo}: ${quem.nome} ${fez}.`, agora: c.recebidoEm })),
  );
}
