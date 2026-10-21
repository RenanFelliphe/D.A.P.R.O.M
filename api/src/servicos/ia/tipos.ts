/**
 * Contrato do módulo de IA genérico. Fica "desligado" (`ProvedorIAIndisponivel`) enquanto não há chave configurada, e
 * liga só com variáveis de ambiente (`IA_PROVEDOR` mais a chave: `ProvedorIAAnthropic` ou `ProvedorIAGemini`, escolhidos
 * em `criarProvedorIA`), sem mudar quem chama.
 */

import type { FuncaoDeIA } from "../../../../shared/ia/funcoes";

export type PapelDeMensagem = "sistema" | "usuario" | "assistente";

/** Uma imagem anexada a uma mensagem (a folha digitalizada que a IA de visão lê). */
export interface ImagemDeMensagem {
  tipoMime: "image/jpeg" | "image/png";
  dados: Uint8Array;
}

export interface BlocoDeMensagem {
  papel: PapelDeMensagem;
  texto: string;
  /** Imagens que acompanham o texto, na ordem; só as mensagens do usuário as levam. */
  imagens?: ImagemDeMensagem[];
  /** Marca o bloco para o prompt caching da Anthropic (`cache_control`); provedores sem cache ignoram. */
  cache?: boolean;
}

/**
 * Nome lógico do uso (não o nome do modelo real); a tradução para o modelo do provedor fica na configuração. É o mesmo nome da
 * função de IA que o admin liga e desliga (`shared/ia/funcoes.ts`): chatbot (a Vitória), minigames (o rascunho dos
 * treinamentos), recomendacao (o modelo de APR de cada OS) e digitalizacao.
 */
export type ModeloLogico = FuncaoDeIA;

export interface PedidoDeTexto {
  modelo: ModeloLogico;
  mensagens: BlocoDeMensagem[];
  /**
   * JSON Schema da saída esperada. A digitalização usa: no Gemini liga a saída em JSON da própria API (`responseMimeType`);
   * na Anthropic o formato vai só na instrução. Em qualquer provedor quem chama confere a resposta (Zod): o esquema não a
   * garante. O rascunho de treinamento não usa: pede linhas JSON pela instrução, para mostrar o progresso a cada item que
   * chega pelo streaming (`treinamento-servico-ia.ts`).
   */
  schemaDeSaida?: Record<string, unknown>;
  /** Sobrepõe o limite padrão de tokens de resposta da configuração, quando o chamador precisar de outro valor. */
  maxTokens?: number;
  /** Sobrepõe o tempo limite padrão da chamada (60 s), streaming incluído; o rascunho de treinamento leva de 1 a 2 minutos. */
  tempoLimiteMs?: number;
}

export interface PedacoDeTexto {
  texto: string;
}

export interface ProvedorIA {
  /** `false` enquanto não há chave configurada (ou, em testes, enquanto o provedor em memória não tiver respostas). */
  disponivel(): boolean;
  conversar(pedido: PedidoDeTexto): Promise<string>;
  conversarEmStreaming(pedido: PedidoDeTexto): AsyncIterable<PedacoDeTexto>;
}

/**
 * Por que a IA não respondeu, para o admin saber de quem é o problema:
 * - `cota`: a cota do dia (Gemini gratuito) ou o crédito (Anthropic) acabou; só volta quando renovar ou recarregar.
 * - `limite_por_minuto`: pedidos demais em pouco tempo; volta em segundos (`esperarSegundos`, quando o fornecedor diz).
 * - `sobrecarga`: o servidor do fornecedor está lotado ou com erro interno (5xx), mesmo depois das novas tentativas.
 * - `chave`: sem chave configurada, ou o fornecedor recusou a chave.
 * - `desligada`: o administrador desligou esta função de IA (ou ainda não autorizou a leitura dos dados dela).
 * - `rede`: não foi possível falar com o fornecedor (rede fora do ar ou tempo esgotado).
 * - `fornecedor`: outra recusa do fornecedor (pedido rejeitado, resposta quebrada).
 */
export type MotivoDaFalhaIA = "cota" | "limite_por_minuto" | "sobrecarga" | "chave" | "rede" | "fornecedor" | "desligada";

/** Rede fora do ar, chave ausente ou HTTP ruim: quem chama deve cair num fallback sem IA, nunca propagar um 500. */
export class IAIndisponivel extends Error {
  readonly motivo: MotivoDaFalhaIA;
  readonly esperarSegundos: number | null;

  constructor(mensagem: string, opcoes: { cause?: unknown; motivo?: MotivoDaFalhaIA; esperarSegundos?: number | null } = {}) {
    super(mensagem, opcoes.cause === undefined ? undefined : { cause: opcoes.cause });
    this.motivo = opcoes.motivo ?? "fornecedor";
    this.esperarSegundos = opcoes.esperarSegundos ?? null;
  }
}

/**
 * Classifica uma resposta HTTP ruim do fornecedor. O 429 do Gemini diz no `quotaId` se a cota é do dia ("PerDay") ou do
 * minuto, e no `RetryInfo` quanto esperar; o da Anthropic é sempre por minuto. A Anthropic avisa o crédito esgotado num 400.
 */
export function motivoDoStatus(status: number, corpo: string): { motivo: MotivoDaFalhaIA; esperarSegundos: number | null } {
  const espera = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(corpo) ?? /retry in (\d+(?:\.\d+)?)\s*s/i.exec(corpo);
  const esperarSegundos = espera ? Math.ceil(Number(espera[1])) : null;
  if (status === 429) return { motivo: /PerDay|per.day|daily/i.test(corpo) ? "cota" : "limite_por_minuto", esperarSegundos };
  if (/credit balance|billing|insufficient.?quota/i.test(corpo)) return { motivo: "cota", esperarSegundos: null };
  if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid|invalid x-api-key/i.test(corpo)) return { motivo: "chave", esperarSegundos: null };
  if (status >= 500) return { motivo: "sobrecarga", esperarSegundos: null };
  return { motivo: "fornecedor", esperarSegundos: null };
}

/** Rede fora do ar ou tempo esgotado (`AbortSignal.timeout`) viram o mesmo motivo: o fornecedor não foi alcançado. */
export const falhaDeRede = (fornecedor: string, erro: unknown) =>
  new IAIndisponivel(`${fornecedor} inacessível: ${erro instanceof Error ? erro.message : String(erro)}`, { cause: erro, motivo: "rede" });

/** A resposta do modelo saiu fora do formato esperado (ex.: não respeitou o `schemaDeSaida`). */
export class RespostaIAInvalida extends Error {}
