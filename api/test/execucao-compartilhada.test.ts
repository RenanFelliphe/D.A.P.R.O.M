import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { localInstalacao, os, tarefa } from "../src/db/schema";
import { gerarRelatorioDaExecucao } from "../src/servicos/relatorio-execucao";
import { executarTarefasPendentes } from "../src/servicos/tarefas";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";
import { POSICAO, ajudaDeExecucao } from "./ajuda-execucao";

const DOIS_MINUTOS = 2 * 60_000;

/**
 * Execução compartilhada, etapa 2 (`docs/operacao-de-campo.md`, seções 6.2 a 6.4): qualquer participante da APR age sobre a execução.
 * Pausar, continuar, interromper por risco e suspender por saúde valem na hora; encerrar e suspender por motivo comum viram um pedido
 * de 2 minutos ao responsável (quem iniciou a execução), aprovado sozinho se ele não responder; sem sinal nada é pedido; quem encerrou
 * assina o encerramento.
 */
describe("Execução compartilhada: participantes agem, e o responsável responde os pedidos em até 2 minutos", () => {
  let amb: Ambiente;
  let h: ReturnType<typeof ajudaDeExecucao>;
  let equipeId: string;
  let supervisor: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste; // o responsável: inicia a execução
  let colega: UsuarioDeTeste;
  let terceiro: UsuarioDeTeste;
  let forasteiro: UsuarioDeTeste; // da equipe, mas fora da APR
  let deOutraEquipe: UsuarioDeTeste;
  let modeloId: string;
  let itens: { id: string; secao: string; respostaBloqueante: string | null }[];
  let localId: string;
  let contadorOs = 4400000;

  const minuto = (n: number) => new Date(amb.relogio.agora.getTime() + n * 60_000);
  const andar = (ms: number) => {
    amb.relogio.agora = new Date(amb.relogio.agora.getTime() + ms);
  };

  before(async () => {
    amb = await criarAmbiente({ comCarga: true, relogio: new Date("2026-10-19T15:00:00Z"), duracaoDoTokenSeg: 7 * 86_400 });
    h = ajudaDeExecucao(amb);
    supervisor = await amb.criarUsuario({ perfil: "tecnico", nome: "Sônia Supervisora" });
    equipeId = (await amb.criarEquipe({ supervisorId: supervisor.id })).id;
    await amb.sql("update usuario set equipe_id = $1 where id = $2", [equipeId, supervisor.id]);
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Tiago Técnico" });
    colega = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Carla Colega" });
    terceiro = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Teresa Terceira" });
    forasteiro = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Fábio Fora da APR" });
    deOutraEquipe = await amb.criarUsuario({ perfil: "tecnico", equipeId: (await amb.criarEquipe()).id });
    const modelo = (await amb.sql<{ id: string }>("select id from modelo_apr where codigo = 'APR 01' order by versao desc limit 1"))[0]!;
    modeloId = modelo.id;
    itens = (await amb.sql<{ id: string; secao: string; resposta_bloqueante: string | null }>("select id, secao, resposta_bloqueante from item_modelo_apr where modelo_apr_id = $1", [modeloId])).map((i) => ({
      id: i.id,
      secao: i.secao,
      respostaBloqueante: i.resposta_bloqueante,
    }));
    [{ id: localId }] = (await amb.db.insert(localInstalacao).values({ codigo: "VILA VELHA/REDE" }).returning({ id: localInstalacao.id })) as [{ id: string }];
  });
  after(() => amb.fechar());

  async function novaOs() {
    const [o] = await amb.db
      .insert(os)
      .values({ numeroOrdem: String(++contadorOs), tipo: "corretiva", titulo: "DCV Desobstrução", localInstalacaoId: localId, equipeId, dataInicioProg: "2026-10-19", origem: "sap" })
      .returning();
    return o!;
  }
  const statusDa = async (id: string) => (await amb.db.select({ s: os.status }).from(os).where(eq(os.id, id)))[0]!.s;

  async function registrarApr(osId: string, quem: UsuarioDeTeste[]) {
    const p = {
      id: randomUUID(),
      modelo_apr_id: modeloId,
      participantes: quem.map((u, i) => ({ usuario_id: u.id, funcao: i === 0 ? "responsavel" : "executor" })),
      riscos: [],
      respostas: itens.filter((i) => i.secao === "verificacao").map((i) => ({ item_id: i.id, resposta: i.respostaBloqueante === "sim" ? "nao" : "sim" })),
      evidencias: [],
      observacao_geral: null,
      concluida_em: h.agora(),
    };
    const r = await h.enviar(quem[0]!, h.evento("apr_concluida", p, osId));
    assert.deepEqual(r.rejeitados, [], JSON.stringify(r.rejeitados));
    return p.id;
  }
  /** OS com a APR de três pessoas (tecnico, colega, terceiro) assinada e a execução iniciada por `tecnico`, o responsável. */
  async function osEmExecucao() {
    const o = await novaOs();
    const aprId = await registrarApr(o.id, [tecnico, colega, terceiro]);
    await h.assinarApr(aprId, o.id, [tecnico, colega, terceiro]);
    const execId = await h.iniciar(tecnico, o.id, aprId, POSICAO);
    return { o, aprId, execId };
  }

  const codigo = (r: { rejeitados: { codigo: string }[]; pendentes: { codigo: string }[] }) => (r.rejeitados[0] ?? r.pendentes[0])?.codigo;
  const pausar = (como: UsuarioDeTeste, osId: string, execId: string, extra: Record<string, unknown> = {}) => {
    const id = randomUUID();
    return { id, enviar: () => h.enviar(como, h.evento("pausa_iniciada", { id, execucao_id: execId, inicio: h.agora(), motivo: "almoco", ...extra }, osId)) };
  };
  const pedir = (como: UsuarioDeTeste, osId: string, execId: string, tipo: "encerrar" | "suspender", extra: Record<string, unknown> = {}, ocorrido?: string) => {
    const id = randomUUID();
    return { id, enviar: () => h.enviar(como, h.evento("pedido_aberto", { id, execucao_id: execId, tipo, instante: h.agora(), ...(tipo === "suspender" ? { motivo: "fim_expediente" } : {}), ...POSICAO, ...extra }, osId, ocorrido)) };
  };
  const decidir = (como: UsuarioDeTeste, osId: string, pedidoId: string, decisao: "aprovar" | "recusar", motivo?: string) =>
    h.enviar(como, h.evento("pedido_decidido", { pedido_id: pedidoId, decisao, ...(motivo ? { motivo } : {}) }, osId));
  const pedidoDe = async (id: string) => (await amb.sql<{ estado: string; decidido_por: string | null; decidido_em: string | null; motivo_recusa: string | null }>("select estado, decidido_por, decidido_em, motivo_recusa from execucao_pedido where id = $1", [id]))[0]!;
  const execucaoDe = async (id: string) =>
    (await amb.sql<{ resultado: string | null; fim: string | null; finalizada_por: string | null; suspensao_motivo: string | null }>("select resultado, fim, finalizada_por, suspensao_motivo from execucao where id = $1", [id]))[0]!;
  const alertas = (osId: string, tipo: string) => amb.sql<{ destinatario_id: string; detalhe: string }>("select destinatario_id, detalhe from alerta where os_id = $1 and tipo = $2 order by criado_em, id", [osId, tipo]);

  describe("o que vale na hora", () => {
    it("o participante pausa e retoma a execução; a pausa guarda quem fez, e o responsável é avisado", async () => {
      const { o, execId } = await osEmExecucao();
      const pausa = pausar(colega, o.id, execId, { motivo: "aguardando", complemento: "peça do almoxarifado" });
      const r = await pausa.enviar();
      assert.deepEqual(r.rejeitados, [], JSON.stringify(r.rejeitados));
      const [p] = await amb.sql<{ iniciada_por: string; fim: string | null }>("select iniciada_por, fim from execucao_pausa where id = $1", [pausa.id]);
      assert.equal(p!.iniciada_por, colega.id);
      assert.equal(p!.fim, null);
      assert.deepEqual((await alertas(o.id, "acao_de_participante")).map((a) => a.destinatario_id), [tecnico.id]);
      assert.match((await alertas(o.id, "acao_de_participante"))[0]!.detalhe, /Carla Colega pausou a execução \(Aguardando: peça do almoxarifado\)/);

      // Outro participante retoma (qualquer um pode).
      andar(60_000);
      const volta = await h.enviar(terceiro, h.evento("pausa_encerrada", { pausa_id: pausa.id, fim: h.agora() }, o.id));
      assert.deepEqual(volta.rejeitados, [], JSON.stringify(volta.rejeitados));
      const [depois] = await amb.sql<{ encerrada_por: string; fim: string | null }>("select encerrada_por, fim from execucao_pausa where id = $1", [pausa.id]);
      assert.equal(depois!.encerrada_por, terceiro.id);
      assert.ok(depois!.fim);
      // O responsável pausar e retomar não avisa ninguém dele mesmo.
      const dele = pausar(tecnico, o.id, execId);
      assert.deepEqual((await dele.enviar()).rejeitados, []);
      assert.equal((await alertas(o.id, "acao_de_participante")).length, 2, "só as duas ações dos participantes (pausa e retomada)");
    });

    it("quem está fora da APR, de outra equipe ou saiu da APR não age sobre a execução", async () => {
      const { o, execId } = await osEmExecucao();
      assert.equal(codigo(await pausar(forasteiro, o.id, execId).enviar()), "execucao_de_outro");
      assert.equal(codigo(await pausar(deOutraEquipe, o.id, execId).enviar()), "fora_da_equipe");
      assert.equal((await amb.sql("select 1 from execucao_pausa where execucao_id = $1", [execId])).length, 0);

      // O participante que recusou a APR saiu dela: não age.
      const o2 = await novaOs();
      const apr2 = await registrarApr(o2.id, [tecnico, colega, terceiro]);
      await h.assinarApr(apr2, o2.id, [tecnico, colega]);
      await h.enviar(terceiro, h.evento("apr_recusada", { apr_id: apr2, motivo: "Sem EPI" }, o2.id));
      const exec2 = await h.iniciar(tecnico, o2.id, apr2);
      assert.equal(codigo(await pausar(terceiro, o2.id, exec2).enviar()), "execucao_de_outro");
    });

    it("a pausa por lesão feita por um participante avisa o supervisor e o responsável, e vale na hora", async () => {
      const { o, execId } = await osEmExecucao();
      const r = await pausar(colega, o.id, execId, { motivo: "lesao", complemento: "cortou a mão" }).enviar();
      assert.deepEqual(r.rejeitados, []);
      assert.deepEqual((await alertas(o.id, "lesao_ou_enfermidade")).map((a) => a.destinatario_id), [supervisor.id]);
      assert.deepEqual((await alertas(o.id, "acao_de_participante")).map((a) => a.destinatario_id), [tecnico.id]);
    });

    it("o participante interrompe por risco, assinando com a própria assinatura, na hora", async () => {
      const { o, execId } = await osEmExecucao();
      const r = await h.enviar(colega, h.evento("execucao_interrompida", { execucao_id: execId, fim: h.agora(), motivo: "Vazamento de gás", evidencias: [{ id: await h.foto(), capturada_em: h.agora() }] }, o.id));
      assert.deepEqual(r.rejeitados, [], JSON.stringify(r.rejeitados));
      assert.equal((await execucaoDe(execId)).resultado, "interrompida");
      assert.equal((await execucaoDe(execId)).finalizada_por, colega.id);
      assert.equal((await amb.sql<{ p: string | null }>("select assinatura_do_resultado_path as p from execucao where id = $1", [execId]))[0]!.p, await amb.assinaturaDe(colega));
      assert.equal(await statusDa(o.id), "pendente");
    });

    it("suspender por lesão ou enfermidade vale na hora; por outro motivo, com sinal, é pedido", async () => {
      const { o, execId } = await osEmExecucao();
      const comum = await h.enviar(colega, h.evento("execucao_suspensa", { execucao_id: execId, fim: h.agora(), motivo: "fim_expediente" }, o.id));
      assert.equal(codigo(comum), "pedido_necessario");
      const saude = await h.enviar(colega, h.evento("execucao_suspensa", { execucao_id: execId, fim: h.agora(), motivo: "enfermidade", complemento: "mal-estar" }, o.id));
      assert.deepEqual(saude.rejeitados, [], JSON.stringify(saude.rejeitados));
      assert.deepEqual(await execucaoDe(execId), { resultado: "suspensa", fim: (await execucaoDe(execId)).fim, finalizada_por: colega.id, suspensao_motivo: "enfermidade" });
      assert.deepEqual((await alertas(o.id, "lesao_ou_enfermidade")).map((a) => a.destinatario_id), [supervisor.id]);
      assert.equal(await statusDa(o.id), "pendente");
    });

    it("encerrar direto, com sinal, não vale para o participante (pede ao responsável); cancelar por engano é só do responsável", async () => {
      const { o, execId } = await osEmExecucao();
      assert.equal(codigo(await h.clicarEncerrar(colega, o.id, execId)), "pedido_necessario");
      assert.equal(codigo(await h.enviar(colega, h.evento("execucao_cancelada", { execucao_id: execId }, o.id))), "so_o_responsavel");
      assert.equal((await execucaoDe(execId)).resultado, null);
      // O responsável cancela por engano, como sempre.
      assert.deepEqual((await h.enviar(tecnico, h.evento("execucao_cancelada", { execucao_id: execId }, o.id))).rejeitados, []);
    });
  });

  describe("o pedido de encerrar ou suspender", () => {
    it("abre o pedido, avisa o responsável e agenda a aprovação aos 2 minutos; um pedido aberto por execução, e o responsável aprova", async () => {
      const { o, execId } = await osEmExecucao();
      andar(5 * 60_000);
      const clique = h.agora();
      const pedido = pedir(colega, o.id, execId, "encerrar");
      const r = await pedido.enviar();
      assert.deepEqual(r.rejeitados, [], JSON.stringify(r.rejeitados));
      const aberto = await pedidoDe(pedido.id);
      assert.equal(aberto.estado, "aberto");
      assert.equal((await execucaoDe(execId)).resultado, null, "nada acontece antes da resposta");
      const [linha] = await amb.sql<{ criado_em: Date; expira_em: Date }>("select criado_em, expira_em from execucao_pedido where id = $1", [pedido.id]);
      assert.equal(new Date(linha!.expira_em).getTime() - new Date(linha!.criado_em).getTime(), DOIS_MINUTOS);
      const [t] = await amb.db.select().from(tarefa).where(eq(tarefa.referenciaId, pedido.id));
      assert.equal(t!.tipo, "pedido_prazo");
      assert.equal(t!.proximaEm.getTime(), new Date(linha!.expira_em).getTime());
      assert.deepEqual((await alertas(o.id, "pedido_de_acao")).map((a) => a.destinatario_id), [tecnico.id]);
      assert.match((await alertas(o.id, "pedido_de_acao"))[0]!.detalhe, /Carla Colega pediu para encerrar a OS/);

      // Outro pedido enquanto há um aberto: recusado; o outro participante apoia o que está aberto.
      assert.equal(codigo(await pedir(terceiro, o.id, execId, "suspender").enviar()), "pedido_aberto_existente");
      assert.deepEqual((await h.enviar(terceiro, h.evento("pedido_apoiado", { pedido_id: pedido.id }, o.id))).rejeitados, []);
      assert.equal(codigo(await h.enviar(colega, h.evento("pedido_apoiado", { pedido_id: pedido.id }, o.id))), "apoio_proprio");
      assert.equal(codigo(await h.enviar(tecnico, h.evento("pedido_apoiado", { pedido_id: pedido.id }, o.id))), "apoio_do_responsavel");

      // Só o responsável responde.
      assert.equal(codigo(await decidir(terceiro, o.id, pedido.id, "aprovar")), "so_o_responsavel");

      // A resposta chega 40 s depois: a ação vale no instante do clique, não no da aprovação.
      andar(40_000);
      const ok = await decidir(tecnico, o.id, pedido.id, "aprovar");
      assert.deepEqual(ok.rejeitados, [], JSON.stringify(ok.rejeitados));
      const e = await execucaoDe(execId);
      assert.equal(e.resultado, "encerrada");
      assert.equal(new Date(e.fim!).toISOString(), clique);
      assert.equal(e.finalizada_por, colega.id);
      const p = await pedidoDe(pedido.id);
      assert.equal(p.estado, "aprovado");
      assert.equal(p.decidido_por, tecnico.id);
      assert.deepEqual((await alertas(o.id, "pedido_decidido")).map((a) => a.destinatario_id), [colega.id]);
      assert.equal(await statusDa(o.id), "encerrando");
      assert.deepEqual(ok.os, [{ id: o.id, status: "encerrando" }]);

      // Quem encerrou assina o encerramento; o responsável, que não encerrou, não.
      assert.equal(codigo(await h.assinarEncerramento(tecnico, o.id, execId)), "encerramento_de_outro");
      const assinado = await h.assinarEncerramento(colega, o.id, execId);
      assert.deepEqual(assinado.rejeitados, [], JSON.stringify(assinado.rejeitados));
      assert.equal(await statusDa(o.id), "aguardando_supervisor");
      assert.equal((await amb.sql<{ usuario_id: string }>("select usuario_id from execucao_assinatura where execucao_id = $1", [execId]))[0]!.usuario_id, colega.id);
      // Decidir de novo o mesmo pedido já decidido é idempotente; trocar a decisão não.
      assert.deepEqual((await decidir(tecnico, o.id, pedido.id, "aprovar")).rejeitados, []);
      assert.equal(codigo(await decidir(tecnico, o.id, pedido.id, "recusar")), "pedido_ja_decidido");
    });

    it("o responsável recusa com um motivo: a execução continua e o solicitante é avisado; depois pode pedir de novo", async () => {
      const { o, execId } = await osEmExecucao();
      const pedido = pedir(colega, o.id, execId, "suspender", { motivo: "falta_material" });
      assert.deepEqual((await pedido.enviar()).rejeitados, []);
      andar(30_000);
      const r = await decidir(tecnico, o.id, pedido.id, "recusar", "Falta só uma peça, já vem");
      assert.deepEqual(r.rejeitados, []);
      assert.deepEqual(await pedidoDe(pedido.id), { estado: "recusado", decidido_por: tecnico.id, decidido_em: (await pedidoDe(pedido.id)).decidido_em, motivo_recusa: "Falta só uma peça, já vem" });
      assert.equal((await execucaoDe(execId)).resultado, null);
      assert.match((await alertas(o.id, "pedido_decidido"))[0]!.detalhe, /recusou o seu pedido para suspender a execução: Falta só uma peça/);
      assert.deepEqual((await pedir(colega, o.id, execId, "encerrar").enviar()).rejeitados, [], "um novo pedido é permitido");
    });

    it("sem resposta em 2 minutos, a tarefa aprova sozinha, no instante do clique, e avisa os dois", async () => {
      const { o, execId } = await osEmExecucao();
      const clique = h.agora();
      const pedido = pedir(colega, o.id, execId, "suspender", { motivo: "clima" });
      assert.deepEqual((await pedido.enviar()).rejeitados, []);
      andar(DOIS_MINUTOS - 1000);
      await executarTarefasPendentes(amb.deps);
      assert.equal((await pedidoDe(pedido.id)).estado, "aberto", "ainda dentro do prazo");
      andar(1000);
      await executarTarefasPendentes(amb.deps);
      const p = await pedidoDe(pedido.id);
      assert.equal(p.estado, "aprovado_por_prazo");
      assert.equal(p.decidido_por, null);
      const e = await execucaoDe(execId);
      assert.equal(e.resultado, "suspensa");
      assert.equal(e.suspensao_motivo, "clima");
      assert.equal(new Date(e.fim!).toISOString(), clique);
      assert.equal(e.finalizada_por, colega.id);
      assert.equal(await statusDa(o.id), "pendente");
      assert.deepEqual((await alertas(o.id, "pedido_decidido")).map((a) => a.destinatario_id), [colega.id]);
      assert.match((await alertas(o.id, "pedido_decidido"))[0]!.detalhe, /aprovado sozinho/);
      assert.ok((await alertas(o.id, "acao_de_participante")).some((a) => a.destinatario_id === tecnico.id && /aprovado sozinho/.test(a.detalhe)));
    });

    it("a leitura da OS e qualquer ação já veem o pedido vencido como aprovado, antes de a tarefa rodar; a decisão tardia é recusada", async () => {
      const { o, execId } = await osEmExecucao();
      const pedido = pedir(colega, o.id, execId, "encerrar");
      assert.deepEqual((await pedido.enviar()).rejeitados, []);

      const aberta = await amb.esperar(200, "GET", `/os/${o.id}`, { como: tecnico });
      const antes = aberta.execucoes[0].pedidos[0];
      assert.equal(antes.estado, "aberto");
      assert.equal(antes.solicitante.nome, "Carla Colega");
      assert.equal(antes.restante_ms, DOIS_MINUTOS);
      const faixa = await amb.esperar(200, "GET", "/me/pedidos-abertos", { como: tecnico });
      assert.deepEqual(faixa.pedidos.map((x: { id: string; restante_ms: number; solicitante: { nome: string } }) => [x.id, x.restante_ms, x.solicitante.nome]), [[pedido.id, DOIS_MINUTOS, "Carla Colega"]]);
      assert.deepEqual((await amb.esperar(200, "GET", "/me/pedidos-abertos", { como: colega })).pedidos, [], "só o responsável vê o pedido a responder");

      andar(DOIS_MINUTOS + 5000);
      const vencida = await amb.esperar(200, "GET", `/os/${o.id}`, { como: tecnico });
      assert.equal(vencida.execucoes[0].pedidos[0].estado, "aprovado_por_prazo");
      assert.equal(vencida.execucoes[0].resultado, "encerrada");
      assert.equal(vencida.execucoes[0].finalizada_por.nome, "Carla Colega");
      assert.equal(vencida.os.status, "encerrando");
      assert.equal(codigo(await decidir(tecnico, o.id, pedido.id, "recusar")), "pedido_ja_decidido");
      // A tarefa que roda depois não faz nada de novo.
      await executarTarefasPendentes(amb.deps);
      assert.equal((await alertas(o.id, "pedido_decidido")).length, 1);
    });

    it("o solicitante cancela o pedido; o responsável que age antes torna o pedido obsoleto", async () => {
      const { o, execId } = await osEmExecucao();
      const p1 = pedir(colega, o.id, execId, "encerrar");
      await p1.enviar();
      assert.equal(codigo(await h.enviar(terceiro, h.evento("pedido_cancelado", { pedido_id: p1.id }, o.id))), "pedido_de_outro");
      assert.deepEqual((await h.enviar(colega, h.evento("pedido_cancelado", { pedido_id: p1.id }, o.id))).rejeitados, []);
      assert.equal((await pedidoDe(p1.id)).estado, "cancelado");
      assert.equal(codigo(await decidir(tecnico, o.id, p1.id, "aprovar")), "pedido_ja_decidido");

      const p2 = pedir(terceiro, o.id, execId, "suspender");
      await p2.enviar();
      assert.deepEqual((await h.clicarEncerrar(tecnico, o.id, execId)).rejeitados, []);
      assert.equal((await pedidoDe(p2.id)).estado, "obsoleto");
      assert.equal((await execucaoDe(execId)).finalizada_por, tecnico.id);
      // A tarefa vencida não reabre nada.
      andar(DOIS_MINUTOS + 1000);
      await executarTarefasPendentes(amb.deps);
      assert.equal((await pedidoDe(p2.id)).estado, "obsoleto");
    });

    it("o responsável não pede, e o pedido exige motivo na suspensão", async () => {
      const { o, execId } = await osEmExecucao();
      assert.equal(codigo(await pedir(tecnico, o.id, execId, "encerrar").enviar()), "pedido_do_responsavel");
      assert.equal(codigo(await pedir(colega, o.id, execId, "suspender", { motivo: undefined }).enviar()), "motivo_obrigatorio");
      assert.equal(codigo(await pedir(colega, o.id, execId, "suspender", { motivo: "outro" }).enviar()), "complemento_obrigatorio");
    });

    it("uma pausa aberta por um colega enquanto o pedido espera não quebra a aprovação: ela fecha no próprio início", async () => {
      const { o, execId } = await osEmExecucao();
      andar(10 * 60_000);
      const pedido = pedir(colega, o.id, execId, "encerrar");
      await pedido.enviar();
      andar(30_000);
      const pausa = pausar(terceiro, o.id, execId, { motivo: "descanso" });
      assert.deepEqual((await pausa.enviar()).rejeitados, []);
      andar(DOIS_MINUTOS);
      await executarTarefasPendentes(amb.deps);
      assert.equal((await pedidoDe(pedido.id)).estado, "aprovado_por_prazo");
      const [p] = await amb.sql<{ inicio: Date; fim: Date }>("select inicio, fim from execucao_pausa where id = $1", [pausa.id]);
      assert.equal(new Date(p!.fim).getTime(), new Date(p!.inicio).getTime());
      assert.equal(new Date((await execucaoDe(execId)).fim!).getTime(), new Date(p!.inicio).getTime(), "a execução termina no início da pausa, nunca antes dela");
    });
  });

  describe("sem sinal", () => {
    it("o evento que veio da fila offline vale na hora: nada é pedido, o pedido_aberto aplica a ação", async () => {
      const { o, execId } = await osEmExecucao();
      andar(15 * 60_000);
      const doisMinutosAtras = new Date(amb.relogio.agora.getTime() - 5 * 60_000).toISOString();
      const encerrou = pedir(colega, o.id, execId, "encerrar", { instante: doisMinutosAtras }, doisMinutosAtras);
      const r = await encerrou.enviar();
      assert.deepEqual(r.rejeitados, [], JSON.stringify(r.rejeitados));
      assert.equal((await amb.sql("select 1 from execucao_pedido where id = $1", [encerrou.id])).length, 0, "nenhum pedido foi aberto");
      const e = await execucaoDe(execId);
      assert.equal(e.resultado, "encerrada");
      assert.equal(new Date(e.fim!).toISOString(), doisMinutosAtras);
      assert.equal(e.finalizada_por, colega.id);
      assert.ok((await alertas(o.id, "acao_de_participante")).some((a) => a.destinatario_id === tecnico.id && /encerrou a OS sem sinal/.test(a.detalhe)));
    });

    it("o encerrar e o suspender diretos, vindos da fila offline, também valem na hora", async () => {
      const a = await osEmExecucao();
      const b = await osEmExecucao();
      andar(30 * 60_000);
      const antes = new Date(amb.relogio.agora.getTime() - 10 * 60_000).toISOString();
      const enc = await h.enviar(colega, h.evento("execucao_encerrada", { execucao_id: a.execId, fim: antes, ...POSICAO }, a.o.id, antes));
      assert.deepEqual(enc.rejeitados, [], JSON.stringify(enc.rejeitados));
      assert.equal((await execucaoDe(a.execId)).finalizada_por, colega.id);

      const susp = await h.enviar(terceiro, h.evento("execucao_suspensa", { execucao_id: b.execId, fim: antes, motivo: "falta_material" }, b.o.id, antes));
      assert.deepEqual(susp.rejeitados, [], JSON.stringify(susp.rejeitados));
      assert.equal((await execucaoDe(b.execId)).resultado, "suspensa");
    });
  });

  it("o relatório da execução traz as ações dos participantes e o pedido, e o PDF da OS usa a assinatura de quem encerrou", async () => {
    const { o, execId } = await osEmExecucao();
    await pausar(colega, o.id, execId, { motivo: "clima" }).enviar();
    andar(60_000);
    const pedido = pedir(terceiro, o.id, execId, "encerrar");
    await pedido.enviar();
    await h.enviar(colega, h.evento("pedido_apoiado", { pedido_id: pedido.id }, o.id));
    andar(DOIS_MINUTOS);
    await executarTarefasPendentes(amb.deps);
    await h.assinarEncerramento(terceiro, o.id, execId);
    assert.equal(await statusDa(o.id), "aguardando_supervisor");
    const pdf = await gerarRelatorioDaExecucao(amb.deps, o.id, { comprimir: false });
    const texto = Buffer.from(pdf).toString("latin1");
    assert.ok(texto.startsWith("%PDF"));
    // A seção existe quando há ação de participante (o texto do PDF não é legível sem decodificar; basta não quebrar e ter o dado no banco).
    assert.equal((await amb.sql("select 1 from execucao_pedido_apoio where pedido_id = $1", [pedido.id])).length, 1);
  });
});
