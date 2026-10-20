import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { diferencaDeListas, type ItemDaSugestao } from "@shared/api/sugestao-materiais";
import type { Alerta } from "@shared/api/alertas";
import { ErroDaApi, ErroDeRede } from "../src/api/erros";
import { destinoDoAvisoNoApp } from "../src/avisos/destino";
import { referenciaNoApp } from "../src/avisos/referencia";
import { mensagemDaSugestao } from "../src/materiais/erros";
import {
  corpoDoAceite,
  corpoDoEnvio,
  esquemaDaRecusa,
  esquemaDoEnvio,
  faltaNaLista,
  itemDigitado,
  itemDoCatalogo,
  itensSemResolucao,
  jaEstaNaLista,
  lerQuantidade,
  listaDoAjuste,
  MENSAGEM_SEM_MUDANCA,
  paraComparar,
  type ItemEditavel,
} from "../src/materiais/lista";
import { linhasDaMudanca, resumoDoTotal } from "../src/materiais/regras-da-diferenca";

const luva = itemDoCatalogo({ id: "m-luva", codigo: "100", descricao: "Luva", unidade: "par", categoria: "epi" });
const fita = itemDoCatalogo({ id: "m-fita", codigo: null, descricao: "Fita veda-rosca", unidade: "un", categoria: "material" });
const com = (i: ItemEditavel, parcial: Partial<ItemEditavel>): ItemEditavel => ({ ...i, ...parcial });

describe("quantidade digitada", () => {
  it("vírgula e ponto valem, vazio é 'conforme a necessidade'", () => {
    assert.deepEqual(lerQuantidade("2"), { ok: true, valor: 2 });
    assert.deepEqual(lerQuantidade(" 1,5 "), { ok: true, valor: 1.5 });
    assert.deepEqual(lerQuantidade("0.25"), { ok: true, valor: 0.25 });
    assert.deepEqual(lerQuantidade(""), { ok: true, valor: null });
  });
  it("zero, negativo e texto solto são recusados", () => {
    for (const t of ["0", "-1", "dois", "1,2,3", "1e3"]) assert.deepEqual(lerQuantidade(t), { ok: false }, t);
  });
});

describe("lista do editor", () => {
  it("lista vazia, quantidade inválida e item repetido têm mensagem", () => {
    assert.match(faltaNaLista([]) ?? "", /ao menos um item/);
    assert.match(faltaNaLista([com(luva, { quantidade: "abc" })]) ?? "", /Quantidade inválida em "Luva"/);
    assert.match(faltaNaLista([luva, com(luva, { chave: "outra" })]) ?? "", /mais de uma vez/);
    assert.equal(faltaNaLista([luva, fita]), null);
  });
  it("o item digitado se repete pela descrição e a unidade, sem diferenciar maiúsculas", () => {
    const a = itemDigitado({ descricao: "Chave  inglesa", unidade: "un", categoria: "ferramenta" });
    assert.equal(a.descricao, "Chave inglesa");
    assert.ok(jaEstaNaLista([a], itemDigitado({ descricao: "chave inglesa", unidade: "UN", categoria: "material" })));
    assert.ok(!jaEstaNaLista([a], luva));
  });
  it("compara como o cálculo da api: quantidade em número e observação vazia vira nula", () => {
    const mudancas = diferencaDeListas([{ material_id: "m-luva", descricao: "Luva", unidade: "par", quantidade: 1, observacao: null }], paraComparar([com(luva, { quantidade: "2", observacao: " " }), fita]));
    assert.deepEqual(mudancas.map((m) => m.tipo), ["alterado", "adicionado"]);
  });
});

describe("corpo do envio", () => {
  it("item do catálogo manda só o material; o digitado manda descrição, unidade e categoria", () => {
    const digitado = itemDigitado({ descricao: "Detector de gás", unidade: "un", categoria: "ferramenta" });
    const corpo = corpoDoEnvio({ atividade: "8.7.2/8.7.3", tipo: "sugestao", motivo: "  falta o detector ", lista: [com(luva, { quantidade: "2", observacao: "tam. M" }), digitado] });
    assert.deepEqual(corpo, {
      atividade: "8.7.2/8.7.3",
      tipo: "sugestao",
      motivo: "falta o detector",
      lista: [
        { material_id: "m-luva", quantidade: 2, observacao: "tam. M" },
        { descricao: "Detector de gás", unidade: "un", categoria: "ferramenta", quantidade: null, observacao: null },
      ],
    });
  });
  it("contestação sem lista e sem motivo vai sem as chaves", () => {
    assert.deepEqual(corpoDoEnvio({ atividade: "A1", tipo: "contestacao", motivo: "", lista: null }), { atividade: "A1", tipo: "contestacao" });
  });
});

describe("esquema do envio", () => {
  const base = paraComparar([luva]);
  const valores = (parcial: Partial<{ motivo: string; comLista: boolean; lista: ItemEditavel[] }>) => ({ motivo: "", comLista: true, lista: [luva, fita], ...parcial });
  const mensagens = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) => Object.fromEntries((r.error?.issues ?? []).map((i) => [String(i.path[0]), i.message]));

  it("a sugestão passa sem motivo, com a lista mudada", () => {
    assert.equal(esquemaDoEnvio("sugestao", base).safeParse(valores({})).success, true);
  });
  it("a lista igual à atual é recusada, com a mensagem na lista", () => {
    const r = esquemaDoEnvio("sugestao", base).safeParse(valores({ lista: [luva] }));
    assert.equal(mensagens(r).lista, MENSAGEM_SEM_MUDANCA);
  });
  it("a contestação exige o motivo (10 caracteres) e dispensa a lista quando a pessoa não quis sugerir", () => {
    const esquema = esquemaDoEnvio("contestacao", base);
    assert.match(mensagens(esquema.safeParse(valores({ comLista: false, lista: [], motivo: "curto" }))).motivo ?? "", /pelo menos 10/);
    assert.equal(esquema.safeParse(valores({ comLista: false, lista: [], motivo: "A lista não tem o detector" })).success, true);
  });
  it("a contestação com lista confere a lista", () => {
    const r = esquemaDoEnvio("contestacao", base).safeParse(valores({ motivo: "A lista não tem o detector", lista: [] }));
    assert.match(mensagens(r).lista ?? "", /ao menos um item/);
  });
  it("a recusa exige 10 caracteres", () => {
    assert.equal(esquemaDaRecusa.safeParse({ resposta: "não" }).success, false);
    assert.equal(esquemaDaRecusa.safeParse({ resposta: "A lista atual já está certa" }).success, true);
  });
});

describe("avaliação com itens digitados", () => {
  const itens: ItemDaSugestao[] = [
    { ordem: 1, material_id: "m-luva", codigo: "100", descricao: "Luva", unidade: "par", categoria: "epi", quantidade: 2, observacao: null },
    { ordem: 2, material_id: null, codigo: null, descricao: "Detector de gás", unidade: "un", categoria: "ferramenta", quantidade: 1, observacao: null },
    { ordem: 3, material_id: null, codigo: null, descricao: "Fita nova", unidade: "rolo", categoria: "material", quantidade: null, observacao: "20 m" },
  ];

  it("diz quais itens digitados ainda esperam a decisão", () => {
    assert.deepEqual(itensSemResolucao(itens, {}), [2, 3]);
    assert.deepEqual(itensSemResolucao(itens, { 2: { tipo: "criar" } }), [3]);
    assert.deepEqual(itensSemResolucao(itens, { 2: { tipo: "criar" }, 3: { tipo: "criar" } }), []);
  });

  it("aceitar a proposta manda só as resoluções (ligar ou cadastrar) e a resposta", () => {
    const ligado = { id: "m-det", codigo: "9", descricao: "Detector", unidade: "un", categoria: "ferramenta" as const };
    const corpo = corpoDoAceite({ itens, resolucoes: { 2: { tipo: "ligar", material: ligado }, 3: { tipo: "criar" } }, lista: null, resposta: " ok " });
    assert.deepEqual(corpo, { resolucoes: [{ ordem: 2, material_id: "m-det" }, { ordem: 3, criar_material: true }], resposta: "ok" });
  });

  it("aceitar sem itens digitados manda um corpo vazio", () => {
    assert.deepEqual(corpoDoAceite({ itens: itens.slice(0, 1), resolucoes: {}, lista: null, resposta: "" }), {});
  });

  it("o ajuste parte da proposta com as escolhas aplicadas e manda a lista ajustada", () => {
    const ligado = { id: "m-det", codigo: "9", descricao: "Detector", unidade: "un", categoria: "ferramenta" as const };
    const resolucoes = { 2: { tipo: "ligar" as const, material: ligado }, 3: { tipo: "criar" as const } };
    const lista = listaDoAjuste(itens, resolucoes);
    assert.deepEqual(lista.map((i) => [i.material_id, i.descricao, i.criar_material ?? false]), [
      ["m-luva", "Luva", false],
      ["m-det", "Detector", false],
      [null, "Fita nova", true],
    ]);
    const corpo = corpoDoAceite({ itens, resolucoes, lista: [com(lista[0]!, { quantidade: "3" }), ...lista.slice(1)], resposta: "" }) as { lista: unknown[] };
    assert.deepEqual(corpo.lista, [
      { material_id: "m-luva", quantidade: 3, observacao: null },
      { material_id: "m-det", quantidade: 1, observacao: null },
      { descricao: "Fita nova", unidade: "rolo", categoria: "material", quantidade: null, observacao: "20 m", criar_material: true },
    ]);
  });
});

describe("diferença na tela", () => {
  it("escreve o que mudou em cada item", () => {
    const [alterado, adicionado, removido] = diferencaDeListas(
      [
        { material_id: "a", descricao: "Luva", unidade: "par", quantidade: 1, observacao: null },
        { material_id: "c", descricao: "Fita", unidade: "un", quantidade: null, observacao: null },
      ],
      [
        { material_id: "a", descricao: "Luva", unidade: "par", quantidade: 2, observacao: "tam. M" },
        { material_id: "b", descricao: "Detector", unidade: "un", quantidade: 1, observacao: null },
      ],
    );
    assert.deepEqual(linhasDaMudanca(alterado!), ["Quantidade: 1 par → 2 par", "Observação: sem observação → “tam. M”"]);
    assert.deepEqual(linhasDaMudanca(adicionado!), ["Entra com 1 un"]);
    assert.deepEqual(linhasDaMudanca(removido!), ["Era conforme a necessidade"]);
  });
  it("conta as mudanças sem os itens iguais", () => {
    const igual = { material_id: "a", descricao: "Luva", unidade: "par", quantidade: 1, observacao: null };
    assert.equal(resumoDoTotal(diferencaDeListas([igual], [igual])), "Nenhuma mudança");
    assert.equal(resumoDoTotal(diferencaDeListas([igual], [{ ...igual, quantidade: 2 }])), "1 mudança");
  });
});

describe("mensagens de erro", () => {
  it("os códigos da api viram texto claro", () => {
    assert.match(mensagemDaSugestao(new ErroDaApi(422, "sem_mudanca", "x")), /igual à lista atual/);
    assert.match(mensagemDaSugestao(new ErroDaApi(409, "sugestao_pendente", "x")), /Retire-a/);
    assert.match(mensagemDaSugestao(new ErroDaApi(422, "motivo_obrigatorio", "x")), /pelo menos 10/);
    assert.match(mensagemDaSugestao(new ErroDaApi(422, "material_repetido", "x")), /mais de uma vez/);
    assert.match(mensagemDaSugestao(new ErroDaApi(409, "sugestao_ja_avaliada", "x")), /já foi avaliada ou retirada/);
  });
  it("os que a api escreve com o nome do item usam a mensagem dela, e o resto cai no tratamento geral", () => {
    assert.equal(mensagemDaSugestao(new ErroDaApi(422, "material_inativo", '"Luva" está desativado')), '"Luva" está desativado');
    assert.match(mensagemDaSugestao(new ErroDeRede()), /Sem conexão/);
    assert.equal(mensagemDaSugestao(new ErroDaApi(500, "erro_interno", "Falha no servidor")), "Falha no servidor");
  });
});

describe("avisos da sugestão de materiais no app", () => {
  const aviso = (tipo: Alerta["tipo"], extra: Partial<Alerta> = {}): Alerta =>
    ({ id: "a1", tipo, destinatario_id: "u1", os_id: null, usuario_alvo_id: null, sugestao_id: null, servico_codigo: null, numero_ordem: null, titulo: null, detalhe: "", ...extra }) as Alerta;

  it("os da sugestão levam à sugestão; sem o id, à lista", () => {
    assert.equal(destinoDoAvisoNoApp(aviso("sugestao_materiais_nova", { sugestao_id: "s1" })), "/materiais/s1");
    assert.equal(destinoDoAvisoNoApp(aviso("sugestao_materiais_recusada", { sugestao_id: "s2" })), "/materiais/s2");
    assert.equal(destinoDoAvisoNoApp(aviso("contestacao_materiais_nova")), "/materiais");
  });
  it("a lista que mudou não leva a lugar nenhum no app", () => {
    assert.equal(destinoDoAvisoNoApp(aviso("materiais_atualizados", { servico_codigo: "A1" })), null);
  });
  it("mostram o serviço, nunca 'OS de apoio'", () => {
    assert.deepEqual(referenciaNoApp(aviso("sugestao_materiais_aceita", { servico_codigo: "8.7.2" })), { codigo: "8.7.2", texto: "Lista de materiais" });
    assert.deepEqual(referenciaNoApp(aviso("materiais_atualizados", { servico_codigo: "8.7.2" })), { codigo: "8.7.2", texto: "Lista de materiais" });
  });
});
