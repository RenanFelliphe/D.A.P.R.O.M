/** O estado "ausente" do usuário (ver `ausencia.md`): os tipos da `api` e os textos que as telas repetem. Chaves em snake_case, como a `api` devolve. */

import type { TomDoSelo } from "./tipos";
import { dataDoDia } from "./formatar";

/**
 * Como a ausência está hoje. `agendada`, `em_curso` e `vencida` não são gravadas: saem das datas da ausência confirmada (agendada
 * antes do início, em curso até a véspera do retorno, vencida a partir do retorno até alguém a encerrar).
 */
export type SituacaoDaAusencia = "pedida" | "aguardando_confirmacao" | "agendada" | "em_curso" | "vencida" | "encerrada" | "recusada" | "cancelada";

export const SITUACOES_DA_AUSENCIA: SituacaoDaAusencia[] = ["pedida", "aguardando_confirmacao", "agendada", "em_curso", "vencida", "encerrada", "recusada", "cancelada"];

export type OrigemDaAusencia = "pedido" | "supervisor" | "propria";

/** Uma ausência como `GET /ausencias` devolve. */
export interface Ausencia {
  id: string;
  usuario_id: string;
  usuario_nome: string;
  usuario_matricula: string;
  equipe_id: string;
  equipe_nome: string;
  supervisor_id: string | null;
  supervisor_nome: string | null;
  motivo: string;
  /** Dias `AAAA-MM-DD`: a ausência vale da 0h do início até a véspera do retorno, o primeiro dia de volta ao trabalho. */
  inicio: string;
  retorno: string;
  /** Os dias corridos da ausência (do início até a véspera do retorno). */
  dias: number;
  dias_informados: number | null;
  estado: string;
  situacao: SituacaoDaAusencia;
  origem: OrigemDaAusencia;
  /** O fim antecipado que o ausente pediu e ainda espera a resposta: a data de retorno que ele quer. */
  fim_pedido_data: string | null;
  fim_pedido_em: string | null;
  encerrada_em: string | null;
  forma_encerramento: "retorno" | "antecipada" | "supervisor" | "emergencia" | null;
  criada_em: string;
}

/** Um ato da linha do tempo da ausência (`GET /ausencias/{id}`). */
export interface AtoDaAusencia {
  id: string;
  tipo: string;
  autor_id: string | null;
  autor_nome: string | null;
  em: string;
  /** Se o ato foi assinado com a assinatura do perfil. */
  assinado: boolean;
  dados: Record<string, unknown> | null;
}

/** A ausência que está valendo para uma pessoa (em curso ou vencida), no que as listas e a casca usam. */
export interface AusenciaDaPessoa {
  id: string;
  inicio: string;
  retorno: string;
  situacao: "em_curso" | "vencida";
  /** "Ausente até 03/11/2026" ou "Ausência vencida desde 03/11/2026". */
  rotulo: string;
}

/** O que `GET /me` traz da ausência de quem está logado (a faixa e a tela de retorno). */
export interface MinhaAusencia extends AusenciaDaPessoa {
  motivo: string;
  origem: OrigemDaAusencia;
  fim_pedido_data: string | null;
  fim_pedido_em: string | null;
}

export const rotuloDaSituacao: Record<SituacaoDaAusencia, string> = {
  pedida: "Aguardando o supervisor",
  aguardando_confirmacao: "Aguardando a confirmação",
  agendada: "Agendada",
  em_curso: "Em curso",
  vencida: "Vencida",
  encerrada: "Encerrada",
  recusada: "Recusada",
  cancelada: "Cancelada",
};

export const tomDaSituacao: Record<SituacaoDaAusencia, TomDoSelo> = {
  pedida: "al",
  aguardando_confirmacao: "al",
  agendada: "brand",
  em_curso: "exe",
  vencida: "blq",
  encerrada: "enc",
  recusada: "neu",
  cancelada: "neu",
};

export const rotuloDaForma: Record<NonNullable<Ausencia["forma_encerramento"]>, string> = {
  retorno: "Retorno confirmado",
  antecipada: "Fim antecipado",
  supervisor: "Encerrada pelo supervisor",
  emergencia: "Encerrada em emergência",
};

/** "20/10/2026 a 02/11/2026 · retorno em 03/11/2026 · 14 dias": o último dia fora e o primeiro dia de volta. */
export function descreverPeriodo(a: Pick<Ausencia, "inicio" | "retorno" | "dias">): string {
  const ultimo = new Date(Date.parse(`${a.retorno}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  return `${dataDoDia(a.inicio)} a ${dataDoDia(ultimo)} · retorno em ${dataDoDia(a.retorno)} · ${a.dias} ${a.dias === 1 ? "dia" : "dias"}`;
}

/** Soma dias a um `AAAA-MM-DD`. */
export const somarDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** A ausência de pé que ainda pode mudar de mãos: pedida, aguardando a confirmação ou confirmada (agendada, em curso ou vencida). */
export const estaDePe = (a: Pick<Ausencia, "situacao">) => !["encerrada", "recusada", "cancelada"].includes(a.situacao);

/** O ausente só visualiza: o motivo que os botões desabilitados mostram. */
export const MOTIVO_DO_AUSENTE = "Você está ausente: o sistema fica só para consulta.";

/** Quantos dias corridos há de `de` até `ate` (`AAAA-MM-DD`). */
export const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);

/** O nome de cada ato da linha do tempo da ausência. */
export const ROTULO_DO_ATO: Record<string, string> = {
  pedido: "Pedido de ausência",
  registro: "Registrada pelo supervisor",
  aprovacao: "Aprovada pelo supervisor",
  recusa: "Pedido recusado",
  confirmacao: "Confirmada pelo funcionário",
  recusa_ajuste: "Datas recusadas pelo funcionário",
  cancelamento: "Pedido cancelado",
  cancelamento_automatico: "Cancelada pelo sistema (a data de retorno chegou)",
  inicio: "Início da ausência",
  fim_pedido: "Fim antecipado pedido",
  fim_aprovado: "Fim antecipado aprovado",
  fim_recusado: "Fim antecipado recusado",
  prorrogacao: "Data de retorno alterada",
  encerramento: "Ausência encerrada",
  retorno: "Retorno confirmado",
};

/** O que o ato guardou que vale mostrar: o motivo, as datas novas e o que o início desfez. */
export function detalheDoAto(a: AtoDaAusencia): string | null {
  const d = a.dados ?? {};
  const partes: string[] = [];
  if (typeof d.motivo === "string" && d.motivo) partes.push(d.motivo);
  if (a.tipo === "prorrogacao" && typeof d.retorno_anterior === "string" && typeof d.retorno_novo === "string") {
    partes.push(`de ${dataDoDia(d.retorno_anterior)} para ${dataDoDia(d.retorno_novo)}`);
  }
  if (a.tipo === "aprovacao" && d.ajustou === true) partes.push("com as datas ajustadas");
  if (a.tipo === "fim_pedido" && typeof d.data === "string") partes.push(`voltar em ${dataDoDia(d.data)}`);
  if (a.tipo === "inicio") {
    const reservas = Array.isArray(d.reservas_desfeitas) ? d.reservas_desfeitas.length : 0;
    const execucoes = Array.isArray(d.execucoes_suspensas) ? d.execucoes_suspensas.length : 0;
    if (reservas > 0) partes.push(`${reservas} ${reservas === 1 ? "reserva de OS desfeita" : "reservas de OS desfeitas"}`);
    if (execucoes > 0) partes.push(`${execucoes} ${execucoes === 1 ? "execução suspensa" : "execuções suspensas"}`);
  }
  return partes.length > 0 ? partes.join(" · ") : null;
}
