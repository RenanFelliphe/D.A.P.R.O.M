import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ConviteFeito, SituacaoDoConvite } from "@shared/api/apr-convite";
import { conviteADesfazer, faltaNoMotivoDaRecusa, quemConvidar, restanteDoConvite, seloDoConvite } from "../src/convites/regras";

const convite = (id: string, situacao: SituacaoDoConvite): ConviteFeito => ({
  id: `c-${id}`,
  os_id: "os-1",
  convidado: { id, nome: `Pessoa ${id}`, matricula: id },
  situacao,
  motivo: situacao === "recusado" ? "Folga" : null,
  criado_em: "2026-10-22T15:00:00Z",
  expira_em: "2026-10-22T15:15:00Z",
  respondido_em: null,
});

describe("quem o responsável ainda convida", () => {
  const convites = [convite("ana", "aguardando"), convite("bia", "aceito"), convite("caio", "recusado"), convite("duda", "sem_resposta")];

  it("não convida a si mesmo nem quem já tem convite em aberto (aguardando ou aceito)", () => {
    assert.deepEqual(quemConvidar(["eu", "ana", "bia"], "eu", convites), []);
  });

  it("convida quem não tem convite e convida de novo quem recusou ou não respondeu", () => {
    assert.deepEqual(quemConvidar(["eu", "ana", "caio", "duda", "eva"], "eu", convites), ["caio", "duda", "eva"]);
  });

  it("sem convites nenhum, convida todos os marcados menos o responsável", () => {
    assert.deepEqual(quemConvidar(["eu", "ana", "bia"], "eu", []), ["ana", "bia"]);
  });
});

describe("tirar alguém da lista", () => {
  const convites = [convite("ana", "aguardando"), convite("bia", "aceito"), convite("caio", "recusado")];
  it("desfaz o convite em aberto da pessoa; o recusado e quem não foi convidado não têm o que desfazer", () => {
    assert.equal(conviteADesfazer(convites, "ana")?.id, "c-ana");
    assert.equal(conviteADesfazer(convites, "bia")?.id, "c-bia");
    assert.equal(conviteADesfazer(convites, "caio"), null);
    assert.equal(conviteADesfazer(convites, "eva"), null);
  });
});

describe("o selo e o prazo", () => {
  it("cada situação tem o seu selo", () => {
    assert.deepEqual(seloDoConvite({ situacao: "aguardando" }), { tom: "exe", rotulo: "Aguardando resposta" });
    assert.deepEqual(seloDoConvite({ situacao: "aceito" }), { tom: "enc", rotulo: "Aceitou" });
    assert.deepEqual(seloDoConvite({ situacao: "recusado" }), { tom: "blq", rotulo: "Não pode" });
    assert.deepEqual(seloDoConvite({ situacao: "sem_resposta" }), { tom: "al", rotulo: "Sem resposta" });
  });

  it("o tempo restante: minutos arredondados para cima, depois segundos, e nada quando acabou", () => {
    const base = Date.parse("2026-10-22T15:00:00Z");
    assert.equal(restanteDoConvite("2026-10-22T15:15:00Z", base), "15 min");
    assert.equal(restanteDoConvite("2026-10-22T15:15:00Z", base + 13 * 60_000 + 30_000), "2 min");
    assert.equal(restanteDoConvite("2026-10-22T15:15:00Z", base + 14 * 60_000 + 10_000), "50 s");
    assert.equal(restanteDoConvite("2026-10-22T15:15:00Z", base + 14 * 60_000 + 40_000), "20 s");
    assert.equal(restanteDoConvite("2026-10-22T15:15:00Z", base + 15 * 60_000), null);
    assert.equal(restanteDoConvite("lixo", base), null);
  });

  it("o motivo da recusa: obrigatório e curto", () => {
    assert.equal(faltaNoMotivoDaRecusa("  "), "Diga por que você não pode participar.");
    assert.equal(faltaNoMotivoDaRecusa("Estou em outro serviço"), null);
    assert.match(faltaNoMotivoDaRecusa("x".repeat(161))!, /passa de 160/);
  });
});
