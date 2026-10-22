/**
 * Execução compartilhada (`docs/operacao-de-campo.md`, seção 6): qualquer participante da APR pode agir sobre a execução.
 * Pausar, continuar, interromper por risco e suspender por saúde valem na hora; encerrar e suspender por um motivo comum viram um
 * **pedido** ao responsável (quem iniciou a execução), que aceita ou recusa em até 2 minutos; sem resposta, o pedido é aprovado
 * sozinho. A `api`, a `web` e o app usam este arquivo.
 */
import { ehMotivoDeSaude } from "./motivos-de-parada";

/** Quanto o responsável tem para responder um pedido; contado no relógio da `api`. */
export const PRAZO_DO_PEDIDO_MS = 2 * 60_000;

export const PEDIDO_TIPOS = ["encerrar", "suspender"] as const;
export type TipoDePedido = (typeof PEDIDO_TIPOS)[number];

export type EstadoDoPedido = "aberto" | "aprovado" | "aprovado_por_prazo" | "recusado" | "cancelado" | "obsoleto";

/** O que o pedido pede, como cabe numa frase ("Carla pediu para encerrar a OS"). */
export const ROTULO_DO_PEDIDO: Record<TipoDePedido, string> = {
  encerrar: "encerrar a OS",
  suspender: "suspender a execução",
};

/** Como o pedido terminou, para o solicitante e o relatório. */
export const ROTULO_DO_ESTADO_DO_PEDIDO: Record<EstadoDoPedido, string> = {
  aberto: "Aguardando o responsável",
  aprovado: "Aprovado pelo responsável",
  aprovado_por_prazo: "Aprovado sozinho: o responsável não respondeu em 2 minutos",
  recusado: "Recusado pelo responsável",
  cancelado: "Cancelado por quem pediu",
  obsoleto: "Sem efeito: o responsável agiu antes",
};

export interface PedidoDaApi {
  id: string;
  tipo: TipoDePedido;
  estado: EstadoDoPedido;
  solicitante: { id: string; nome: string };
  /** O instante do clique de quem pediu: é nele que a ação vale se o pedido for aprovado. */
  instante: string;
  motivo: string | null;
  complemento: string | null;
  criado_em: string;
  expira_em: string;
  /** Quando deixou de estar aberto; nulo enquanto aberto. */
  decidido_em: string | null;
  decidido_por: { id: string; nome: string } | null;
  motivo_recusa: string | null;
  /** Outros participantes que concordaram com o pedido. */
  apoios: { id: string; nome: string }[];
  /** Só no pedido aberto: quanto falta, na hora em que a `api` respondeu. O cliente desconta o tempo que passou desde que recebeu a resposta. */
  restante_ms?: number;
}

export type AcaoDaExecucao = "pausar" | "continuar" | "interromper" | "suspender" | "encerrar" | "cancelar";

/**
 * Quando o participante que não iniciou a execução, **com sinal**, precisa pedir ao responsável. Só encerrar e suspender por um motivo
 * comum: o resto vale na hora. Saúde e risco nunca esperam o responsável. Sem sinal (aparelho offline) nada é pedido: a ação vale na
 * hora e a conferência resolve depois (etapa 3). Para mudar a regra, é só mexer aqui.
 */
export function pedeAprovacaoDoResponsavel(acao: AcaoDaExecucao, motivo?: string | null): boolean {
  if (acao === "encerrar") return true;
  if (acao === "suspender") return !ehMotivoDeSaude(motivo);
  return false;
}

/** O pedido aberto de uma execução, se houver. */
export const pedidoAberto = (execucao: { pedidos?: PedidoDaApi[] }): PedidoDaApi | null => execucao.pedidos?.find((p) => p.estado === "aberto") ?? null;

/**
 * Quanto falta para o prazo do pedido, em ms. `recebidoEm` é o instante (relógio do aparelho) em que a resposta da `api` chegou: o
 * relógio do aparelho e o da `api` podem diferir, então o que vale é o `restante_ms` que a `api` mediu, menos o tempo que passou aqui.
 */
export function restanteDoPedido(pedido: Pick<PedidoDaApi, "restante_ms">, recebidoEm: number, agora: number): number {
  return Math.max(0, (pedido.restante_ms ?? 0) - Math.max(0, agora - recebidoEm));
}

/** `1:42` para a contagem regressiva do pedido. */
export function contagemDoPedido(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Quem encerrou a execução (e por isso assina o encerramento): `finalizada_por`, ou o responsável nas execuções anteriores a ele. */
export const quemEncerrou = (execucao: { executor: { id: string; nome: string }; finalizada_por?: { id: string; nome: string } | null }) => execucao.finalizada_por ?? execucao.executor;

/** Um pedido que espera a resposta de quem pergunta, o responsável (`GET /me/pedidos-abertos`): a faixa "[nome] pediu para encerrar — 1:42". */
export interface PedidoParaResponder {
  id: string;
  execucao_id: string;
  os_id: string;
  numero_ordem: string | null;
  titulo: string;
  tipo: TipoDePedido;
  solicitante: { id: string; nome: string };
  motivo: string | null;
  complemento: string | null;
  criado_em: string;
  expira_em: string;
  restante_ms: number;
}
