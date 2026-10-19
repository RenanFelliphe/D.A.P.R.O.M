import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Usuario } from "@shared/api/tipos";
import { destinoDaConta } from "../src/sessao/destino";

function conta(parcial: Partial<Usuario>) {
  const usuario = { id: "u1", nome: "Maria", matricula: "1", cargo: null, registro_profissional: null, perfil: "tecnico", equipe_id: "e1", ativo: true, senha_provisoria: false, assinatura_path: "arq-1", assinatura_em: "2026-10-01T00:00:00Z", liberacao: "liberado", ...parcial } as Usuario;
  return { usuario };
}

describe("destino da conta depois do login", () => {
  it("técnico liberado, com assinatura: a lista de OS", () => {
    assert.equal(destinoDaConta(conta({})), "abas");
  });
  it("senha provisória vem antes de tudo, inclusive para quem aguarda a liberação e para o admin", () => {
    assert.equal(destinoDaConta(conta({ senha_provisoria: true })), "trocar-senha");
    assert.equal(destinoDaConta(conta({ senha_provisoria: true, liberacao: "pendente" })), "trocar-senha");
    assert.equal(destinoDaConta(conta({ senha_provisoria: true, perfil: "admin" })), "trocar-senha");
  });
  it("cadastro aguardando a liberação: a tela de espera (ainda sem cobrança de assinatura)", () => {
    assert.equal(destinoDaConta(conta({ liberacao: "pendente", assinatura_path: null })), "aguardando");
  });
  it("administrador: o aviso de que a gestão é na web", () => {
    assert.equal(destinoDaConta(conta({ perfil: "admin" })), "somente-web");
  });
  it("liberado e sem assinatura: o cadastro da assinatura", () => {
    assert.equal(destinoDaConta(conta({ assinatura_path: null, assinatura_em: null })), "assinatura");
  });
});
