/**
 * Contrato do módulo de IA genérico (Claude/Anthropic). Fica "desligado" (`ProvedorIAIndisponivel`) enquanto não há
 * chave configurada, e liga trocando só a variável de ambiente (`ProvedorIAAnthropic`), sem mudar quem chama.
 */

export type PapelDeMensagem = "sistema" | "usuario" | "assistente";

export interface BlocoDeMensagem {
  papel: PapelDeMensagem;
  texto: string;
  /** Marca o bloco para o prompt caching da Anthropic (`cache_control`); provedores sem cache ignoram. */
  cache?: boolean;
}

/** Nome lógico do uso (não o nome do modelo real); a tradução para o modelo da Anthropic fica na configuração. */
export type ModeloLogico = "vitoria" | "rascunho" | "digitalizacao";

export interface PedidoDeTexto {
  modelo: ModeloLogico;
  mensagens: BlocoDeMensagem[];
  /** JSON Schema da saída esperada; uso futuro (saída estruturada de treinamentos/digitalização), não usado nesta fase. */
  schemaDeSaida?: Record<string, unknown>;
  /** Sobrepõe o limite padrão de tokens de resposta da configuração, quando o chamador precisar de outro valor. */
  maxTokens?: number;
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
