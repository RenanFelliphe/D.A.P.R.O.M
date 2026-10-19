import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ErroDeEvento, interpretarRespostaDoEvento, montarEnvioDoEvento, type RespostaEventos } from "@shared/api/eventos";
import { novoUuid } from "@shared/api/uuid";
import type { ClienteApi, OpcoesDeChamada } from "../src/api/cliente";
import { criarEnvio } from "../src/api/eventos";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const resposta = (extra: Partial<RespostaEventos> = {}): RespostaEventos => ({ confirmados: [], alertas: [], aprs: [], os: [], rejeitados: [], pendentes: [], pontos_ganhos: 0, ganhos: [], ...extra });

/** Um cliente falso que guarda o que foi chamado e responde o que o teste mandar. */
function clienteFalso(devolve: unknown) {
  const chamadas: { caminho: string; opcoes: OpcoesDeChamada }[] = [];
  const c = {
    async chamar(caminho: string, opcoes: OpcoesDeChamada = {}) {
      chamadas.push({ caminho, opcoes });
      return devolve;
    },
  } as unknown as ClienteApi;
  return { c, chamadas };
}

describe("eventos de campo", () => {
  it("monta {eventos: [{id, tipo, os_id, payload, ocorrido_em}]} com id e hora gerados no aparelho", () => {
    const { id, corpo } = montarEnvioDoEvento({ tipo: "execucao_iniciada", os_id: "os-1", payload: { apr_id: "apr-1" } }, () => new Date("2026-10-19T12:00:00Z"));
    assert.match(id, UUID);
    assert.deepEqual(corpo, { eventos: [{ id, tipo: "execucao_iniciada", os_id: "os-1", payload: { apr_id: "apr-1" }, ocorrido_em: "2026-10-19T12:00:00.000Z" }] });
  });

  it("respeita o id e a hora que o chamador deu (a fila reenvia o mesmo id) e usa os_id nulo quando não há OS", () => {
    const { id, corpo } = montarEnvioDoEvento({ id: "e1", tipo: "apr_concluida", payload: {}, ocorrido_em: "2026-10-19T08:00:00Z" });
    assert.equal(id, "e1");
    assert.deepEqual(corpo.eventos[0], { id: "e1", tipo: "apr_concluida", os_id: null, payload: {}, ocorrido_em: "2026-10-19T08:00:00Z" });
  });

  it("enviarEvento posta em /eventos e devolve a resposta com o id", async () => {
    const { c, chamadas } = clienteFalso(resposta({ confirmados: ["e1"], pontos_ganhos: 10, os: [{ id: "os-1", status: "em_execucao" }] }));
    const r = await criarEnvio(c).enviarEvento({ id: "e1", tipo: "execucao_iniciada", os_id: "os-1", payload: {}, ocorrido_em: "2026-10-19T08:00:00Z" });
    assert.equal(r.id, "e1");
    assert.equal(r.pontos_ganhos, 10);
    assert.equal(chamadas[0]!.caminho, "/eventos");
    assert.equal((chamadas[0]!.opcoes.corpo as { eventos: unknown[] }).eventos.length, 1);
  });

  it("evento recusado ou pendente lança ErroDeEvento com a mensagem da api", async () => {
    assert.throws(
      () => interpretarRespostaDoEvento(resposta({ rejeitados: [{ id: "e1", codigo: "apr_invalida", mensagem: "Preencha a APR antes de iniciar" }] }), "e1"),
      (e: unknown) => e instanceof ErroDeEvento && e.situacao === "rejeitado" && e.codigo === "apr_invalida" && e.message === "Preencha a APR antes de iniciar",
    );
    assert.throws(
      () => interpretarRespostaDoEvento(resposta({ pendentes: [{ id: "e1", codigo: "assinatura_pendente", mensagem: "Falta a assinatura" }] }), "e1"),
      (e: unknown) => e instanceof ErroDeEvento && e.situacao === "pendente",
    );
    // Recusa de OUTRO evento do mesmo envio não pesa sobre este.
    assert.equal(interpretarRespostaDoEvento(resposta({ rejeitados: [{ id: "outro", codigo: "x", mensagem: "y" }] }), "e1").id, "e1");
  });

  it("enviarArquivo faz PUT /arquivos/{id} com o tipo e devolve o id gerado no aparelho", async () => {
    const { c, chamadas } = clienteFalso({ id: "x", caminho: "x" });
    const id = await criarEnvio(c).enviarArquivo({ uri: "file:///foto.jpg", nome: "foto.jpg", tipoMime: "image/jpeg" }, "foto");
    assert.match(id, UUID);
    assert.equal(chamadas[0]!.caminho, `/arquivos/${id}`);
    assert.equal(chamadas[0]!.opcoes.metodo, "PUT");
    assert.equal(chamadas[0]!.opcoes.formulario!.get("tipo"), "foto");
  });

  it("novoUuid gera v4 válidos e diferentes, mesmo sem crypto no aparelho (Hermes)", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
    try {
      const a = novoUuid();
      const b = novoUuid();
      assert.match(a, UUID);
      assert.notEqual(a, b);
    } finally {
      if (original) Object.defineProperty(globalThis, "crypto", original);
    }
  });
});
