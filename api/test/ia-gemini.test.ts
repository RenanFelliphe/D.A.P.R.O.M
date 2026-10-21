import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IAIndisponivel, ProvedorIAGemini, RespostaIAInvalida, type PedidoDeTexto } from "../src/servicos/ia";

const MODELOS = { chatbot: "gemini-vitoria", minigames: "gemini-rascunho", recomendacao: "gemini-recomendacao", digitalizacao: "gemini-digitalizacao" };

interface Chamada {
  url: string;
  cabecalhos: Record<string, string>;
  corpo: any;
}

/** `fetch` falso: guarda o que o provedor mandou e devolve a próxima resposta programada. */
function buscaFalsa(respostas: Array<() => Response>) {
  const chamadas: Chamada[] = [];
  const buscar = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    chamadas.push({ url: String(entrada), cabecalhos: init?.headers as Record<string, string>, corpo: JSON.parse(String(init?.body)) });
    const proxima = respostas.shift();
    if (!proxima) throw new Error("nenhuma resposta programada");
    return proxima();
  }) as typeof fetch;
  return { buscar, chamadas };
}

const json = (corpo: unknown, status = 200) => () => new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
const candidato = (texto: string, finishReason = "STOP") => ({ candidates: [{ content: { role: "model", parts: [{ text: texto }] }, finishReason }] });

const PEDIDO: PedidoDeTexto = {
  modelo: "chatbot",
  mensagens: [
    { papel: "sistema", texto: "Você é a Vitória." },
    { papel: "sistema", texto: "Manual do técnico.", cache: true },
    { papel: "usuario", texto: "Como abro uma OS?" },
    { papel: "assistente", texto: "Pelo quadro." },
    { papel: "usuario", texto: "E a APR?" },
  ],
};

/** Um corpo de streaming SSE partido em pedaços, como a rede entrega (inclusive no meio de uma linha). */
function sse(pedacos: string[]): () => Response {
  const codificador = new TextEncoder();
  return () =>
    new Response(
      new ReadableStream({
        start(controle) {
          for (const p of pedacos) controle.enqueue(codificador.encode(p));
          controle.close();
        },
      }),
      { status: 200, headers: { "content-type": "text/event-stream" } },
    );
}

describe("ProvedorIAGemini", () => {
  it("disponivel() depende da chave", () => {
    assert.equal(new ProvedorIAGemini("", MODELOS, 1024).disponivel(), false);
    assert.equal(new ProvedorIAGemini("chave", MODELOS, 1024).disponivel(), true);
  });

  it("monta o pedido no formato do generateContent: chave no cabeçalho, sistema à parte e papéis user/model", async () => {
    const { buscar, chamadas } = buscaFalsa([json(candidato("oi"))]);
    const texto = await new ProvedorIAGemini("chave-secreta", MODELOS, 1024, buscar).conversar(PEDIDO);

    assert.equal(texto, "oi");
    const [chamada] = chamadas;
    assert.equal(chamada!.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-vitoria:generateContent");
    assert.ok(!chamada!.url.includes("chave-secreta"), "a chave nunca vai na URL");
    assert.equal(chamada!.cabecalhos["x-goog-api-key"], "chave-secreta");
    assert.deepEqual(chamada!.corpo.systemInstruction, { parts: [{ text: "Você é a Vitória." }, { text: "Manual do técnico." }] });
    assert.deepEqual(chamada!.corpo.contents, [
      { role: "user", parts: [{ text: "Como abro uma OS?" }] },
      { role: "model", parts: [{ text: "Pelo quadro." }] },
      { role: "user", parts: [{ text: "E a APR?" }] },
    ]);
  });

  it("dá folga ao limite de tokens para o pensamento do modelo, e respeita o maxTokens do pedido", async () => {
    const { buscar, chamadas } = buscaFalsa([json(candidato("a")), json(candidato("b"))]);
    const provedor = new ProvedorIAGemini("chave", MODELOS, 1000, buscar);
    await provedor.conversar(PEDIDO);
    await provedor.conversar({ ...PEDIDO, maxTokens: 200 });

    const [padrao, proprio] = chamadas.map((c) => c.corpo.generationConfig.maxOutputTokens);
    assert.ok(padrao > 1000 && padrao < 10_000);
    assert.equal(proprio - padrao, 200 - 1000);
  });

  it("manda as imagens como inlineData antes do texto e liga a saída em JSON quando há esquema", async () => {
    const { buscar, chamadas } = buscaFalsa([json(candidato("{}"))]);
    await new ProvedorIAGemini("chave", MODELOS, 1024, buscar).conversar({
      modelo: "digitalizacao",
      mensagens: [
        { papel: "sistema", texto: "Leia a folha." },
        { papel: "usuario", texto: "O que está escrito à mão?", imagens: [{ tipoMime: "image/jpeg", dados: new Uint8Array([1, 2, 3]) }, { tipoMime: "image/png", dados: new Uint8Array([4]) }] },
      ],
      schemaDeSaida: { type: "object" },
    });
    assert.deepEqual(chamadas[0]!.corpo.contents, [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: Buffer.from([1, 2, 3]).toString("base64") } },
          { inlineData: { mimeType: "image/png", data: Buffer.from([4]).toString("base64") } },
          { text: "O que está escrito à mão?" },
        ],
      },
    ]);
    assert.equal(chamadas[0]!.corpo.generationConfig.responseMimeType, "application/json");
  });

  it("sem esquema de saída, não força JSON", async () => {
    const { buscar, chamadas } = buscaFalsa([json(candidato("oi"))]);
    await new ProvedorIAGemini("chave", MODELOS, 1024, buscar).conversar(PEDIDO);
    assert.equal(chamadas[0]!.corpo.generationConfig.responseMimeType, undefined);
  });

  it("usa o modelo do uso lógico pedido", async () => {
    const { buscar, chamadas } = buscaFalsa([json(candidato("ok"))]);
    await new ProvedorIAGemini("chave", MODELOS, 1024, buscar).conversar({ ...PEDIDO, modelo: "minigames" });
    assert.match(chamadas[0]!.url, /models\/gemini-rascunho:generateContent$/);
  });

  it("descarta falas da assistente no começo da conversa e mensagens vazias", async () => {
    const { buscar, chamadas } = buscaFalsa([json(candidato("ok"))]);
    await new ProvedorIAGemini("chave", MODELOS, 1024, buscar).conversar({
      modelo: "chatbot",
      mensagens: [
        { papel: "assistente", texto: "Resposta de uma pergunta que ficou fora da janela." },
        { papel: "usuario", texto: "" },
        { papel: "usuario", texto: "Pergunta atual" },
      ],
    });
    assert.deepEqual(chamadas[0]!.corpo.contents, [{ role: "user", parts: [{ text: "Pergunta atual" }] }]);
    assert.equal(chamadas[0]!.corpo.systemInstruction, undefined);
  });

  it("junta as partes de texto e ignora as de pensamento", async () => {
    const corpo = { candidates: [{ content: { parts: [{ text: "raciocínio interno", thought: true }, { text: "Olá, " }, { text: "tudo bem?" }] }, finishReason: "STOP" }] };
    const { buscar } = buscaFalsa([json(corpo)]);
    assert.equal(await new ProvedorIAGemini("chave", MODELOS, 1024, buscar).conversar(PEDIDO), "Olá, tudo bem?");
  });

  it("HTTP ruim (chave inválida, cota esgotada) vira IAIndisponivel com o status", async () => {
    for (const status of [400, 403, 429, 503]) {
      const { buscar } = buscaFalsa([json({ error: { message: "ruim" } }, status)]);
      await assert.rejects(() => new ProvedorIAGemini("chave", MODELOS, 1024, buscar, []).conversar(PEDIDO), (erro: Error) => erro instanceof IAIndisponivel && erro.message.includes(String(status)));
    }
  });

  it("modelo sobrecarregado (503) tenta de novo e segue; cota (429) e chave ruim não repetem", async () => {
    const sobrecarga = json({ error: { code: 503, message: "This model is currently experiencing high demand." } }, 503);
    const comRepeticao = buscaFalsa([sobrecarga, sobrecarga, json(candidato("Voltei"))]);
    assert.equal(await new ProvedorIAGemini("chave", MODELOS, 1024, comRepeticao.buscar, [0, 0]).conversar(PEDIDO), "Voltei");
    assert.equal(comRepeticao.chamadas.length, 3);

    const semFolego = buscaFalsa([sobrecarga, sobrecarga, sobrecarga]);
    await assert.rejects(() => new ProvedorIAGemini("chave", MODELOS, 1024, semFolego.buscar, [0, 0]).conversarEmStreaming(PEDIDO)[Symbol.asyncIterator]().next(), (erro: Error) => erro instanceof IAIndisponivel && erro.message.includes("503"));
    assert.equal(semFolego.chamadas.length, 3);

    for (const status of [400, 429]) {
      const { buscar, chamadas } = buscaFalsa([json({ error: { message: "ruim" } }, status)]);
      await assert.rejects(() => new ProvedorIAGemini("chave", MODELOS, 1024, buscar, [0, 0], "gemini-reserva").conversar(PEDIDO), IAIndisponivel);
      assert.equal(chamadas.length, 1);
    }
  });

  it("classifica a falha: cota do dia, limite por minuto (com a espera), lotado e chave recusada", async () => {
    const cota429 = (quotaId: string) =>
      json(
        {
          error: {
            code: 429,
            message: "You exceeded your current quota. Please retry in 37.6s.",
            status: "RESOURCE_EXHAUSTED",
            details: [
              { "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId }] },
              { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "37s" },
            ],
          },
        },
        429,
      );
    const casos: Array<[() => Response, string, number | null]> = [
      [cota429("GenerateRequestsPerDayPerProjectPerModel-FreeTier"), "cota", 37],
      [cota429("GenerateRequestsPerMinutePerProjectPerModel-FreeTier"), "limite_por_minuto", 37],
      [json({ error: { code: 503, message: "high demand", status: "UNAVAILABLE" } }, 503), "sobrecarga", null],
      [json({ error: { code: 400, message: "API key not valid.", details: [{ reason: "API_KEY_INVALID" }] } }, 400), "chave", null],
      [json({ error: { code: 400, message: "Invalid argument" } }, 400), "fornecedor", null],
    ];
    for (const [resposta, motivo, espera] of casos) {
      const { buscar } = buscaFalsa([resposta]);
      await assert.rejects(
        () => new ProvedorIAGemini("chave", MODELOS, 1024, buscar, []).conversar(PEDIDO),
        (erro: Error) => erro instanceof IAIndisponivel && erro.motivo === motivo && erro.esperarSegundos === espera,
      );
    }
    const rede = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await assert.rejects(() => new ProvedorIAGemini("chave", MODELOS, 1024, rede).conversar(PEDIDO), (erro: Error) => erro instanceof IAIndisponivel && erro.motivo === "rede");
  });

  it("modelo principal lotado depois das novas tentativas passa para o modelo reserva", async () => {
    const sobrecarga = json({ error: { code: 503, message: "high demand" } }, 503);
    const { buscar, chamadas } = buscaFalsa([sobrecarga, sobrecarga, json(candidato("Pelo reserva"))]);
    assert.equal(await new ProvedorIAGemini("chave", MODELOS, 1024, buscar, [0], "gemini-reserva").conversar(PEDIDO), "Pelo reserva");
    assert.deepEqual(
      chamadas.map((c) => c.url.split("/models/")[1]),
      ["gemini-vitoria:generateContent", "gemini-vitoria:generateContent", "gemini-reserva:generateContent"],
    );
  });

  it("rede fora do ar vira IAIndisponivel", async () => {
    const buscar = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await assert.rejects(() => new ProvedorIAGemini("chave", MODELOS, 1024, buscar).conversar(PEDIDO), IAIndisponivel);
  });

  it("sem chave, lança IAIndisponivel sem chamar a rede", async () => {
    const { buscar, chamadas } = buscaFalsa([]);
    await assert.rejects(() => new ProvedorIAGemini("", MODELOS, 1024, buscar).conversar(PEDIDO), IAIndisponivel);
    assert.equal(chamadas.length, 0);
  });

  it("corpo que não é JSON vira IAIndisponivel", async () => {
    const { buscar } = buscaFalsa([() => new Response("<html>", { status: 200 })]);
    await assert.rejects(() => new ProvedorIAGemini("chave", MODELOS, 1024, buscar).conversar(PEDIDO), IAIndisponivel);
  });

  it("pedido bloqueado e resposta cortada pelo limite viram RespostaIAInvalida", async () => {
    const bloqueado = buscaFalsa([json({ promptFeedback: { blockReason: "SAFETY" } })]);
    await assert.rejects(() => new ProvedorIAGemini("chave", MODELOS, 1024, bloqueado.buscar).conversar(PEDIDO), (erro: Error) => erro instanceof RespostaIAInvalida && erro.message.includes("SAFETY"));

    const cortado = buscaFalsa([json({ candidates: [{ content: { parts: [] }, finishReason: "MAX_TOKENS" }] })]);
    await assert.rejects(() => new ProvedorIAGemini("chave", MODELOS, 1024, cortado.buscar).conversar(PEDIDO), (erro: Error) => erro instanceof RespostaIAInvalida && erro.message.includes("MAX_TOKENS"));
  });

  it("streaming: chama streamGenerateContent com alt=sse e remonta eventos partidos no meio da linha", async () => {
    const evento1 = `data: ${JSON.stringify(candidato("Olá, "))}\r\n\r\n`;
    const evento2 = `data: ${JSON.stringify(candidato("mundo!"))}\r\n\r\n`;
    const corte = Math.floor(evento2.length / 2);
    const { buscar, chamadas } = buscaFalsa([sse([evento1, evento2.slice(0, corte), evento2.slice(corte)])]);

    const pedacos: string[] = [];
    for await (const p of new ProvedorIAGemini("chave", MODELOS, 1024, buscar).conversarEmStreaming(PEDIDO)) pedacos.push(p.texto);

    assert.deepEqual(pedacos, ["Olá, ", "mundo!"]);
    assert.equal(chamadas[0]!.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-vitoria:streamGenerateContent?alt=sse");
  });

  it("streaming: erro no meio do fluxo vira IAIndisponivel", async () => {
    const { buscar } = buscaFalsa([sse([`data: ${JSON.stringify(candidato("parte"))}\n\n`, `data: ${JSON.stringify({ error: { message: "cota" } })}\n\n`])]);
    const pedacos: string[] = [];
    await assert.rejects(async () => {
      for await (const p of new ProvedorIAGemini("chave", MODELOS, 1024, buscar).conversarEmStreaming(PEDIDO)) pedacos.push(p.texto);
    }, IAIndisponivel);
    assert.deepEqual(pedacos, ["parte"]);
  });
});
