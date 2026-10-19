import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { situacaoDaCopia, lerTodasAsOs, lerAprsDaOs, lerLocal, lerModelo, lerModelosPublicados, lerOs, substituirCopia, apagarCopia } from "../src/offline/copia";
import { MIGRACOES, migrar } from "../src/offline/esquema";
import { arquivosPendentes, contarPendentes, eventosPendentes, eventosRecusados, guardarArquivo, guardarEvento, recusarEvento, registrarTentativaDoEvento, removerEvento } from "../src/offline/fila";
import { COLEGA, EU, aprDe, modeloDeTeste, novoBancoDeTeste, osDe, snapshotDe } from "./ajuda-offline";

const evento = (id: string, extra: Partial<Parameters<typeof guardarEvento>[1]> = {}) => ({
  id,
  usuarioId: EU,
  tipo: "pausa_iniciada",
  osId: null,
  payload: { n: id },
  ocorridoEm: "2026-10-19T12:00:00.000Z",
  criadoEm: "2026-10-19T12:00:00.000Z",
  ...extra,
});

describe("o esquema do banco local", () => {
  it("cria as tabelas uma vez só e guarda a versão", async () => {
    const banco = await novoBancoDeTeste();
    assert.equal((await banco.um<{ user_version: number }>("PRAGMA user_version"))?.user_version, MIGRACOES.length);
    assert.equal(await migrar(banco), MIGRACOES.length);
    const tabelas = (await banco.todos<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")).map((t) => t.name);
    for (const t of ["os", "aprs", "execucoes", "locais", "atividades", "modelos_apr", "usuarios", "fila_eventos", "fila_arquivos", "eventos_recusados", "meta"]) assert.ok(tabelas.includes(t), t);
  });

  it("a transação desfaz tudo quando a tarefa falha, e as operações saem uma de cada vez", async () => {
    const banco = await novoBancoDeTeste();
    await assert.rejects(
      banco.transacao(async (tx) => {
        await tx.executar("INSERT INTO meta (chave, valor) VALUES ('a', '1')");
        throw new Error("falhou no meio");
      }),
      /falhou no meio/,
    );
    assert.equal(await banco.um("SELECT * FROM meta WHERE chave = 'a'"), null);
    await Promise.all([1, 2, 3, 4, 5].map((n) => banco.executar("INSERT INTO meta (chave, valor) VALUES (?, ?)", [`k${n}`, String(n)])));
    assert.equal((await banco.todos("SELECT * FROM meta")).length, 5);
  });
});

describe("a fila de eventos e de arquivos", () => {
  it("devolve os eventos na ordem em que aconteceram, não na ordem em que foram gravados", async () => {
    const banco = await novoBancoDeTeste();
    await guardarEvento(banco, evento("e3", { ocorridoEm: "2026-10-19T12:03:00.000Z" }));
    await guardarEvento(banco, evento("e1", { ocorridoEm: "2026-10-19T12:01:00.000Z" }));
    await guardarEvento(banco, evento("e2", { ocorridoEm: "2026-10-19T12:01:00.000Z" }));
    assert.deepEqual((await eventosPendentes(banco, EU)).map((e) => e.id), ["e1", "e2", "e3"]);
  });

  it("o mesmo id troca o conteúdo e mantém o lugar; a fila é de cada pessoa", async () => {
    const banco = await novoBancoDeTeste();
    await guardarEvento(banco, evento("e1"));
    await guardarEvento(banco, evento("e2"));
    await guardarEvento(banco, evento("e1", { payload: { novo: true }, ocorridoEm: "2030-01-01T00:00:00.000Z" }));
    const fila = await eventosPendentes(banco, EU);
    assert.deepEqual(fila.map((e) => e.id), ["e1", "e2"]);
    assert.deepEqual(fila[0]!.payload, { novo: true });
    assert.equal(fila[0]!.ocorridoEm, "2026-10-19T12:00:00.000Z", "o instante em que aconteceu não muda");
    assert.deepEqual(await eventosPendentes(banco, COLEGA), []);
  });

  it("recusar tira da fila e guarda o motivo; a tentativa fica registrada; contar soma eventos e arquivos", async () => {
    const banco = await novoBancoDeTeste();
    await guardarEvento(banco, evento("e1"));
    await guardarEvento(banco, evento("e2"));
    await guardarArquivo(banco, { id: "a1", usuarioId: EU, tipo: "foto", uri: "file:///a1.jpg", nome: "a1.jpg", tipoMime: "image/jpeg", criadoEm: "2026-10-19T12:00:00.000Z" });
    assert.deepEqual(await contarPendentes(banco, EU), { eventos: 2, arquivos: 1 });
    await registrarTentativaDoEvento(banco, "e1", "Sem sinal");
    const [primeiro] = await eventosPendentes(banco, EU);
    assert.equal(primeiro!.tentativas, 1);
    assert.equal(primeiro!.ultimoErro, "Sem sinal");
    await recusarEvento(banco, primeiro!, "apr_invalida", "Preencha a APR antes de iniciar", new Date("2026-10-19T13:00:00.000Z"));
    assert.deepEqual((await eventosPendentes(banco, EU)).map((e) => e.id), ["e2"]);
    const recusados = await eventosRecusados(banco, EU);
    assert.equal(recusados.length, 1);
    assert.equal(recusados[0]!.codigo, "apr_invalida");
    assert.deepEqual(recusados[0]!.payload, { n: "e1" });
    await removerEvento(banco, "e2");
    assert.equal((await arquivosPendentes(banco, EU)).length, 1);
  });
});

describe("a cópia local da equipe", () => {
  it("guarda o snapshot e o devolve como veio", async () => {
    const banco = await novoBancoDeTeste();
    const o = osDe(1);
    await substituirCopia(banco, EU, snapshotDe([o], { aprs: [aprDe(o.id, "apr-1")] }), new Set(), new Date("2026-10-19T12:05:00.000Z"));
    assert.deepEqual(await situacaoDaCopia(banco), { usuarioId: EU, baixadaEm: "2026-10-19T12:05:00.000Z" });
    assert.deepEqual(await lerOs(banco, o.id), o);
    assert.equal((await lerAprsDaOs(banco, o.id)).length, 1);
    assert.equal((await lerLocal(banco, o.local_instalacao_id))?.codigo, "VILA VELHA/REDE");
    assert.equal((await lerModelo(banco, modeloDeTeste.id))?.codigo, "APR 01");
  });

  it("o snapshot novo troca tudo: a OS que saiu some, a nova entra", async () => {
    const banco = await novoBancoDeTeste();
    const [a, b, c] = [osDe(1), osDe(2), osDe(3)];
    await substituirCopia(banco, EU, snapshotDe([a, b]), new Set(), new Date());
    await substituirCopia(banco, EU, snapshotDe([b, c]), new Set(), new Date());
    assert.deepEqual((await lerTodasAsOs(banco)).map((o) => o.id).sort(), [b.id, c.id].sort());
  });

  it("nunca apaga uma OS com evento pendente, nem as APRs e o local dela", async () => {
    const banco = await novoBancoDeTeste();
    const [a, b] = [osDe(1), osDe(2)];
    await substituirCopia(banco, EU, snapshotDe([a, b], { aprs: [aprDe(a.id, "apr-a")] }), new Set(), new Date());
    // O servidor mudou a OS A de equipe e ela saiu do snapshot, mas o aparelho tem uma pausa dela esperando.
    await substituirCopia(banco, EU, snapshotDe([b], { locais: [], modelos_apr: [] }), new Set([a.id]), new Date());
    assert.deepEqual((await lerTodasAsOs(banco)).map((o) => o.id).sort(), [a.id, b.id].sort());
    assert.equal((await lerAprsDaOs(banco, a.id)).length, 1);
    assert.equal((await lerLocal(banco, a.local_instalacao_id))?.codigo, "VILA VELHA/REDE");
    assert.equal((await lerModelo(banco, modeloDeTeste.id))?.codigo, "APR 01", "o modelo da APR preservada também fica");
    // Sem o evento pendente, na passada seguinte, ela sai de vez.
    await substituirCopia(banco, EU, snapshotDe([b]), new Set(), new Date());
    assert.deepEqual((await lerTodasAsOs(banco)).map((o) => o.id), [b.id]);
  });

  it("outra pessoa no aparelho recebe a cópia só dela; apagar a cópia não toca na fila", async () => {
    const banco = await novoBancoDeTeste();
    const a = osDe(1);
    await guardarEvento(banco, evento("e1", { osId: a.id }));
    await substituirCopia(banco, EU, snapshotDe([a]), new Set(), new Date());
    await substituirCopia(banco, COLEGA, snapshotDe([osDe(2)]), new Set([a.id]), new Date());
    assert.deepEqual((await lerTodasAsOs(banco)).map((o) => o.id), [osDe(2).id], "a OS da pessoa anterior não é preservada");
    assert.equal((await situacaoDaCopia(banco))?.usuarioId, COLEGA);
    await apagarCopia(banco);
    assert.equal(await situacaoDaCopia(banco), null);
    assert.equal((await eventosPendentes(banco, EU)).length, 1, "a fila da pessoa anterior continua");
  });

  it("os modelos publicados são a versão mais recente de cada código, sem os excluídos", async () => {
    const banco = await novoBancoDeTeste();
    const velho = { ...modeloDeTeste, id: "22222222-0000-4000-8000-000000000002", versao: 3 };
    const arquivado = { ...modeloDeTeste, id: "22222222-0000-4000-8000-000000000003", codigo: "APR 09", arquivado_em: "2026-10-02T00:00:00.000Z" };
    await substituirCopia(banco, EU, snapshotDe([osDe(1)], { modelos_apr: [modeloDeTeste, velho, arquivado] }), new Set(), new Date());
    const publicados = await lerModelosPublicados(banco);
    assert.deepEqual(publicados.map((m) => `${m.codigo} v${m.versao}`), ["APR 01 v4"]);
  });
});
