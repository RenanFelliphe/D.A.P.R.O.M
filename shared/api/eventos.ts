/**
 * O envio de eventos de campo (`POST /eventos`), igual na web e no app: o formato do evento, a resposta da `api` e a leitura
 * dela para UM evento. Quem envia (o `fetch` da web pelo proxy, o cliente do app) fica de fora; aqui só há o que é puro.
 */

import type { RespostaComPontos } from "./gamificacao";
import { novoUuid } from "./uuid";

export type TipoDeEvento =
  | "apr_concluida"
  | "apr_assinada"
  | "apr_recusada"
  | "execucao_iniciada"
  | "pausa_iniciada"
  | "pausa_encerrada"
  | "execucao_encerrada"
  | "encerramento_assinado"
  | "execucao_interrompida"
  | "execucao_suspensa"
  | "execucao_cancelada"
  // Execução compartilhada: um participante pede ao responsável, o responsável decide, quem pediu desiste, outro participante apoia.
  | "pedido_aberto"
  | "pedido_decidido"
  | "pedido_cancelado"
  | "pedido_apoiado";

export interface EventoDeCampo {
  /** Gerado no cliente; reenviar o mesmo id não tem efeito. */
  id?: string;
  tipo: TipoDeEvento;
  os_id?: string | null;
  payload: Record<string, unknown>;
  ocorrido_em?: string;
}

export interface RespostaEventos extends RespostaComPontos {
  confirmados: string[];
  alertas: string[];
  aprs: { id: string; resultado: "aprovada" | "bloqueada" }[];
  os: { id: string; status: string }[];
  rejeitados: { id: string; codigo: string; mensagem: string }[];
  pendentes: { id: string; codigo: string; mensagem: string }[];
}

/** O evento foi recusado (`rejeitado`) ou ainda não pode ser aplicado (`pendente`); `message` é o texto para o usuário. */
export class ErroDeEvento extends Error {
  constructor(
    public readonly situacao: "rejeitado" | "pendente",
    public readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

/** O corpo de `POST /eventos` para um evento: o `id` e o instante nascem aqui quando o chamador não os deu. */
export function montarEnvioDoEvento(evento: EventoDeCampo, agora: () => Date = () => new Date()) {
  const id = evento.id ?? novoUuid();
  const corpo = {
    eventos: [{ id, tipo: evento.tipo, os_id: evento.os_id ?? null, payload: evento.payload, ocorrido_em: evento.ocorrido_em ?? agora().toISOString() }],
  };
  return { id, corpo };
}

/** Lê a resposta de `POST /eventos` para o evento `id`: lança `ErroDeEvento` se foi recusado ou ficou pendente. */
export function interpretarRespostaDoEvento(resposta: RespostaEventos, id: string): RespostaEventos & { id: string } {
  const recusa = resposta.rejeitados.find((r) => r.id === id);
  if (recusa) throw new ErroDeEvento("rejeitado", recusa.codigo, recusa.mensagem);
  const espera = resposta.pendentes.find((r) => r.id === id);
  if (espera) throw new ErroDeEvento("pendente", espera.codigo, espera.mensagem);
  return { ...resposta, id };
}
