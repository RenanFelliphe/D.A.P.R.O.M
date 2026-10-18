/**
 * Contrato do módulo de IA genérico. Fica "desligado" (`ProvedorIAIndisponivel`) enquanto não há chave configurada, e
 * liga só com variáveis de ambiente (`IA_PROVEDOR` mais a chave: `ProvedorIAAnthropic` ou `ProvedorIAGemini`, escolhidos
 * em `criarProvedorIA`), sem mudar quem chama.
 */

export type PapelDeMensagem = "sistema" | "usuario" | "assistente";

export interface BlocoDeMensagem {
  papel: PapelDeMensagem;
  texto: string;
  /** Marca o bloco para o prompt caching da Anthropic (`cache_control`); provedores sem cache ignoram. */
  cache?: boolean;
}

/** Nome lógico do uso (não o nome do modelo real); a tradução para o modelo do provedor fica na configuração. */
export type ModeloLogico = "vitoria" | "rascunho" | "digitalizacao";

export interface PedidoDeTexto {
  modelo: ModeloLogico;
  mensagens: BlocoDeMensagem[];
  /**
   * JSON Schema da saída esperada; uso futuro (digitalização). O rascunho de treinamento não usa: pede linhas JSON pela
   * instrução, para mostrar o progresso a cada item que chega pelo streaming (`treinamento-servico-ia.ts`).
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

/** Rede fora do ar, chave ausente ou HTTP ruim: quem chama deve cair num fallback sem IA, nunca propagar um 500. */
export class IAIndisponivel extends Error {}

/** A resposta do modelo saiu fora do formato esperado (ex.: não respeitou o `schemaDeSaida`). */
export class RespostaIAInvalida extends Error {}
