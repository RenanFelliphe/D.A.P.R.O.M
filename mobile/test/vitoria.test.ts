import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lerEventosSse } from "../src/vitoria/sse";
import { destinoDaAcaoNoApp, telaAtualDe } from "../src/vitoria/telas";

describe("tela atual da Vitória", () => {
  it("as telas da APR e da execução levam o os_id", () => {
    assert.deepEqual(telaAtualDe("/os/abc/apr"), { tela: "apr", contexto: { os_id: "abc" } });
    assert.deepEqual(telaAtualDe("/os/abc/checklist"), { tela: "apr", contexto: { os_id: "abc" } });
    assert.deepEqual(telaAtualDe("/os/abc/aprovada"), { tela: "apr", contexto: { os_id: "abc" } });
    assert.deepEqual(telaAtualDe("/os/abc/execucao"), { tela: "execucao", contexto: { os_id: "abc" } });
  });

  it("o detalhe da OS vem depois das regras específicas", () => {
    assert.deepEqual(telaAtualDe("/os/abc"), { tela: "os_detalhe", contexto: { os_id: "abc" } });
  });

  it("lista, perfil e pontos têm as próprias telas", () => {
    assert.equal(telaAtualDe("/lista").tela, "quadro_os");
    assert.equal(telaAtualDe("/perfil").tela, "perfil");
    assert.equal(telaAtualDe("/ausencias").tela, "perfil");
    assert.equal(telaAtualDe("/pontos").tela, "gamificacao");
  });

  it("tela desconhecida cai no padrão", () => {
    assert.deepEqual(telaAtualDe("/avisos"), { tela: "padrao", contexto: {} });
  });
});

describe("para onde o Me leve lá vai no app", () => {
  const url = (u: string) => destinoDaAcaoNoApp({ url: u });

  it("a OS, a APR e a execução têm tela no app", () => {
    assert.deepEqual(url("/app/os/abc"), { tipo: "app", rota: "/os/abc" });
    assert.deepEqual(url("/app/os/abc/apr"), { tipo: "app", rota: "/os/abc/apr" });
    assert.deepEqual(url("/app/os/abc/execucao"), { tipo: "app", rota: "/os/abc/execucao" });
  });

  it("a lista e o perfil também", () => {
    assert.deepEqual(url("/app/lista"), { tipo: "app", rota: "/lista" });
    assert.deepEqual(url("/app/perfil"), { tipo: "app", rota: "/perfil" });
  });

  it("a pontuação, o ranking e as conquistas abrem a aba Pontos na seção certa", () => {
    assert.deepEqual(url("/app/gamificacao/minha"), { tipo: "app", rota: "/pontos", params: { aba: "minha" } });
    assert.deepEqual(url("/app/gamificacao/ranking"), { tipo: "app", rota: "/pontos", params: { aba: "ranking" } });
    assert.deepEqual(url("/app/gamificacao/conquistas"), { tipo: "app", rota: "/pontos", params: { aba: "conquistas" } });
  });

  it("o que só existe na web continua com o endereço da web", () => {
    assert.deepEqual(url("/app/lista?preventivas=1"), { tipo: "web", caminho: "/app/lista?preventivas=1" });
    assert.deepEqual(url("/app/dashboard/meus"), { tipo: "web", caminho: "/app/dashboard/meus" });
    assert.deepEqual(url("/app/gamificacao/patentes"), { tipo: "web", caminho: "/app/gamificacao/patentes" });
  });
});

describe("fluxo SSE da Vitória", () => {
  it("lê os pedaços de texto e o evento final", () => {
    const texto = 'event: texto\ndata: Olá, \n\nevent: texto\ndata: tudo bem?\n\nevent: final\ndata: {"acao":null,"expressao":"padrao"}\n\n';
    const eventos = lerEventosSse(texto);
    assert.equal(eventos.length, 3);
    assert.deepEqual(eventos[0], { event: "texto", data: "Olá, " });
    assert.equal(eventos[2]?.event, "final");
    assert.deepEqual(JSON.parse(eventos[2]!.data), { acao: null, expressao: "padrao" });
  });

  it("aceita fim de linha do Windows e várias linhas data", () => {
    const eventos = lerEventosSse("event: texto\r\ndata: a\r\ndata: b\r\n\r\n");
    assert.deepEqual(eventos, [{ event: "texto", data: "a\nb" }]);
  });

  it("ignora blocos vazios", () => {
    assert.deepEqual(lerEventosSse("\n\n\n\n"), []);
  });
});
