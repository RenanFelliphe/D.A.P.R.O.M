import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TIPOS_DE_VALIDACAO, type ItemDeValidacao, type TipoDeValidacao } from "@shared/api/validacoes";
import { destinoDaValidacao, itensDoFiltro, resumoDaFila, tiposDoFiltro } from "../src/validacoes/regras";

const item = (parcial: Partial<ItemDeValidacao>): ItemDeValidacao => ({
  chave: "os_ciencia:1",
  tipo: "os_ciencia",
  acao: "assinar",
  id: "1",
  os_id: null,
  atividade_codigo: null,
  equipe_id: null,
  equipe_nome: null,
  titulo: "t",
  detalhe: "d",
  desde: "2026-10-20T10:00:00Z",
  prazo_em: null,
  urgente: false,
  ...parcial,
});

const porTipo = (parcial: Partial<Record<TipoDeValidacao, number>>) => Object.fromEntries(TIPOS_DE_VALIDACAO.map((t) => [t, parcial[t] ?? 0])) as Record<TipoDeValidacao, number>;

describe("para onde cada item da fila leva", () => {
  it("a assinatura final da OS é na web, no detalhe dela", () => {
    assert.deepEqual(destinoDaValidacao(item({ id: "os-9" })), { onde: "web", caminho: "/app/os/os-9" });
  });
  it("a OS que espera a conferência abre no app, onde a conferência está", () => {
    assert.deepEqual(destinoDaValidacao(item({ id: "os-9", acao: "aguardar_conferencia" })), { onde: "app", rota: "/os/os-9" });
  });
  it("o treinamento é na web, na tela de validar o serviço (código codificado)", () => {
    assert.deepEqual(destinoDaValidacao(item({ tipo: "treinamento", acao: "decidir", id: "T", atividade_codigo: "MT 01/2" })), { onde: "web", caminho: "/app/catalogo/servicos/MT%2001%2F2/treinamento/validar" });
  });
  it("a sugestão de materiais abre no app", () => {
    assert.deepEqual(destinoDaValidacao(item({ tipo: "sugestao_material", acao: "decidir", id: "s-1", atividade_codigo: "X" })), { onde: "app", rota: "/materiais/s-1" });
  });
  it("a conferência abre no app, na conferência certa da OS", () => {
    assert.deepEqual(destinoDaValidacao(item({ tipo: "conferencia", acao: "ciencia", id: "c-3", os_id: "os-7" })), { onde: "app", rota: "/os/os-7/conferencia?c=c-3" });
  });
  it("a ausência da equipe é respondida na web, na equipe", () => {
    assert.deepEqual(destinoDaValidacao(item({ tipo: "ausencia", acao: "pedida", id: "a-1", equipe_id: "eq-2" })), { onde: "web", caminho: "/app/equipes/eq-2#ausencias" });
  });
});

describe("filtro da fila", () => {
  const itens = [item({ chave: "a" }), item({ chave: "b", tipo: "ausencia" }), item({ chave: "c", tipo: "ausencia" })];
  it("sem filtro mostra tudo; com filtro, só o tipo", () => {
    assert.equal(itensDoFiltro({ itens }, null).length, 3);
    assert.deepEqual(itensDoFiltro({ itens }, "ausencia").map((i) => i.chave), ["b", "c"]);
    assert.deepEqual(itensDoFiltro({ itens }, "treinamento"), []);
  });
  it("só os tipos com item ganham botão, mais o filtrado que esvaziou", () => {
    const fila = { por_tipo: porTipo({ os_ciencia: 1, ausencia: 2 }) };
    assert.deepEqual(tiposDoFiltro(fila, null), ["os_ciencia", "ausencia"]);
    assert.deepEqual(tiposDoFiltro(fila, "conferencia"), ["os_ciencia", "conferencia", "ausencia"]);
  });
  it("o resumo diz quantos esperam", () => {
    assert.equal(resumoDaFila(0), "Nada esperando");
    assert.equal(resumoDaFila(1), "1 esperando você");
    assert.equal(resumoDaFila(4), "4 esperando você");
  });
});
