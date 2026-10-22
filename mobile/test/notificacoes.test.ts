import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { destinoDoAvisoNoApp } from "../src/avisos/destino";
import { destinoDoPush, lerDadosDoPush } from "../src/notificacoes/regras";

const dados = (extra: Record<string, unknown> = {}) => ({ alerta_id: "a1", tipo: "os_reservada", os_id: "os-1", destinatario_id: "u1", usuario_alvo_id: null, sugestao_id: null, ...extra });

describe("o que a notificação push traz", () => {
  it("lê os dados que a api manda", () => {
    assert.deepEqual(lerDadosDoPush(dados()), dados());
  });

  it("ignora o que não tem a forma esperada em vez de abrir uma tela errada", () => {
    assert.equal(lerDadosDoPush(null), null);
    assert.equal(lerDadosDoPush("texto"), null);
    assert.equal(lerDadosDoPush({}), null);
    assert.equal(lerDadosDoPush(dados({ alerta_id: "" })), null);
    assert.equal(lerDadosDoPush(dados({ destinatario_id: undefined })), null);
    assert.equal(lerDadosDoPush(dados({ tipo: "aviso_de_uma_versao_futura" })), null);
  });

  it("campo que não vem é nulo", () => {
    const lido = lerDadosDoPush({ alerta_id: "a1", tipo: "bloqueio", destinatario_id: "u1" });
    assert.deepEqual(lido, { alerta_id: "a1", tipo: "bloqueio", destinatario_id: "u1", os_id: null, usuario_alvo_id: null, sugestao_id: null });
  });
});

describe("para onde o toque na notificação leva", () => {
  it("abre a mesma tela do toque no sino", () => {
    assert.equal(destinoDoPush(lerDadosDoPush(dados())!, "u1"), "/os/os-1");
    assert.equal(destinoDoPush(lerDadosDoPush(dados({ tipo: "apr_para_assinar" }))!, "u1"), "/os/os-1/aprovada");
    assert.equal(destinoDoPush(lerDadosDoPush(dados({ tipo: "conferencia_para_decidir" }))!, "u1"), "/os/os-1/conferencia");
    assert.equal(destinoDoPush(lerDadosDoPush(dados({ tipo: "sugestao_materiais_nova", os_id: null, sugestao_id: "s-9" }))!, "u1"), "/materiais/s-9");
  });

  it("o convite leva à tela de convites; o aceite e a recusa, à etapa da APR de quem convidou", () => {
    assert.equal(destinoDoPush(lerDadosDoPush(dados({ tipo: "apr_convite" }))!, "u1"), "/convites");
    assert.equal(destinoDoPush(lerDadosDoPush(dados({ tipo: "apr_convite_cancelado" }))!, "u1"), "/convites");
    assert.equal(destinoDoPush(lerDadosDoPush(dados({ tipo: "apr_convite_aceito" }))!, "u1"), "/os/os-1/apr");
    assert.equal(destinoDoPush(lerDadosDoPush(dados({ tipo: "apr_convite_recusado" }))!, "u1"), "/os/os-1/apr");
    assert.equal(destinoDoAvisoNoApp({ tipo: "apr_convite_aceito", os_id: null, destinatario_id: "u1", usuario_alvo_id: null, sugestao_id: null }), null);
  });

  it("o aviso que só existe na web não abre tela: a notificação só abre o app", () => {
    assert.equal(destinoDoPush(lerDadosDoPush(dados({ tipo: "ausencia_pedida", os_id: null, usuario_alvo_id: "u2" }))!, "u1"), null);
  });

  it("a notificação de outra pessoa (o aparelho trocou de mãos) não abre a tela de quem não a recebeu", () => {
    assert.equal(destinoDoPush(lerDadosDoPush(dados({ destinatario_id: "u2" }))!, "u1"), null);
  });
});
