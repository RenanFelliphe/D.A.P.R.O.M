import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Usuario } from "@shared/api/tipos";
import type { ColegaDaEquipe } from "../src/apr/consultas";
import { equipeDaApr } from "../src/apr/equipe";

const eu = { id: "u-eu", nome: "Eu", matricula: "1", cargo: "Técnico", perfil: "tecnico", assinatura_path: "sig-eu" } as Usuario;
const colega = (id: string, extra: Partial<ColegaDaEquipe> = {}): ColegaDaEquipe => ({ id, nome: id, matricula: id, cargo: null, perfil: "tecnico", assinatura_path: null, ...extra });

describe("equipe da APR", () => {
  it("quem está logado vem primeiro e os demais ficam na ordem da api", () => {
    const equipe = equipeDaApr([colega("ana"), colega("u-eu"), colega("bia")], eu);
    assert.deepEqual(equipe.map((c) => c.id), ["u-eu", "ana", "bia"]);
  });

  it("quem está ausente não entra na escolha", () => {
    const equipe = equipeDaApr([colega("ana", { ausencia: { motivo: "ferias" } }), colega("bia"), colega("u-eu")], eu);
    assert.deepEqual(equipe.map((c) => c.id), ["u-eu", "bia"]);
  });

  it("quem está logado sempre participa, mesmo que a lista não o traga", () => {
    const equipe = equipeDaApr([colega("ana")], eu);
    assert.deepEqual(equipe.map((c) => c.id), ["u-eu", "ana"]);
    assert.equal(equipe[0]!.assinatura_path, "sig-eu");
  });

  it("só leva o que a APR usa de cada pessoa", () => {
    const [primeiro] = equipeDaApr([colega("u-eu", { ausencia: null })], eu);
    assert.deepEqual(Object.keys(primeiro!).sort(), ["assinatura_path", "cargo", "id", "matricula", "nome", "perfil"]);
  });
});
