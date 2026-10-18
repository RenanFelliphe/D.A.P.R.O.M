import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { itemModeloApr, localInstalacao, modeloApr, os, tarefa } from "../src/db/schema";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";
import { ajudaDeExecucao } from "./ajuda-execucao";

describe("Perfil do técnico: histórico e execuções abertas", () => {
  let amb: Ambiente;
  let h: ReturnType<typeof ajudaDeExecucao>;
  let equipeId: string;
  let supervisor: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;
  let colega: UsuarioDeTeste;
  let modeloId: string;
  let respostas: { item_id: string; resposta: string }[];
  let localId: string;
  let contadorOs = 4100000;

  before(async () => {
    amb = await criarAmbiente({ comCarga: true });
    h = ajudaDeExecucao(amb);
    supervisor = await amb.criarUsuario({ perfil: "tecnico" });
    equipeId = (await amb.criarEquipe({ supervisorId: supervisor.id })).id;
    await amb.sql("update usuario set equipe_id = $1 where id = $2", [equipeId, supervisor.id]);
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    colega = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    const [m] = await amb.db.select().from(modeloApr).where(eq(modeloApr.codigo, "APR 01"));
    modeloId = m!.id;
    const itens = await amb.db.select().from(itemModeloApr).where(eq(itemModeloApr.modeloAprId, m!.id));
    respostas = itens.filter((i) => i.secao === "verificacao").map((i) => ({ item_id: i.id, resposta: i.respostaBloqueante === "sim" ? "nao" : "sim" }));
    [{ id: localId }] = (await amb.db.insert(localInstalacao).values({ codigo: "ERP SERRA/ESTACAO" }).returning({ id: localInstalacao.id })) as [{ id: string }];
  });
  after(() => amb.fechar());

  const agora = () => h.agora();
  const evento = (tipo: string, payload: object, osId: string) => h.evento(tipo, payload, osId);
  const enviar = (como: UsuarioDeTeste, ...eventos: unknown[]) => h.enviar(como, ...eventos);

  /** OS nova, APR aprovada (o técnico é o responsável e a colega é a outra participante), assinada pelos dois, e a execução iniciada; devolve os ids. */
  async function iniciarExecucao() {
    const [o] = await amb.db
      .insert(os)
      .values({ numeroOrdem: String(++contadorOs), tipo: "corretiva", titulo: "Troca de válvula", localInstalacaoId: localId, equipeId, dataInicioProg: "2026-10-11", origem: "sap" })
      .returning();
    const aprId = randomUUID();
    const participantes = [
      { usuario_id: tecnico.id, funcao: "responsavel" },
      { usuario_id: colega.id, funcao: "executor" },
    ];
    const r = await enviar(tecnico, evento("apr_concluida", { id: aprId, modelo_apr_id: modeloId, participantes, riscos: [], respostas, evidencias: [], observacao_geral: null, concluida_em: agora() }, o!.id));
    assert.equal(r.aprs[0].resultado, "aprovada");
    await h.assinarApr(aprId, o!.id, [tecnico, colega]);
    const execId = await h.iniciar(tecnico, o!.id, aprId);
    return { osId: o!.id, execId };
  }

  /** Os dois passos do encerramento pelo responsável (o clique em "Encerrar OS" e o preenchimento assinado): a OS fica `aguardando_supervisor`. */
  async function encerrar(execId: string, osId: string) {
    await h.encerrar(tecnico, osId, execId);
  }

  const statusDa = async (id: string) => (await amb.db.select({ s: os.status }).from(os).where(eq(os.id, id)))[0]!.s;

  it("execuções abertas: só as do próprio usuário, até a execução terminar (o clique em Encerrar OS já a fecha)", async () => {
    const { osId, execId } = await iniciarExecucao();
    const minhas = await amb.esperar(200, "GET", "/me/execucoes-abertas", { como: tecnico });
    assert.deepEqual(minhas.execucoes.map((e: any) => [e.id, e.os_id]), [[execId, osId]]);
    assert.ok(minhas.execucoes[0].numero_ordem);
    assert.deepEqual((await amb.esperar(200, "GET", "/me/execucoes-abertas", { como: colega })).execucoes, [], "a colega assinou a APR, mas não é quem executa");

    // O primeiro passo (o tempo para): a execução deixa de estar aberta, ainda que a OS siga em `encerrando` à espera do preenchimento.
    await h.clicarEncerrar(tecnico, osId, execId);
    assert.equal(await statusDa(osId), "encerrando");
    assert.deepEqual((await amb.esperar(200, "GET", "/me/execucoes-abertas", { como: tecnico })).execucoes, []);
    await h.assinarEncerramento(tecnico, osId, execId);
    assert.equal(await statusDa(osId), "aguardando_supervisor");
    assert.deepEqual((await amb.esperar(200, "GET", "/me/execucoes-abertas", { como: tecnico })).execucoes, []);
    await amb.esperar(401, "GET", "/me/execucoes-abertas");
  });

  it("histórico: encerradas dos últimos 60 dias, da mais recente à mais antiga, com tempo líquido e PDF", async () => {
    const a = await iniciarExecucao();
    const b = await iniciarExecucao();
    const velha = await iniciarExecucao();
    const aberta = await iniciarExecucao();
    // a: uma hora de execução com 30 min de pausa (ajustados no banco, para o relógio dos tokens não andar)
    const pausaId = randomUUID();
    await enviar(tecnico, evento("pausa_iniciada", { id: pausaId, execucao_id: a.execId, inicio: agora(), motivo: "almoco" }, a.osId));
    await enviar(tecnico, evento("pausa_encerrada", { pausa_id: pausaId, fim: agora() }, a.osId));
    await encerrar(a.execId, a.osId);
    const t0 = amb.relogio.agora.getTime();
    const iso = (min: number) => new Date(t0 + min * 60_000).toISOString();
    await amb.sql("update execucao set inicio = $2, fim = $3 where id = $1", [a.execId, iso(-60), iso(0)]);
    await amb.sql("update execucao_pausa set inicio = $2, fim = $3 where id = $1", [pausaId, iso(-45), iso(-15)]);
    await encerrar(b.execId, b.osId);
    await amb.sql("update execucao set inicio = $2, fim = $3 where id = $1", [b.execId, iso(-30), iso(1)]);
    await encerrar(velha.execId, velha.osId);
    await amb.sql("update execucao set inicio = $2, fim = $3 where id = $1", [velha.execId, new Date(t0 - 61 * 86_400_000 - 3_600_000).toISOString(), new Date(t0 - 61 * 86_400_000).toISOString()]);

    const { execucoes } = await amb.esperar(200, "GET", "/me/historico", { como: tecnico });
    const ids = execucoes.map((e: any) => e.id);
    assert.ok(ids.includes(a.execId) && ids.includes(b.execId), "as duas encerradas recentes aparecem");
    assert.ok(!ids.includes(velha.execId), "a de 61 dias fica de fora");
    assert.ok(!ids.includes(aberta.execId), "a em andamento fica de fora");
    assert.ok(ids.indexOf(b.execId) < ids.indexOf(a.execId), "mais recente primeiro");
    const linhaA = execucoes.find((e: any) => e.id === a.execId);
    assert.equal(linhaA.os_id, a.osId);
    assert.equal(linhaA.local_codigo, "ERP SERRA/ESTACAO");
    assert.equal(linhaA.titulo, "Troca de válvula");
    assert.equal(linhaA.pausa_min, 30);
    assert.equal(linhaA.tempo_liquido_min, 30);
    assert.equal(typeof linhaA.pdf_pronto, "boolean");
    assert.ok(linhaA.numero_ordem && linhaA.inicio && linhaA.fim);

    // O PDF só é pedido quando o supervisor assina por último: até lá nenhuma das duas tem tarefa de PDF.
    const tarefasDePdf = (osId: string) => amb.db.select().from(tarefa).where(and(eq(tarefa.tipo, "pdf_os"), eq(tarefa.referenciaId, osId)));
    assert.equal((await tarefasDePdf(a.osId)).length, 0);
    assert.equal(await statusDa(a.osId), "aguardando_supervisor");
    const assinada = await h.concluir(supervisor, a.osId);
    assert.equal(assinada.status, 200, JSON.stringify(assinada.corpo));
    assert.equal(await statusDa(a.osId), "encerrada");
    assert.equal((await tarefasDePdf(a.osId)).length, 1);
    assert.equal((await tarefasDePdf(b.osId)).length, 0);
  });

  it("histórico: cada técnico vê só as próprias execuções", async () => {
    const { execucoes } = await amb.esperar(200, "GET", "/me/historico", { como: colega });
    assert.deepEqual(execucoes, []);
    await amb.esperar(401, "GET", "/me/historico");
  });
});
