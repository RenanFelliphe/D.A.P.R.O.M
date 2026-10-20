import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ErroDeEvento, type RespostaEventos } from "@shared/api/eventos";
import { ErroDaApi, ErroDeRede } from "../src/api/erros";
import { lerTodasAsOs } from "../src/offline/copia";
import { criarEnvioComFila } from "../src/offline/envio";
import { arquivosPendentes, eventosPendentes, eventosRecusados, guardarArquivo, guardarEvento } from "../src/offline/fila";
import { criarSincronizador, PRAZO_DO_PENDENTE_MS, type Conexao, type Dependencias } from "../src/offline/sincronizar";
import type { ArquivoDaFila } from "../src/offline/tipos";
import { COLEGA, EU, novoBancoDeTeste, osDe, snapshotDe, uuidDe } from "./ajuda-offline";

const OS_A = uuidDe(1);
const OS_B = uuidDe(2);
const AGORA = new Date("2026-10-19T15:00:00.000Z");

const vazia = (): RespostaEventos => ({ confirmados: [], alertas: [], aprs: [], os: [], rejeitados: [], pendentes: [], pontos_ganhos: 0, ganhos: [] });

/** Uma `api` de mentira: confirma, recusa ou adia cada evento como o teste mandar, e anota o que recebeu. */
function servidorFalso() {
  const estado = {
    eventos: [] as string[],
    arquivos: [] as string[],
    recusar: new Map<string, { codigo: string; mensagem: string }>(),
    adiar: new Map<string, { codigo: string; mensagem: string }>(),
    erroDoEnvio: null as Error | null,
    /** Cai a conexão depois deste número de eventos confirmados. */
    caiDepoisDe: null as number | null,
    erroDoArquivo: new Map<string, Error>(),
    revogar: false,
    pulls: 0,
    /** O que o aparelho disse que ainda esperava na fila, por OS, em cada `POST /sync/pull`. */
    filas: [] as { os_id: string; quantos: number }[][],
    snapshot: snapshotDe([osDe(1), osDe(2)]),
    jaVistos: new Set<string>(),
  };
  return {
    estado,
    async enviarEvento(e: { id: string }) {
      if (estado.erroDoEnvio) throw estado.erroDoEnvio;
      if (estado.caiDepoisDe !== null && estado.eventos.length >= estado.caiDepoisDe) throw new ErroDeRede();
      const r = vazia();
      const recusa = estado.recusar.get(e.id);
      const espera = estado.adiar.get(e.id);
      if (recusa) r.rejeitados.push({ id: e.id, ...recusa });
      else if (espera) r.pendentes.push({ id: e.id, ...espera });
      else {
        r.confirmados.push(e.id);
        r.aprs.push({ id: "apr", resultado: "aprovada" });
        if (!estado.jaVistos.has(e.id)) estado.eventos.push(e.id);
        estado.jaVistos.add(e.id);
      }
      return { ...r, ...(estado.revogar ? { acesso_revogado: true } : {}) };
    },
    async subirArquivo(a: ArquivoDaFila) {
      const erro = estado.erroDoArquivo.get(a.id);
      if (erro) throw erro;
      estado.arquivos.push(a.id);
    },
    async baixarSnapshot(fila: { os_id: string; quantos: number }[] = []) {
      estado.pulls++;
      estado.filas.push(fila);
      return estado.snapshot;
    },
  };
}

async function montar(opcoes: { conexao?: Conexao; usuarioId?: string | null } = {}) {
  const banco = await novoBancoDeTeste();
  const servidor = servidorFalso();
  let conexao: Conexao = opcoes.conexao ?? "online";
  let relogio = AGORA;
  const mudancas = { vezes: 0, revogado: 0, apagados: [] as string[] };
  const dependencias: Dependencias = {
    banco,
    usuarioId: () => (opcoes.usuarioId === undefined ? EU : opcoes.usuarioId),
    enviarEvento: (e) => servidor.enviarEvento(e as { id: string }),
    subirArquivo: (a) => servidor.subirArquivo(a),
    baixarSnapshot: (fila) => servidor.baixarSnapshot(fila),
    apagarArquivoLocal: (uri) => void mudancas.apagados.push(uri),
    conexao: () => conexao,
    agora: () => relogio,
    aoMudar: () => void mudancas.vezes++,
    aoAcessoRevogado: () => void mudancas.revogado++,
  };
  const sincronizador = criarSincronizador(dependencias);
  const envio = criarEnvioComFila({
    banco,
    sincronizador,
    usuarioId: dependencias.usuarioId,
    conexao: dependencias.conexao,
    agora: dependencias.agora,
    subirAgora: async (_a, _t, id) => id,
    guardarCopiaDoArquivo: async (a) => ({ ...a, uri: `file:///fila/${a.nome}` }),
    apagarArquivoLocal: dependencias.apagarArquivoLocal,
    aoMudar: dependencias.aoMudar,
  });
  return { banco, servidor, sincronizador, envio, mudancas, ficarOffline: () => (conexao = "offline"), ficarOnline: () => (conexao = "online"), avancar: (ms: number) => (relogio = new Date(relogio.getTime() + ms)) };
}

const hora = (min: number) => new Date(AGORA.getTime() - 3_600_000 + min * 60_000).toISOString();
async function enfileirar(banco: Awaited<ReturnType<typeof novoBancoDeTeste>>, id: string, osId: string | null, min: number, tipo = "pausa_iniciada", usuarioId = EU) {
  await guardarEvento(banco, { id, usuarioId, tipo, osId, payload: { id }, ocorridoEm: hora(min), criadoEm: hora(min) });
}
const idsDaFila = async (banco: Awaited<ReturnType<typeof novoBancoDeTeste>>) => (await eventosPendentes(banco, EU)).map((e) => e.id);

describe("o sincronizador: a fila sobe em ordem e o que foi confirmado sai", () => {
  it("sobe os arquivos antes dos eventos, na ordem em que aconteceram, e limpa a fila e os arquivos locais", async () => {
    const { banco, servidor, sincronizador, mudancas } = await montar();
    await enfileirar(banco, "e2", OS_A, 20);
    await enfileirar(banco, "e1", OS_A, 10);
    await guardarArquivo(banco, { id: "f1", usuarioId: EU, tipo: "foto", uri: "file:///f1.jpg", nome: "f1.jpg", tipoMime: "image/jpeg", criadoEm: hora(5) });
    const r = await sincronizador.enviarFila();
    assert.deepEqual(servidor.estado.arquivos, ["f1"]);
    assert.deepEqual(servidor.estado.eventos, ["e1", "e2"]);
    assert.deepEqual([r.confirmados, r.recusados, r.restantes, r.semSinal, r.erro], [2, 0, 0, false, null]);
    assert.deepEqual(await idsDaFila(banco), []);
    assert.deepEqual(await arquivosPendentes(banco, EU), []);
    assert.deepEqual(mudancas.apagados, ["file:///f1.jpg"]);
  });

  it("reenviar o que já foi confirmado não tem efeito (a `api` é idempotente pelo id)", async () => {
    const { banco, servidor, sincronizador } = await montar();
    await enfileirar(banco, "e1", OS_A, 10);
    await sincronizador.enviarFila();
    await enfileirar(banco, "e1", OS_A, 10);
    const r = await sincronizador.enviarFila();
    assert.equal(r.confirmados, 1);
    assert.deepEqual(servidor.estado.eventos, ["e1"], "a `api` guardou uma vez só");
    assert.deepEqual(await idsDaFila(banco), []);
  });

  it("se a conexão cai no meio, só sai da fila o que foi confirmado; a próxima passada continua de onde parou", async () => {
    const { banco, servidor, sincronizador } = await montar();
    for (const [i, id] of ["e1", "e2", "e3", "e4"].entries()) await enfileirar(banco, id, OS_A, 10 + i);
    servidor.estado.caiDepoisDe = 2;
    const r = await sincronizador.enviarFila();
    assert.deepEqual([r.confirmados, r.restantes, r.semSinal], [2, 2, true]);
    assert.deepEqual(await idsDaFila(banco), ["e3", "e4"]);
    assert.equal((await eventosPendentes(banco, EU))[0]!.tentativas, 1);
    servidor.estado.caiDepoisDe = null;
    const depois = await sincronizador.enviarFila();
    assert.deepEqual(depois.restantes, 0);
    assert.deepEqual(servidor.estado.eventos, ["e1", "e2", "e3", "e4"]);
  });

  it("sem sinal não envia nada e diz isso; o mesmo vale para o servidor fora do ar (5xx)", async () => {
    const { banco, servidor, sincronizador, ficarOffline, ficarOnline } = await montar();
    await enfileirar(banco, "e1", OS_A, 10);
    ficarOffline();
    const sem = await sincronizador.enviarFila();
    assert.deepEqual([sem.semSinal, sem.restantes, sem.confirmados], [true, 1, 0]);
    assert.deepEqual(servidor.estado.eventos, []);
    ficarOnline();
    servidor.estado.erroDoEnvio = new ErroDaApi(503, "indisponivel", "Servidor fora do ar");
    const fora = await sincronizador.enviarFila();
    assert.deepEqual([fora.semSinal, fora.restantes], [true, 1]);
  });

  it("o evento que a `api` adia espera, e os seguintes da mesma OS esperam com ele; as outras OS seguem", async () => {
    const { banco, servidor, sincronizador } = await montar();
    await enfileirar(banco, "a1", OS_A, 10, "execucao_iniciada");
    await enfileirar(banco, "a2", OS_A, 11);
    await enfileirar(banco, "b1", OS_B, 12);
    servidor.estado.adiar.set("a1", { codigo: "apr_sem_assinaturas", mensagem: "Faltam as assinaturas da APR: Taís" });
    const r = await sincronizador.enviarFila();
    assert.deepEqual(servidor.estado.eventos, ["b1"], "a2 não foi tentado: depende de a1");
    assert.deepEqual(await idsDaFila(banco), ["a1", "a2"]);
    assert.equal(r.restantes, 2);
    assert.equal(r.porEvento.get("a1")?.situacao, "pendente");
    assert.equal(r.porEvento.get("a2")?.situacao, "na-fila");
    const [a1] = await eventosPendentes(banco, EU);
    assert.equal(a1!.ultimoErro, "Faltam as assinaturas da APR: Taís");
    // A assinatura do outro aparelho chegou: na passada seguinte tudo sobe, em ordem.
    servidor.estado.adiar.clear();
    await sincronizador.enviarFila();
    assert.deepEqual(servidor.estado.eventos, ["b1", "a1", "a2"]);
    assert.deepEqual(await idsDaFila(banco), []);
  });

  it("o evento recusado de vez sai da fila e fica guardado, com o motivo; os demais seguem", async () => {
    const { banco, servidor, sincronizador } = await montar();
    await enfileirar(banco, "e1", OS_A, 10);
    await enfileirar(banco, "e2", OS_A, 11);
    servidor.estado.recusar.set("e1", { codigo: "apr_invalida", mensagem: "Preencha a APR antes de iniciar" });
    const r = await sincronizador.enviarFila();
    assert.deepEqual([r.confirmados, r.recusados, r.restantes], [1, 1, 0]);
    assert.deepEqual(await idsDaFila(banco), []);
    const recusados = await eventosRecusados(banco, EU);
    assert.deepEqual(recusados.map((x) => [x.id, x.codigo, x.mensagem]), [["e1", "apr_invalida", "Preencha a APR antes de iniciar"]]);
  });

  it("o evento que espera mais de 7 dias vai para os recusados, para não travar a fila para sempre", async () => {
    const { banco, servidor, sincronizador, avancar } = await montar();
    await enfileirar(banco, "e1", OS_A, 10, "execucao_iniciada");
    await enfileirar(banco, "e2", OS_A, 11);
    servidor.estado.adiar.set("e1", { codigo: "apr_ausente", mensagem: "A APR ainda não foi recebida" });
    await sincronizador.enviarFila();
    assert.deepEqual(await idsDaFila(banco), ["e1", "e2"]);
    avancar(PRAZO_DO_PENDENTE_MS + 60_000);
    await sincronizador.enviarFila();
    assert.deepEqual(await idsDaFila(banco), []);
    assert.deepEqual((await eventosRecusados(banco, EU)).map((x) => x.codigo).sort(), ["esperou_demais"]);
    assert.deepEqual(servidor.estado.eventos, ["e2"], "o seguinte, livre da espera, subiu");
  });

  it("a sessão vencida ou a assinatura por cadastrar param a fila com a mensagem, sem perder nada", async () => {
    const { banco, servidor, sincronizador } = await montar();
    await enfileirar(banco, "e1", OS_A, 10);
    servidor.estado.erroDoEnvio = new ErroDaApi(403, "assinatura_pendente", "Cadastre a sua assinatura");
    const r = await sincronizador.enviarFila();
    assert.deepEqual([r.erro, r.semSinal, r.restantes], ["Cadastre a sua assinatura antes de continuar.", false, 1]);
    servidor.estado.erroDoEnvio = new ErroDaApi(401, "nao_autenticado", "x");
    assert.match((await sincronizador.enviarFila()).erro ?? "", /sessão terminou/i);
    assert.deepEqual(await idsDaFila(banco), ["e1"]);
  });

  it("o arquivo recusado de vez fica com o erro e a fila segue; o que cai no meio do envio de arquivos para tudo", async () => {
    const { banco, servidor, sincronizador } = await montar();
    await guardarArquivo(banco, { id: "f1", usuarioId: EU, tipo: "pdf", uri: "file:///f1.pdf", nome: "f1.pdf", tipoMime: "application/pdf", criadoEm: hora(1) });
    await guardarArquivo(banco, { id: "f2", usuarioId: EU, tipo: "foto", uri: "file:///f2.jpg", nome: "f2.jpg", tipoMime: "image/jpeg", criadoEm: hora(2) });
    await enfileirar(banco, "e1", OS_A, 10);
    servidor.estado.erroDoArquivo.set("f1", new ErroDaApi(413, "arquivo_grande", "O arquivo passa de 10 MB"));
    const r = await sincronizador.enviarFila();
    assert.deepEqual(servidor.estado.arquivos, ["f2"]);
    assert.deepEqual((await arquivosPendentes(banco, EU)).map((a) => [a.id, a.ultimoErro]), [["f1", "O arquivo passa de 10 MB"]]);
    assert.equal(r.confirmados, 1, "o evento subiu");

    servidor.estado.erroDoArquivo.set("f1", new ErroDeRede());
    await enfileirar(banco, "e2", OS_A, 20);
    const sem = await sincronizador.enviarFila();
    assert.deepEqual([sem.semSinal, sem.confirmados], [true, 0]);
    assert.deepEqual(await idsDaFila(banco), ["e2"], "sem o arquivo no ar, os eventos esperam");
  });

  it("avisa quando a `api` revoga o acesso (a pessoa foi desativada) ao receber a fila", async () => {
    const { banco, servidor, sincronizador, mudancas } = await montar();
    await enfileirar(banco, "e1", OS_A, 10);
    servidor.estado.revogar = true;
    await sincronizador.enviarFila();
    assert.equal(mudancas.revogado, 1);
  });

  it("a fila de uma pessoa não sobe com a sessão de outra", async () => {
    const { banco, servidor, sincronizador } = await montar();
    await enfileirar(banco, "dela", OS_A, 10, "pausa_iniciada", COLEGA);
    await enfileirar(banco, "meu", OS_A, 11);
    await sincronizador.enviarFila();
    assert.deepEqual(servidor.estado.eventos, ["meu"]);
    assert.equal((await eventosPendentes(banco, COLEGA)).length, 1);
  });
});

describe("o sincronizador: a cópia da equipe", () => {
  it("sincronizar sobe a fila e depois baixa a cópia; a OS com evento pendente não some dela", async () => {
    const { banco, servidor, sincronizador } = await montar();
    await sincronizador.sincronizar();
    assert.equal(servidor.estado.pulls, 1);
    assert.deepEqual((await lerTodasAsOs(banco)).map((o) => o.id).sort(), [OS_A, OS_B].sort());

    // O servidor tirou a OS A do snapshot, mas o aparelho tem um evento dela esperando (e o servidor o adia).
    servidor.estado.snapshot = snapshotDe([osDe(2)]);
    await enfileirar(banco, "a1", OS_A, 10, "execucao_iniciada");
    servidor.estado.adiar.set("a1", { codigo: "apr_ausente", mensagem: "A APR ainda não foi recebida" });
    const r = await sincronizador.sincronizar();
    assert.equal(r.copiaAtualizada, true);
    assert.deepEqual((await lerTodasAsOs(banco)).map((o) => o.id).sort(), [OS_A, OS_B].sort());

    // Confirmado o evento, a OS sai na cópia seguinte.
    servidor.estado.adiar.clear();
    await sincronizador.sincronizar();
    assert.deepEqual((await lerTodasAsOs(banco)).map((o) => o.id), [OS_B]);
  });

  it("ao baixar a cópia, diz à `api` quantos eventos ainda esperam na fila, por OS (a conferência da execução só anda com a fila vazia)", async () => {
    const { banco, servidor, sincronizador } = await montar();
    await sincronizador.sincronizar();
    assert.deepEqual(servidor.estado.filas.at(-1), [], "fila vazia");

    await enfileirar(banco, "a1", OS_A, 10, "pausa_iniciada");
    await enfileirar(banco, "a2", OS_A, 11, "pausa_encerrada");
    await enfileirar(banco, "b1", OS_B, 12, "pausa_iniciada");
    servidor.estado.adiar.set("a1", { codigo: "pausa_ausente", mensagem: "A pausa ainda não foi recebida" });
    servidor.estado.adiar.set("b1", { codigo: "execucao_ausente", mensagem: "A execução ainda não foi recebida" });
    await sincronizador.sincronizar();
    const dita = servidor.estado.filas.at(-1)!.sort((a, b) => a.os_id.localeCompare(b.os_id));
    assert.deepEqual(dita, [{ os_id: OS_A, quantos: 2 }, { os_id: OS_B, quantos: 1 }].sort((a, b) => a.os_id.localeCompare(b.os_id)), "o que a api adiou (e o que veio depois dele) continua na fila");
  });

  it("sem sinal não baixa a cópia, e a cópia antiga continua valendo", async () => {
    const { banco, servidor, sincronizador, ficarOffline } = await montar();
    await sincronizador.sincronizar();
    ficarOffline();
    const r = await sincronizador.sincronizar();
    assert.deepEqual([r.semSinal, r.copiaAtualizada, servidor.estado.pulls], [true, false, 1]);
    assert.equal((await lerTodasAsOs(banco)).length, 2);
  });

  it("não baixa a cópia se a fila parou porque o servidor não respondeu", async () => {
    const { servidor, sincronizador, banco } = await montar();
    await enfileirar(banco, "e1", OS_A, 10);
    servidor.estado.erroDoEnvio = new ErroDaApi(500, "erro", "Erro interno");
    const r = await sincronizador.sincronizar();
    assert.deepEqual([r.semSinal, r.copiaAtualizada, servidor.estado.pulls], [true, false, 0]);
  });

  it("chamadas ao mesmo tempo dividem uma sincronização só", async () => {
    const { servidor, sincronizador } = await montar();
    const [a, b, c] = await Promise.all([sincronizador.sincronizar(), sincronizador.sincronizar(), sincronizador.sincronizar()]);
    assert.equal(servidor.estado.pulls, 1);
    assert.ok(a === b || b === c || a.copiaAtualizada);
  });

  it("sem sessão, não há o que sincronizar", async () => {
    const { sincronizador } = await montar({ usuarioId: null });
    await assert.rejects(sincronizador.sincronizar(), /Sessão inválida/);
  });
});

describe("a escrita de campo com a fila", () => {
  it("com sinal, grava na fila, envia e devolve a resposta da `api`, sem deixar nada na fila", async () => {
    const { banco, servidor, envio } = await montar();
    const r = await envio.enviarEvento({ tipo: "pausa_iniciada", os_id: OS_A, payload: { id: "p1" } });
    assert.equal(r.naFila, false);
    assert.deepEqual(r.confirmados, [r.id]);
    assert.deepEqual(r.aprs, [{ id: "apr", resultado: "aprovada" }]);
    assert.deepEqual(servidor.estado.eventos, [r.id]);
    assert.deepEqual(await idsDaFila(banco), []);
  });

  it("sem sinal, guarda e diz que ficou na fila; nada vai para o servidor", async () => {
    const { banco, servidor, envio, ficarOffline } = await montar();
    ficarOffline();
    const r = await envio.enviarEvento({ tipo: "pausa_iniciada", os_id: OS_A, payload: { id: "p1" } });
    assert.equal(r.naFila, true);
    assert.deepEqual([r.confirmados, r.aprs, r.pontos_ganhos], [[], [], 0]);
    assert.deepEqual(await idsDaFila(banco), [r.id]);
    assert.deepEqual(servidor.estado.eventos, []);
  });

  it("o evento recusado ou adiado vira ErroDeEvento e não fica na fila nem entre os recusados (a pessoa está na tela e corrige)", async () => {
    const { banco, servidor, envio } = await montar();
    servidor.estado.recusar.set("00000000-0000-4000-8000-00000000f001", { codigo: "apr_sem_assinaturas", mensagem: "Faltam as assinaturas da APR: Taís" });
    await assert.rejects(
      envio.enviarEvento({ id: "00000000-0000-4000-8000-00000000f001", tipo: "execucao_iniciada", os_id: OS_A, payload: {} }),
      (e: unknown) => e instanceof ErroDeEvento && e.situacao === "rejeitado" && e.codigo === "apr_sem_assinaturas" && e.message === "Faltam as assinaturas da APR: Taís",
    );
    servidor.estado.adiar.set("00000000-0000-4000-8000-00000000f002", { codigo: "arquivo_ausente", mensagem: "O arquivo ainda não foi enviado" });
    await assert.rejects(
      envio.enviarEvento({ id: "00000000-0000-4000-8000-00000000f002", tipo: "apr_concluida", os_id: OS_A, payload: {} }),
      (e: unknown) => e instanceof ErroDeEvento && e.situacao === "pendente",
    );
    assert.deepEqual(await idsDaFila(banco), []);
    assert.deepEqual(await eventosRecusados(banco, EU), []);
  });

  it("ao voltar o sinal, o que ficou guardado sobe antes do novo evento (a ordem é a das ações)", async () => {
    const { banco, servidor, envio, ficarOffline, ficarOnline } = await montar();
    ficarOffline();
    const primeiro = await envio.enviarEvento({ tipo: "apr_concluida", os_id: OS_A, payload: {}, ocorrido_em: hora(10) });
    ficarOnline();
    const segundo = await envio.enviarEvento({ tipo: "execucao_iniciada", os_id: OS_A, payload: {}, ocorrido_em: hora(11) });
    assert.deepEqual(servidor.estado.eventos, [primeiro.id, segundo.id]);
    assert.equal(segundo.naFila, false);
    assert.deepEqual(await idsDaFila(banco), []);
  });

  it("se um registro anterior da mesma OS ainda espera, o novo fica guardado, sem erro", async () => {
    const { banco, servidor, envio } = await montar();
    await enfileirar(banco, "antigo", OS_A, 1, "execucao_iniciada");
    servidor.estado.adiar.set("antigo", { codigo: "apr_ausente", mensagem: "A APR ainda não foi recebida" });
    const r = await envio.enviarEvento({ tipo: "pausa_iniciada", os_id: OS_A, payload: {} });
    assert.equal(r.naFila, true);
    assert.deepEqual(await idsDaFila(banco), ["antigo", r.id]);
  });

  it("o mesmo evento enviado de novo (o rascunho da APR) não duplica na fila", async () => {
    const { banco, envio, ficarOffline } = await montar();
    ficarOffline();
    const id = "00000000-0000-4000-8000-00000000f003";
    await envio.enviarEvento({ id, tipo: "apr_concluida", os_id: OS_A, payload: { versao: 1 } });
    await envio.enviarEvento({ id, tipo: "apr_concluida", os_id: OS_A, payload: { versao: 2 } });
    const fila = await eventosPendentes(banco, EU);
    assert.deepEqual(fila.map((e) => [e.id, e.payload]), [[id, { versao: 2 }]]);
  });

  it("a foto sobe na hora com sinal e fica na fila, com cópia segura, sem sinal; a recusa de vez volta como erro", async () => {
    const { banco, servidor, envio, sincronizador, ficarOffline, ficarOnline } = await montar();
    const foto = { uri: "file:///cache/x.jpg", nome: "x.jpg", tipoMime: "image/jpeg" };
    assert.equal(await envio.enviarArquivo(foto, "foto", "f1"), "f1");
    assert.deepEqual(servidor.estado.arquivos, ["f1"]);
    assert.deepEqual(await arquivosPendentes(banco, EU), []);

    ficarOffline();
    assert.equal(await envio.enviarArquivo(foto, "foto", "f2"), "f2");
    assert.deepEqual((await arquivosPendentes(banco, EU)).map((a) => [a.id, a.uri]), [["f2", "file:///fila/x.jpg"]]);
    ficarOnline();

    servidor.estado.erroDoArquivo.set("f3", new ErroDaApi(422, "arquivo_invalido", "Arquivo inválido"));
    await assert.rejects(envio.enviarArquivo(foto, "foto", "f3"), /Arquivo inválido/);
    assert.deepEqual((await arquivosPendentes(banco, EU)).map((a) => a.id), ["f2"], "o recusado não fica na fila");

    // A que ficou sobe com a próxima sincronização.
    await sincronizador.sincronizar();
    assert.deepEqual(servidor.estado.arquivos, ["f1", "f2"]);
    assert.deepEqual(await arquivosPendentes(banco, EU), []);
  });

  it("a assinatura do perfil não passa pela fila", async () => {
    const { banco, envio } = await montar();
    assert.equal(await envio.enviarArquivo({ uri: "file:///a.png", nome: "a.png", tipoMime: "image/png" }, "assinatura", "s1"), "s1");
    assert.deepEqual(await arquivosPendentes(banco, EU), []);
  });
});
