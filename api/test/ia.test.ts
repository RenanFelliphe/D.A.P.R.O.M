import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lerConfig } from "../src/config";
import { criarProvedorIA, IAIndisponivel, ProvedorIAAnthropic, ProvedorIAEmMemoria, ProvedorIAGemini, ProvedorIAIndisponivel } from "../src/servicos/ia";
import { criarAmbiente } from "./ajuda";

const ENV_BASE = {
  DATABASE_URL: "postgres://localhost/teste",
  SUPABASE_URL: "http://supabase.local",
  SUPABASE_SERVICE_ROLE_KEY: "chave",
};

describe("Módulo de IA genérico", () => {
  it("sem ANTHROPIC_API_KEY, a configuração sobe com a IA desligada", () => {
    const config = lerConfig({ ...ENV_BASE });
    assert.equal(config.ia.provedor, "anthropic");
    assert.equal(config.ia.apiKey, "");
    assert.equal(config.ia.ligada, false);
    // Defaults seguros, nunca derrubam a subida.
    assert.equal(config.vitoria.limitePorConversa, 20);
    assert.equal(config.vitoria.limitePorContaDia, 40);
    assert.equal(config.vitoria.limiteGlobalDia, 1000);
    assert.ok(config.vitoria.maxTokensResposta > 0);
    assert.ok(config.ia.modelos.vitoria.length > 0);
  });

  it("com ANTHROPIC_API_KEY, a configuração liga a IA", () => {
    const config = lerConfig({ ...ENV_BASE, ANTHROPIC_API_KEY: "chave-anthropic" });
    assert.equal(config.ia.ligada, true);
    assert.equal(config.ia.apiKey, "chave-anthropic");
    assert.equal(config.ia.modelos.vitoria, "claude-haiku-5-5");
  });

  it("com IA_PROVEDOR=gemini, a chave e os modelos são os do Gemini; a chave da Anthropic não liga a IA", () => {
    const semChave = lerConfig({ ...ENV_BASE, IA_PROVEDOR: "gemini", ANTHROPIC_API_KEY: "chave-anthropic" });
    assert.equal(semChave.ia.provedor, "gemini");
    assert.equal(semChave.ia.ligada, false);

    const config = lerConfig({ ...ENV_BASE, IA_PROVEDOR: "gemini", GEMINI_API_KEY: "  chave-gemini\n", GEMINI_MODELO_VITORIA: "gemini-3.5-flash-lite" });
    assert.equal(config.ia.ligada, true);
    assert.equal(config.ia.apiKey, "chave-gemini");
    assert.equal(config.ia.modelos.vitoria, "gemini-3.5-flash-lite");
    assert.equal(config.ia.modelos.rascunho, "gemini-3.8-flash");
  });

  it("IA_PROVEDOR desconhecido derruba a subida, em vez de cair em outro provedor sem avisar", () => {
    assert.throws(() => lerConfig({ ...ENV_BASE, IA_PROVEDOR: "gemini-pro" }));
  });

  it("criarProvedorIA escolhe o provedor pela configuração", () => {
    const maxTokens = 1024;
    assert.ok(criarProvedorIA(lerConfig({ ...ENV_BASE }).ia, maxTokens) instanceof ProvedorIAIndisponivel);
    assert.ok(criarProvedorIA(lerConfig({ ...ENV_BASE, ANTHROPIC_API_KEY: "a" }).ia, maxTokens) instanceof ProvedorIAAnthropic);
    assert.ok(criarProvedorIA(lerConfig({ ...ENV_BASE, IA_PROVEDOR: "gemini", GEMINI_API_KEY: "g" }).ia, maxTokens) instanceof ProvedorIAGemini);
    assert.ok(criarProvedorIA(lerConfig({ ...ENV_BASE, IA_PROVEDOR: "gemini" }).ia, maxTokens) instanceof ProvedorIAIndisponivel);
  });

  it("a api sobe normalmente sem ANTHROPIC_API_KEY", async () => {
    const amb = await criarAmbiente();
    try {
      await amb.esperar(200, "GET", "/saude");
    } finally {
      await amb.fechar();
    }
  });

  it("ProvedorIAIndisponivel nunca fica disponível e sempre lança IAIndisponivel", async () => {
    const provedor = new ProvedorIAIndisponivel();
    assert.equal(provedor.disponivel(), false);
    await assert.rejects(() => provedor.conversar({ modelo: "vitoria", mensagens: [{ papel: "usuario", texto: "oi" }] }), IAIndisponivel);
    assert.throws(() => provedor.conversarEmStreaming({ modelo: "vitoria", mensagens: [{ papel: "usuario", texto: "oi" }] }), IAIndisponivel);
  });

  it("ProvedorIAEmMemoria devolve as respostas programadas em ordem e registra as chamadas", async () => {
    const provedor = new ProvedorIAEmMemoria();
    provedor.respostas.push("primeira", "segunda");
    const pedido1 = { modelo: "vitoria" as const, mensagens: [{ papel: "usuario" as const, texto: "pergunta 1" }] };
    const pedido2 = { modelo: "vitoria" as const, mensagens: [{ papel: "usuario" as const, texto: "pergunta 2" }] };

    assert.equal(await provedor.conversar(pedido1), "primeira");
    assert.equal(await provedor.conversar(pedido2), "segunda");
    assert.equal(provedor.chamadas.length, 2);
    assert.deepEqual(provedor.chamadas[0], pedido1);
    assert.deepEqual(provedor.chamadas[1], pedido2);
  });

  it("ProvedorIAEmMemoria também serve respostas em streaming", async () => {
    const provedor = new ProvedorIAEmMemoria();
    provedor.respostas.push("resposta em pedaços");
    const pedacos: string[] = [];
    for await (const pedaco of provedor.conversarEmStreaming({ modelo: "vitoria", mensagens: [{ papel: "usuario", texto: "oi" }] })) {
      pedacos.push(pedaco.texto);
    }
    assert.deepEqual(pedacos, ["resposta em pedaços"]);
  });

  it("ProvedorIAEmMemoria com falhar=true simula IAIndisponivel", async () => {
    const provedor = new ProvedorIAEmMemoria();
    provedor.falhar = true;
    assert.equal(provedor.disponivel(), false);
    await assert.rejects(() => provedor.conversar({ modelo: "vitoria", mensagens: [{ papel: "usuario", texto: "oi" }] }), IAIndisponivel);
  });

  it("ambiente de teste expõe amb.ia como o ProvedorIAEmMemoria usado pela api", async () => {
    const amb = await criarAmbiente();
    try {
      assert.ok(amb.ia instanceof ProvedorIAEmMemoria);
      assert.equal(amb.deps.ia, amb.ia);
    } finally {
      await amb.fechar();
    }
  });
});
