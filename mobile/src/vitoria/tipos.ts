import type { AcaoResolvida } from "@shared/vitoria/destinos";
import type { Reacao } from "@shared/vitoria/reacoes";
import type { SugestaoFixa } from "@shared/vitoria/sugestoes";

/** Até quantas mensagens anteriores o app reenvia a cada pedido (a conversa não é guardada no servidor). */
export const HISTORICO_MAXIMO = 10;

export interface FigurinhaDaMensagem {
  reacao: Reacao;
  /** `true` quando a pessoa pediu a emoção: a animação toca inteira. */
  completa: boolean;
  /** Falso quando a animação já tocou ou a mensagem chegou com o painel fechado: fica o quadro parado. */
  tocar: boolean;
}

export interface MensagemVitoria {
  id: string;
  papel: "usuario" | "assistente";
  texto: string;
  /** Só nas respostas da Vitória: a `api` devolve `padrao`, `alerta` ou `ops`, e o app transforma em figurinha (`reacaoDaExpressao`). */
  expressao?: string;
  acao?: AcaoResolvida | null;
  figurinha?: FigurinhaDaMensagem;
  /** Saudação, agradecimento ou pedido para imitar uma emoção, respondidos pelo app sem a `api`: não vão no histórico nem contam no limite. */
  local?: boolean;
}

/** O que a `api` manda no evento `final` do fluxo. */
export interface RespostaFinalDaVitoria {
  acao: AcaoResolvida | null;
  expressao?: string;
  motivo?: "limite_conversa" | "limite_conta" | "limite_global" | "sem_ia";
  sugestoes?: SugestaoFixa[];
}
