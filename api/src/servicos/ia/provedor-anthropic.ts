import { falhaDeRede, IAIndisponivel, motivoDoStatus, RespostaIAInvalida, type BlocoDeMensagem, type ModeloLogico, type PedacoDeTexto, type PedidoDeTexto, type ProvedorIA } from "./tipos";

const URL_MENSAGENS = "https://api.anthropic.com/v1/messages";
const VERSAO_ANTHROPIC = "2023-06-01";
const TEMPO_LIMITE_MS = 60_000;

function blocoDeConteudo(bloco: BlocoDeMensagem) {
  return { type: "text" as const, text: bloco.texto, ...(bloco.cache ? { cache_control: { type: "ephemeral" as const } } : {}) };
}

/** O conteúdo de uma mensagem: as imagens antes do texto (a IA lê melhor a pergunta depois de ver a folha). */
function conteudoDaMensagem(bloco: BlocoDeMensagem) {
  const imagens = (bloco.imagens ?? []).map((i) => ({
    type: "image" as const,
    source: { type: "base64" as const, media_type: i.tipoMime, data: Buffer.from(i.dados).toString("base64") },
  }));
  return [...imagens, blocoDeConteudo(bloco)];
}

/**
 * Implementação real do módulo de IA: `fetch` nativo contra a API de mensagens da Anthropic (sem lib HTTP extra,
 * mesmo padrão de `sap-http.ts`/`rh-http.ts`), com streaming SSE do próprio protocolo da Anthropic e `cache_control`
 * nos blocos marcados como `cache: true`. Qualquer falha de rede/HTTP vira `IAIndisponivel`; nunca deixa uma
 * exceção crua escapar, para quem chama poder cair num fallback.
 */
export class ProvedorIAAnthropic implements ProvedorIA {
  constructor(
    private readonly apiKey: string,
    private readonly modelos: Record<ModeloLogico, string>,
    private readonly maxTokensPadrao: number,
    private readonly buscar: typeof fetch = fetch,
  ) {}

  disponivel(): boolean {
    return Boolean(this.apiKey);
  }

  private corpo(pedido: PedidoDeTexto, streaming: boolean) {
    const system = pedido.mensagens.filter((m) => m.papel === "sistema").map(blocoDeConteudo);
    const messages = pedido.mensagens
      .filter((m) => m.papel !== "sistema")
      .map((m) => ({ role: m.papel === "usuario" ? "user" : "assistant", content: conteudoDaMensagem(m) }));
    return {
      model: this.modelos[pedido.modelo],
      max_tokens: pedido.maxTokens ?? this.maxTokensPadrao,
      ...(system.length > 0 ? { system } : {}),
      messages,
      stream: streaming,
    };
  }

  private async requisitar(pedido: PedidoDeTexto, streaming: boolean): Promise<Response> {
    if (!this.apiKey) throw new IAIndisponivel("ANTHROPIC_API_KEY não configurada", { motivo: "chave" });
    let resposta: Response;
    try {
      resposta = await this.buscar(URL_MENSAGENS, {
        method: "POST",
        headers: { "x-api-key": this.apiKey, "anthropic-version": VERSAO_ANTHROPIC, "content-type": "application/json" },
        body: JSON.stringify(this.corpo(pedido, streaming)),
        signal: AbortSignal.timeout(pedido.tempoLimiteMs ?? TEMPO_LIMITE_MS),
      });
    } catch (erro) {
      throw falhaDeRede("Anthropic", erro);
    }
    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => "");
      throw new IAIndisponivel(`Anthropic respondeu ${resposta.status}${detalhe ? `: ${detalhe.slice(0, 300)}` : ""}`, motivoDoStatus(resposta.status, detalhe));
    }
    return resposta;
  }

  async conversar(pedido: PedidoDeTexto): Promise<string> {
    const resposta = await this.requisitar(pedido, false);
    let corpo: any;
    try {
      corpo = await resposta.json();
    } catch (erro) {
      throw new IAIndisponivel("Resposta inválida da Anthropic: o corpo não é um JSON", { cause: erro });
    }
    const texto = corpo?.content?.find((bloco: any) => bloco?.type === "text")?.text;
    if (typeof texto !== "string") throw new RespostaIAInvalida("Resposta da Anthropic sem bloco de texto");
    return texto;
  }

  async *conversarEmStreaming(pedido: PedidoDeTexto): AsyncIterable<PedacoDeTexto> {
    const resposta = await this.requisitar(pedido, true);
    if (!resposta.body) throw new IAIndisponivel("Anthropic não devolveu um corpo de streaming");
    const leitor = resposta.body.getReader();
    const decodificador = new TextDecoder();
    let restante = "";
    try {
      while (true) {
        const { done, value } = await leitor.read();
        if (done) break;
        restante += decodificador.decode(value, { stream: true });
        const linhas = restante.split("\n");
        restante = linhas.pop() ?? "";
        for (const linha of linhas) {
          if (!linha.startsWith("data: ")) continue;
          const dado = linha.slice("data: ".length).trim();
          if (!dado || dado === "[DONE]") continue;
          let evento: any;
          try {
            evento = JSON.parse(dado);
          } catch {
            continue;
          }
          if (evento?.type === "content_block_delta" && evento.delta?.type === "text_delta" && typeof evento.delta.text === "string") {
            yield { texto: evento.delta.text };
          } else if (evento?.type === "error") {
            const motivo = evento.error?.type === "overloaded_error" || evento.error?.type === "api_error" ? "sobrecarga" : evento.error?.type === "rate_limit_error" ? "limite_por_minuto" : "fornecedor";
            throw new IAIndisponivel(`Anthropic interrompeu o streaming: ${evento.error?.message ?? "erro desconhecido"}`, { motivo });
          }
        }
      }
    } catch (erro) {
      if (erro instanceof IAIndisponivel) throw erro;
      throw new IAIndisponivel(`Falha ao ler o streaming da Anthropic: ${erro instanceof Error ? erro.message : String(erro)}`, { cause: erro, motivo: "rede" });
    }
  }
}
