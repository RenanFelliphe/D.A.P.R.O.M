import { IAIndisponivel, RespostaIAInvalida, type ModeloLogico, type PedacoDeTexto, type PedidoDeTexto, type ProvedorIA } from "./tipos";

const URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const TEMPO_LIMITE_MS = 60_000;
/**
 * Os modelos 3.x do Gemini pensam antes de responder, e esse pensamento conta contra `maxOutputTokens`: sem folga, uma
 * resposta curta pode sair vazia (`finishReason: MAX_TOKENS`). O limite que a configuração fala é o da resposta visível.
 */
const MARGEM_DE_PENSAMENTO = 4096;

/**
 * Implementação do módulo de IA para a API do Gemini (Google): `fetch` nativo contra `generateContent`, com streaming SSE
 * (`streamGenerateContent?alt=sse`), no mesmo padrão de `provedor-anthropic.ts`. A chave vai no cabeçalho
 * `x-goog-api-key`, nunca na URL. Qualquer falha de rede/HTTP vira `IAIndisponivel`, e uma resposta sem texto (pedido
 * bloqueado, cortada pelo limite) vira `RespostaIAInvalida`; nenhuma exceção crua escapa, para quem chama cair num fallback.
 * O prompt caching (`cache: true`) é ignorado: o Gemini faz o cache implícito sozinho.
 */
export class ProvedorIAGemini implements ProvedorIA {
  constructor(
    private readonly apiKey: string,
    private readonly modelos: Record<ModeloLogico, string>,
    private readonly maxTokensPadrao: number,
    private readonly buscar: typeof fetch = fetch,
  ) {}

  disponivel(): boolean {
    return Boolean(this.apiKey);
  }

  private corpo(pedido: PedidoDeTexto) {
    const sistema = pedido.mensagens.filter((m) => m.papel === "sistema" && m.texto);
    const conversa = pedido.mensagens.filter((m) => m.papel !== "sistema" && m.texto);
    // O Gemini quer a conversa começando pelo usuário, e a janela do histórico pode começar numa fala da assistente.
    const inicio = conversa.findIndex((m) => m.papel === "usuario");
    const contents = (inicio === -1 ? [] : conversa.slice(inicio)).map((m) => ({
      role: m.papel === "usuario" ? "user" : "model",
      parts: [{ text: m.texto }],
    }));
    return {
      ...(sistema.length > 0 ? { systemInstruction: { parts: sistema.map((m) => ({ text: m.texto })) } } : {}),
      contents,
      generationConfig: { maxOutputTokens: (pedido.maxTokens ?? this.maxTokensPadrao) + MARGEM_DE_PENSAMENTO },
    };
  }

  private async requisitar(pedido: PedidoDeTexto, streaming: boolean): Promise<Response> {
    if (!this.apiKey) throw new IAIndisponivel("GEMINI_API_KEY não configurada");
    const metodo = streaming ? "streamGenerateContent?alt=sse" : "generateContent";
    let resposta: Response;
    try {
      resposta = await this.buscar(`${URL_BASE}/${encodeURIComponent(this.modelos[pedido.modelo])}:${metodo}`, {
        method: "POST",
        headers: { "x-goog-api-key": this.apiKey, "content-type": "application/json" },
        body: JSON.stringify(this.corpo(pedido)),
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
    } catch (erro) {
      throw new IAIndisponivel(`Gemini inacessível: ${erro instanceof Error ? erro.message : String(erro)}`, { cause: erro });
    }
    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => "");
      throw new IAIndisponivel(`Gemini respondeu ${resposta.status}${detalhe ? `: ${detalhe.slice(0, 300)}` : ""}`);
    }
    return resposta;
  }

  /** O texto de uma resposta (ou de um pedaço do streaming), sem as partes de "pensamento"; lança se o pedido foi bloqueado. */
  private textoDe(corpo: any): { texto: string; encerramento: string | undefined } {
    if (corpo?.error) throw new IAIndisponivel(`Gemini respondeu com erro: ${corpo.error.message ?? "erro desconhecido"}`);
    const bloqueio = corpo?.promptFeedback?.blockReason;
    if (bloqueio) throw new RespostaIAInvalida(`Gemini bloqueou o pedido: ${bloqueio}`);
    const candidato = corpo?.candidates?.[0];
    const partes: any[] = Array.isArray(candidato?.content?.parts) ? candidato.content.parts : [];
    const texto = partes.filter((p) => typeof p?.text === "string" && !p.thought).map((p) => p.text).join("");
    return { texto, encerramento: candidato?.finishReason };
  }

  async conversar(pedido: PedidoDeTexto): Promise<string> {
    const resposta = await this.requisitar(pedido, false);
    let corpo: any;
    try {
      corpo = await resposta.json();
    } catch (erro) {
      throw new IAIndisponivel("Resposta inválida do Gemini: o corpo não é um JSON", { cause: erro });
    }
    const { texto, encerramento } = this.textoDe(corpo);
    if (!texto) throw new RespostaIAInvalida(`Resposta do Gemini sem texto${encerramento ? ` (finishReason: ${encerramento})` : ""}`);
    return texto;
  }

  async *conversarEmStreaming(pedido: PedidoDeTexto): AsyncIterable<PedacoDeTexto> {
    const resposta = await this.requisitar(pedido, true);
    if (!resposta.body) throw new IAIndisponivel("Gemini não devolveu um corpo de streaming");
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
          if (!linha.startsWith("data:")) continue;
          const dado = linha.slice("data:".length).trim();
          if (!dado) continue;
          let evento: any;
          try {
            evento = JSON.parse(dado);
          } catch {
            continue;
          }
          const { texto } = this.textoDe(evento);
          if (texto) yield { texto };
        }
      }
    } catch (erro) {
      if (erro instanceof IAIndisponivel || erro instanceof RespostaIAInvalida) throw erro;
      throw new IAIndisponivel(`Falha ao ler o streaming do Gemini: ${erro instanceof Error ? erro.message : String(erro)}`, { cause: erro });
    }
  }
}
