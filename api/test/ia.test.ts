import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lerConfig } from "../src/config";
import { IAIndisponivel, ProvedorIAEmMemoria, ProvedorIAIndisponivel } from "../src/servicos/ia";
import { criarAmbiente } from "./ajuda";

const ENV_BASE = {
  DATABASE_URL: "postgres://localhost/teste",
  SUPABASE_URL: "http://supabase.local",
  SUPABASE_SERVICE_ROLE_KEY: "chave",
};

describe("Módulo de IA genérico", () => {
  it("sem ANTHROPIC_API_KEY, a configuração sobe com a IA desligada", () => {
    const config = lerConfig({ ...ENV_BASE });
    assert.equal(config.ia.anthropicApiKey, "");
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
    assert.equal(config.ia.anthropicApiKey, "chave-anthropic");
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
