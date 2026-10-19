import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adicionarFoto, novoRascunho, responder, type ModeloDoRascunho } from "@shared/api/apr";
import { analisarRascunho, chaveDoRascunho, criarArmazemDeRascunhos, type Disco } from "../src/apr/armazem";

const modelo: ModeloDoRascunho = {
  id: "m1",
  codigo: "APR-01",
  versao: 3,
  titulo: "Trabalho em altura",
  riscos: [],
  itens: [{ id: "i1", secao: "verificacao", risco_id: null, ordem: 1, texto: "O EPI está em boas condições?", permite_na: false }],
};

const rascunhoDe = (usuarioId: string, osId = "os-1") => novoRascunho({ osId, usuarioId, modelo, participantes: [{ usuarioId, funcao: "responsavel" }], riscos: [] });

/** Um disco em memória que guarda os textos como o arquivo faria e conta as gravações. */
function discoEmMemoria(inicial: Record<string, string> = {}) {
  const arquivos = new Map(Object.entries(inicial));
  const gravacoes: string[] = [];
  const disco: Disco = {
    async ler(chave) {
      return arquivos.get(chave) ?? null;
    },
    async gravar(chave, texto) {
      gravacoes.push(chave);
      arquivos.set(chave, texto);
    },
    async apagar(chave) {
      arquivos.delete(chave);
    },
  };
  return { disco, arquivos, gravacoes };
}

describe("rascunho da APR no aparelho", () => {
  it("lê o que está guardado do usuário certo e descarta texto estragado, de outra versão ou de outra pessoa", () => {
    const meu = rascunhoDe("u1");
    assert.deepEqual(analisarRascunho(JSON.stringify(meu), "u1"), meu);
    assert.equal(analisarRascunho(JSON.stringify(meu), "u2"), null, "o rascunho de quem usou o aparelho antes não é meu");
    assert.equal(analisarRascunho(JSON.stringify({ ...meu, versao: 2 }), "u1"), null);
    assert.equal(analisarRascunho("{não é json", "u1"), null);
    assert.equal(analisarRascunho(null, "u1"), null);
  });

  it("completa a validação ausente nos rascunhos gravados antes de existir", () => {
    const { avaliacao: _, ...semAvaliacao } = rascunhoDe("u1");
    assert.equal(analisarRascunho(JSON.stringify(semAvaliacao), "u1")?.avaliacao, null);
  });

  it("começa sem ter lido (undefined), lê do disco uma vez e avisa quem está olhando", async () => {
    const meu = rascunhoDe("u1");
    const { disco } = discoEmMemoria({ [chaveDoRascunho("u1", "os-1")]: JSON.stringify(meu) });
    const armazem = criarArmazemDeRascunhos(disco);
    let avisos = 0;
    armazem.assinar(() => avisos++);

    assert.equal(armazem.ler("os-1", "u1"), undefined);
    assert.deepEqual(await armazem.carregar("os-1", "u1"), meu);
    assert.deepEqual(armazem.ler("os-1", "u1"), meu);
    assert.equal(avisos, 1);
    await armazem.carregar("os-1", "u1");
    assert.equal(avisos, 1, "a segunda leitura vem da memória");
  });

  it("OS sem rascunho vira null depois de ler", async () => {
    const armazem = criarArmazemDeRascunhos(discoEmMemoria().disco);
    assert.equal(await armazem.carregar("os-9", "u1"), null);
    assert.equal(armazem.ler("os-9", "u1"), null);
  });

  it("grava na memória na hora e no disco em seguida; reabrir o app (outro armazém) lê o mesmo rascunho", async () => {
    const { disco, arquivos } = discoEmMemoria();
    const armazem = criarArmazemDeRascunhos(disco);
    const r = rascunhoDe("u1");
    armazem.gravar(r);
    assert.deepEqual(armazem.ler("os-1", "u1"), r);
    await armazem.esperarGravacoes();
    assert.ok(arquivos.has(chaveDoRascunho("u1", "os-1")));

    const reaberto = criarArmazemDeRascunhos(disco);
    assert.deepEqual(await reaberto.carregar("os-1", "u1"), r);
  });

  it("atualizar aplica uma função pura sobre o que está guardado e nada faz sem rascunho", async () => {
    const { disco } = discoEmMemoria();
    const armazem = criarArmazemDeRascunhos(disco);
    armazem.atualizar("os-1", "u1", (r) => ({ ...r, observacaoGeral: "ignorado" }));
    assert.equal(armazem.ler("os-1", "u1"), undefined);

    const r = rascunhoDe("u1");
    armazem.gravar(r);
    armazem.atualizar("os-1", "u1", (atual) => responder(atual, modelo.itens[0]!, "sim", new Date("2026-10-19T12:00:00Z")));
    assert.equal(armazem.ler("os-1", "u1")?.respostas["i1"]?.resposta, "sim");
    await armazem.esperarGravacoes();
    const gravado = analisarRascunho(JSON.stringify(armazem.ler("os-1", "u1")), "u1");
    assert.equal(gravado?.respostas["i1"]?.resposta, "sim");
  });

  it("as gravações de uma mesma OS saem em ordem: a última vence", async () => {
    const { disco, arquivos } = discoEmMemoria();
    const armazem = criarArmazemDeRascunhos(disco);
    const r = rascunhoDe("u1");
    for (const texto of ["um", "dois", "três"]) armazem.gravar({ ...r, observacaoGeral: texto });
    await armazem.esperarGravacoes();
    assert.equal(JSON.parse(arquivos.get(chaveDoRascunho("u1", "os-1"))!).observacaoGeral, "três");
  });

  it("apagar tira da memória e do disco; as fotos do rascunho continuam descritas até lá", async () => {
    const { disco, arquivos } = discoEmMemoria();
    const armazem = criarArmazemDeRascunhos(disco);
    const comFoto = adicionarFoto(rascunhoDe("u1"), "i1", { id: "f1", arquivoId: "a1", capturadaEm: "2026-10-19T12:00:00Z", miniatura: "file:///foto.jpg" });
    armazem.gravar(comFoto);
    await armazem.esperarGravacoes();
    armazem.apagar("os-1", "u1");
    assert.equal(armazem.ler("os-1", "u1"), null);
    await armazem.esperarGravacoes();
    assert.equal(arquivos.has(chaveDoRascunho("u1", "os-1")), false);
  });

  it("um erro do disco não derruba a tela: o rascunho segue na memória", async () => {
    const disco: Disco = {
      async ler() {
        throw new Error("sem permissão");
      },
      async gravar() {
        throw new Error("disco cheio");
      },
      async apagar() {
        throw new Error("sem permissão");
      },
    };
    const armazem = criarArmazemDeRascunhos(disco);
    assert.equal(await armazem.carregar("os-1", "u1"), null);
    const r = rascunhoDe("u1");
    armazem.gravar(r);
    await armazem.esperarGravacoes();
    assert.deepEqual(armazem.ler("os-1", "u1"), r);
  });

  it("dois usuários no mesmo aparelho têm rascunhos separados para a mesma OS", async () => {
    const { disco } = discoEmMemoria();
    const armazem = criarArmazemDeRascunhos(disco);
    armazem.gravar({ ...rascunhoDe("u1"), observacaoGeral: "do primeiro" });
    armazem.gravar({ ...rascunhoDe("u2"), observacaoGeral: "do segundo" });
    assert.equal(armazem.ler("os-1", "u1")?.observacaoGeral, "do primeiro");
    assert.equal(armazem.ler("os-1", "u2")?.observacaoGeral, "do segundo");
  });
});
