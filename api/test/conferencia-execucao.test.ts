import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { LIMITE_DA_CONFERENCIA_MS, TOLERANCIA_MS, type ConferenciaDaApi, type VersaoDeAutor } from "../../shared/api/conferencia-execucao";
import { localInstalacao, os } from "../src/db/schema";
import { compararVersoes, responsavelDaConferencia } from "../src/dominio/conferencia-comparacao";
import { conferirConferencias } from "../src/dominio/conferencia-execucao";
import { carregarDadosDoRelatorio, gerarRelatorioDaExecucao } from "../src/servicos/relatorio-execucao";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";
import { POSICAO, ajudaDeExecucao } from "./ajuda-execucao";

const HORA = 3_600_000;
const DIA = 24 * HORA;

/**
 * Execução compartilhada, etapa 3 (`funcionalidades/execucao-compartilhada.md`, seção 5): o que a equipe registra sem sinal, em
 * aparelhos diferentes, é guardado sem recusar nada, e quando todos sincronizam o servidor compara as versões. Sem divergência é um
 * resumo com ciência; com divergência o responsável escolhe, e os demais assinam.
 */
describe("Execução compartilhada, etapa 3: a conferência do que a equipe registrou sem sinal", () => {
  let amb: Ambiente;
  let h: ReturnType<typeof ajudaDeExecucao>;
  let equipeId: string;
  let supervisor: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste; // o primeiro a começar (o PDA dele descarrega, e o aparelho do colega chega primeiro à api)
  let colega: UsuarioDeTeste;
  let terceiro: UsuarioDeTeste;
  let modeloId: string;
  let itens: { id: string; secao: string; respostaBloqueante: string | null }[];
  let localId: string;
  let contadorOs = 4600000;

  const andar = (ms: number) => {
    amb.relogio.agora = new Date(amb.relogio.agora.getTime() + ms);
  };
  const minuto = (base: Date, n: number) => new Date(base.getTime() + n * 60_000).toISOString();
  /** Cada cenário começa de manhã, num dia novo: a APR e a execução são do mesmo dia, e nada fica aberto de um dia para o outro. */
  const amanhecer = () => {
    amb.relogio.agora = new Date(Math.floor(amb.relogio.agora.getTime() / DIA) * DIA + DIA + 15 * HORA);
  };

  before(async () => {
    amb = await criarAmbiente({ comCarga: true, relogio: new Date("2026-10-19T15:00:00Z"), duracaoDoTokenSeg: 60 * 86_400 });
    h = ajudaDeExecucao(amb);
    supervisor = await amb.criarUsuario({ perfil: "tecnico", nome: "Sônia Supervisora" });
    equipeId = (await amb.criarEquipe({ supervisorId: supervisor.id })).id;
    await amb.sql("update usuario set equipe_id = $1 where id = $2", [equipeId, supervisor.id]);
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Tiago Técnico" });
    colega = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Carla Colega" });
    terceiro = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Teresa Terceira" });
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
    amanhecer();
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

  const ev = (tipo: string, payload: object, osId: string, quando: string) => h.evento(tipo, payload, osId, quando);
  const sincronizar = (como: UsuarioDeTeste, fila: { os_id: string; quantos: number }[] = []) => amb.esperar(200, "POST", "/sync/pull", { como, json: { fila } });
  const limpas = (r: { rejeitados: unknown[]; pendentes: unknown[] }) => assert.deepEqual([r.rejeitados, r.pendentes], [[], []], JSON.stringify([r.rejeitados, r.pendentes]));
  const conferenciaDe = async (execucaoId: string) =>
    (await amb.sql<{ id: string; estado: string; tipo: string | null; responsavel_id: string | null; faltaram: { sincronizar: string[]; assinar: string[] } | null; fechada_por: string | null; avisada24h_em: string | null; avisada48h_em: string | null }>(
      "select id, estado, tipo, responsavel_id, faltaram, fechada_por, avisada24h_em, avisada48h_em from conferencia_execucao where execucao_id = $1",
      [execucaoId],
    ))[0];
  const ler = (como: UsuarioDeTeste, id: string) => amb.esperar(200, "GET", `/conferencias/${id}`, { como }) as Promise<ConferenciaDaApi>;
  const decidir = (como: UsuarioDeTeste, id: string, escolhas: { campo: string; escolha: string }[]) => amb.req("POST", `/conferencias/${id}/decidir`, { como, json: { escolhas } });
  const assinar = (como: UsuarioDeTeste, id: string, ressalva?: string) => amb.req("POST", `/conferencias/${id}/assinar`, { como, json: ressalva ? { ressalva } : {} });
  const fechar = (como: UsuarioDeTeste, id: string) => amb.req("POST", `/conferencias/${id}/fechar`, { como, json: {} });
  const alertas = (osId: string, tipo: string) => amb.sql<{ destinatario_id: string; detalhe: string }>("select destinatario_id, detalhe from alerta where os_id = $1 and tipo = $2 order by criado_em, id", [osId, tipo]);
  const minhaAcao = async (como: UsuarioDeTeste, id: string) => ((await amb.esperar(200, "GET", "/me/conferencias", { como })).conferencias as { id: string; minha_acao: string }[]).find((c) => c.id === id)?.minha_acao;

  /**
   * Os três aparelhos da equipe registram a execução sem sinal e sobem a fila na ordem do colega, do técnico e da terceira. Todos usam
   * o app (sincronizaram antes), então a conferência espera cada um sincronizar de novo. O colega chega primeiro e vira o responsável
   * gravado; o técnico começou antes (o responsável de verdade); a pausa de cada um se sobrepõe.
   */
  async function tresAparelhos(opcoes: { fimDoTecnico?: "encerrada" | "suspensa" } = {}) {
    const o = await novaOs();
    const aprId = await registrarApr(o.id, [tecnico, colega, terceiro]);
    await h.assinarApr(aprId, o.id, [tecnico, colega, terceiro]);
    for (const u of [tecnico, colega, terceiro]) await sincronizar(u);
    const t0 = amb.relogio.agora;
    andar(4 * HORA);
    const L1 = randomUUID();
    const L2 = randomUUID();
    const L3 = randomUUID();
    const P1 = randomUUID();
    const P2 = randomUUID();

    limpas(
      await h.enviar(
        colega,
        ev("execucao_iniciada", { id: L2, apr_id: aprId, inicio: minuto(t0, 10), ...POSICAO }, o.id, minuto(t0, 10)),
        ev("pausa_iniciada", { id: P2, execucao_id: L2, inicio: minuto(t0, 60), motivo: "almoco" }, o.id, minuto(t0, 60)),
        ev("pausa_encerrada", { pausa_id: P2, fim: minuto(t0, 125) }, o.id, minuto(t0, 125)),
        ev("execucao_encerrada", { execucao_id: L2, fim: minuto(t0, 170), ...POSICAO }, o.id, minuto(t0, 170)),
      ),
    );
    const fimDoTecnico =
      opcoes.fimDoTecnico === "suspensa"
        ? ev("execucao_suspensa", { execucao_id: L1, fim: minuto(t0, 150), motivo: "clima" }, o.id, minuto(t0, 150))
        : ev("execucao_encerrada", { execucao_id: L1, fim: minuto(t0, 150), ...POSICAO }, o.id, minuto(t0, 150));
    limpas(
      await h.enviar(
        tecnico,
        ev("execucao_iniciada", { id: L1, apr_id: aprId, inicio: minuto(t0, 0), ...POSICAO }, o.id, minuto(t0, 0)),
        ev("pausa_iniciada", { id: P1, execucao_id: L1, inicio: minuto(t0, 62), motivo: "almoco" }, o.id, minuto(t0, 62)),
        ev("pausa_encerrada", { pausa_id: P1, fim: minuto(t0, 135) }, o.id, minuto(t0, 135)),
        fimDoTecnico,
      ),
    );
    limpas(await h.enviar(terceiro, ev("execucao_iniciada", { id: L3, apr_id: aprId, inicio: minuto(t0, 1), ...POSICAO }, o.id, minuto(t0, 1))));
    return { o, aprId, t0, execId: L2, L1, L3, P1, P2 };
  }

  describe("o que fica guardado quando os aparelhos se contradizem", () => {
    it("o início de outro aparelho não é recusado: vira versão da mesma execução, e os eventos seguintes dele chegam a ela", async () => {
      const { o, execId, L1, L3, P1 } = await tresAparelhos();
      assert.equal((await amb.sql("select 1 from execucao where os_id = $1", [o.id])).length, 1, "uma execução só");
      const [e] = await amb.sql<{ id: string; executor_id: string; resultado: string }>("select id, executor_id, resultado from execucao where os_id = $1", [o.id]);
      assert.equal(e!.id, execId);
      assert.equal(e!.executor_id, colega.id, "quem chegou primeiro à api fica como responsável gravado");
      const eventos = await amb.sql<{ usuario_id: string; tipo: string; so_versao: boolean; execucao_id: string | null; offline: boolean; payload: { id?: string } }>(
        "select usuario_id, tipo, so_versao, execucao_id, offline, payload from evento_campo where os_id = $1 order by ocorrido_em",
        [o.id],
      );
      const daExecucao = (x: { tipo: string }) => !x.tipo.startsWith("apr_");
      const doTecnico = eventos.filter((x) => x.usuario_id === tecnico.id && daExecucao(x));
      assert.ok(doTecnico.every((x) => x.execucao_id === execId && x.offline), "todos os eventos dele apontam para a execução de verdade");
      assert.equal(doTecnico.find((x) => x.tipo === "execucao_iniciada")!.so_versao, true);
      assert.equal(doTecnico.find((x) => x.tipo === "execucao_iniciada")!.payload.id, L1);
      assert.equal(doTecnico.find((x) => x.tipo === "execucao_encerrada")!.so_versao, true, "o segundo fim também é só versão");
      const doTerceiro = eventos.find((x) => x.usuario_id === terceiro.id && daExecucao(x))!;
      assert.equal(doTerceiro.payload.id, L3);
      assert.equal(doTerceiro.so_versao, true);
      // A pausa dele chegou depois de a execução ter terminado (pelo aparelho do colega): também é só versão; a execução fica com a do colega.
      assert.equal((await amb.sql("select 1 from execucao_pausa where execucao_id = $1", [execId])).length, 1);
      assert.deepEqual(
        eventos.filter((x) => x.usuario_id === tecnico.id && x.tipo.startsWith("pausa_")).map((x) => [x.tipo, x.so_versao]),
        [["pausa_iniciada", true], ["pausa_encerrada", true]],
      );
      assert.ok(P1);
    });

    it("duas pausas abertas ao mesmo tempo: a segunda fica como versão, com o fim dela, e nada é recusado", async () => {
      const o = await novaOs();
      const aprId = await registrarApr(o.id, [tecnico, colega, terceiro]);
      await h.assinarApr(aprId, o.id, [tecnico, colega, terceiro]);
      const t0 = amb.relogio.agora;
      andar(3 * HORA);
      const L1 = randomUUID();
      const L2 = randomUUID();
      const P1 = randomUUID();
      const P2 = randomUUID();
      limpas(
        await h.enviar(
          colega,
          ev("execucao_iniciada", { id: L2, apr_id: aprId, inicio: minuto(t0, 5), ...POSICAO }, o.id, minuto(t0, 5)),
          ev("pausa_iniciada", { id: P2, execucao_id: L2, inicio: minuto(t0, 60), motivo: "almoco" }, o.id, minuto(t0, 60)),
        ),
      );
      const r = await h.enviar(
        tecnico,
        ev("execucao_iniciada", { id: L1, apr_id: aprId, inicio: minuto(t0, 0), ...POSICAO }, o.id, minuto(t0, 0)),
        ev("pausa_iniciada", { id: P1, execucao_id: L1, inicio: minuto(t0, 70), motivo: "descanso" }, o.id, minuto(t0, 70)),
        ev("pausa_encerrada", { pausa_id: P1, fim: minuto(t0, 100) }, o.id, minuto(t0, 100)),
      );
      limpas(r);
      assert.equal(r.confirmados.length, 3);
      const eventos = await amb.sql<{ tipo: string; so_versao: boolean }>("select tipo, so_versao from evento_campo where usuario_id = $1 and os_id = $2 and tipo not like 'apr_%' order by ocorrido_em", [tecnico.id, o.id]);
      assert.deepEqual(eventos.map((x) => [x.tipo, x.so_versao]), [["execucao_iniciada", true], ["pausa_iniciada", true], ["pausa_encerrada", true]]);
      assert.equal((await amb.sql("select 1 from execucao_pausa where execucao_id = $1", [L2])).length, 1, "a execução continua com a pausa aberta do colega");
      // O colega termina (a pausa aberta fecha com a execução): nada fica aberto.
      limpas(await h.enviar(colega, ev("execucao_encerrada", { execucao_id: L2, fim: minuto(t0, 130), ...POSICAO }, o.id, minuto(t0, 130))));
    });

    it("a mesma pausa vista por dois aparelhos, sem conflito de horário, vira uma só quando a conferência fecha (o resumo)", async () => {
      const o = await novaOs();
      const aprId = await registrarApr(o.id, [tecnico, colega, terceiro]);
      await h.assinarApr(aprId, o.id, [tecnico, colega, terceiro]);
      const t0 = amb.relogio.agora;
      andar(3 * HORA);
      const L1 = randomUUID();
      const L2 = randomUUID();
      const P1 = randomUUID();
      const P2 = randomUUID();
      limpas(
        await h.enviar(
          colega,
          ev("execucao_iniciada", { id: L2, apr_id: aprId, inicio: minuto(t0, 0), ...POSICAO }, o.id, minuto(t0, 0)),
          ev("pausa_iniciada", { id: P2, execucao_id: L2, inicio: minuto(t0, 60), motivo: "almoco" }, o.id, minuto(t0, 60)),
          ev("pausa_encerrada", { pausa_id: P2, fim: minuto(t0, 90) }, o.id, minuto(t0, 90)),
        ),
      );
      // A pausa do técnico chega com a execução ainda aberta e a do colega já fechada: não conflita, e fica duplicada na execução.
      limpas(
        await h.enviar(
          tecnico,
          ev("execucao_iniciada", { id: L1, apr_id: aprId, inicio: minuto(t0, 1), ...POSICAO }, o.id, minuto(t0, 1)),
          ev("pausa_iniciada", { id: P1, execucao_id: L1, inicio: minuto(t0, 61), motivo: "almoco" }, o.id, minuto(t0, 61)),
          ev("pausa_encerrada", { pausa_id: P1, fim: minuto(t0, 91) }, o.id, minuto(t0, 91)),
        ),
      );
      assert.equal((await amb.sql("select 1 from execucao_pausa where execucao_id = $1", [L2])).length, 2);
      limpas(await h.enviar(colega, ev("execucao_encerrada", { execucao_id: L2, fim: minuto(t0, 120), ...POSICAO }, o.id, minuto(t0, 120))));
      limpas(await h.enviar(tecnico, ev("execucao_encerrada", { execucao_id: L1, fim: minuto(t0, 121), ...POSICAO }, o.id, minuto(t0, 121))));
      for (const u of [tecnico, colega, terceiro]) await sincronizar(u);
      const conf = (await conferenciaDe(L2))!;
      assert.equal(conf.tipo, "resumo", "as versões batem dentro da tolerância");
      assert.equal((await amb.sql("select 1 from execucao_pausa where execucao_id = $1", [L2])).length, 1, "a pausa duplicada saiu da execução");
    });

    it("com sinal, o conflito continua recusado como sempre: a APR já amparou a execução do responsável", async () => {
      const o = await novaOs();
      const aprId = await registrarApr(o.id, [tecnico, colega, terceiro]);
      await h.assinarApr(aprId, o.id, [tecnico, colega, terceiro]);
      const execId = await h.iniciar(tecnico, o.id, aprId, POSICAO);
      const r = await h.enviar(colega, ev("execucao_iniciada", { id: randomUUID(), apr_id: aprId, inicio: h.agora(), ...POSICAO }, o.id, h.agora()));
      assert.equal(r.rejeitados[0]?.codigo, "apr_ja_usada");
      await h.encerrar(tecnico, o.id, execId);
    });

    it("tudo online: nenhuma conferência", async () => {
      const o = await novaOs();
      const aprId = await registrarApr(o.id, [tecnico, colega, terceiro]);
      const execId = await h.executarAteOFim(o.id, aprId, [tecnico, colega, terceiro]);
      assert.equal(await conferenciaDe(execId), undefined);
    });
  });

  describe("a conferência com divergência", () => {
    it("espera todos sincronizarem (com a fila da OS vazia), compara, o responsável escolhe, o supervisor assina por último e a equipe assina", async () => {
      const { o, t0, execId, L1, P1, P2 } = await tresAparelhos();

      // Nasceu quando a execução terminou, esperando a sincronização de todos (que usam o app).
      const aguardando = (await conferenciaDe(execId))!;
      assert.equal(aguardando.estado, "aguardando_sincronizacao");
      assert.equal(aguardando.tipo, null);
      assert.deepEqual((await alertas(o.id, "conferencia_aberta")).map((a) => a.destinatario_id).sort(), [tecnico.id, colega.id, terceiro.id].sort());
      assert.equal(await minhaAcao(tecnico, aguardando.id), "aguardar");

      await sincronizar(tecnico);
      await sincronizar(colega);
      assert.equal((await conferenciaDe(execId))!.estado, "aguardando_sincronizacao", "a terceira ainda não sincronizou");
      await sincronizar(terceiro, [{ os_id: o.id, quantos: 2 }]);
      assert.equal((await conferenciaDe(execId))!.estado, "aguardando_sincronizacao", "ela sincronizou, mas ainda tem registro na fila");
      assert.equal((await ler(supervisor, aguardando.id)).participantes.find((p) => p.usuario.id === terceiro.id)!.sincronizou, false);
      await sincronizar(terceiro);

      // Montada: o responsável de verdade é quem começou primeiro (o técnico), a mais de 5 minutos do que a execução tem gravado.
      const montada = (await conferenciaDe(execId))!;
      assert.equal(montada.estado, "aguardando_responsavel");
      assert.equal(montada.tipo, "com_divergencia");
      assert.equal(montada.responsavel_id, tecnico.id);
      const c = await ler(tecnico, montada.id);
      const porCampo = new Map(c.campos.map((x) => [x.campo, x]));
      assert.deepEqual([...porCampo.keys()], ["inicio", "fim", "resultado", "pausa:1"]);
      assert.equal(porCampo.get("inicio")!.divergente, true);
      assert.equal(porCampo.get("inicio")!.sugerido, tecnico.id, "o padrão sugerido é o início mais antigo");
      assert.equal(porCampo.get("fim")!.divergente, true);
      assert.equal(porCampo.get("fim")!.sugerido, tecnico.id, "e a conclusão mais antiga");
      assert.equal(porCampo.get("resultado")!.divergente, false, "os dois encerraram");
      assert.equal(porCampo.get("pausa:1")!.divergente, true, "as pausas não batem no fim");
      assert.equal(porCampo.get("pausa:1")!.opcoes.length, 2, "as duas pausas se casaram por sobreposição");
      assert.equal(porCampo.get("pausa:1")!.sugerido, tecnico.id, "a pausa do responsável");
      assert.equal(porCampo.get("inicio")!.valendo_de, colega.id, "valendo na execução: o início do aparelho que chegou primeiro");
      assert.equal(porCampo.get("pausa:1")!.valendo_de, colega.id, "e a pausa dele: a do técnico chegou depois do fim e ficou só como versão");
      assert.deepEqual(c.eu.pode_decidir.sort(), ["fim", "inicio", "pausa:1"]);
      assert.deepEqual((await ler(colega, montada.id)).eu.pode_decidir, []);
      assert.equal(await minhaAcao(tecnico, montada.id), "decidir");
      assert.equal(await minhaAcao(colega, montada.id), "aguardar");
      assert.deepEqual((await alertas(o.id, "conferencia_para_decidir")).map((a) => a.destinatario_id), [tecnico.id]);

      // A equipe lê, mas só o responsável escolhe horários e pausas.
      assert.equal((await decidir(colega, montada.id, [{ campo: "fim", escolha: colega.id }])).status, 403);
      assert.equal((await decidir(tecnico, montada.id, [{ campo: "resultado", escolha: tecnico.id }])).status, 422, "o resultado não diverge: não há o que escolher");
      assert.equal((await decidir(tecnico, montada.id, [{ campo: "fim", escolha: randomUUID() }])).status, 422);

      // O supervisor espera a conferência para assinar por último (o relatório inclui a conferência).
      await h.assinarEncerramento(colega, o.id, execId);
      assert.equal(await statusDa(o.id), "aguardando_supervisor");
      const bloqueada = await h.concluir(supervisor, o.id);
      assert.equal(bloqueada.status, 409);
      assert.equal(bloqueada.corpo.erro.codigo, "conferencia_pendente");
      assert.equal((await amb.esperar(200, "GET", `/os/${o.id}`, { como: supervisor })).conferencias[0].estado, "aguardando_responsavel");

      // O responsável escolhe em duas vezes: o que falta ainda espera.
      const parcial = await decidir(tecnico, montada.id, [
        { campo: "inicio", escolha: tecnico.id },
        { campo: "fim", escolha: tecnico.id },
      ]);
      assert.equal(parcial.status, 200);
      assert.equal(parcial.corpo.estado, "aguardando_responsavel");
      assert.deepEqual(parcial.corpo.eu.pode_decidir, ["pausa:1"]);
      const depois = await decidir(tecnico, montada.id, [{ campo: "pausa:1", escolha: tecnico.id }]);
      assert.equal(depois.status, 200, JSON.stringify(depois.corpo));
      assert.equal(depois.corpo.estado, "aguardando_assinaturas");

      // Aplicado nas tabelas da execução: o início, o fim e a pausa do técnico (a do colega sai), o técnico como responsável.
      const [e] = await amb.sql<{ inicio: Date; fim: Date; executor_id: string; resultado: string; finalizada_por: string }>("select inicio, fim, executor_id, resultado, finalizada_por from execucao where id = $1", [execId]);
      assert.equal(new Date(e!.inicio).toISOString(), minuto(t0, 0));
      assert.equal(new Date(e!.fim).toISOString(), minuto(t0, 150));
      assert.equal(e!.executor_id, tecnico.id);
      assert.equal(e!.resultado, "encerrada");
      assert.equal(e!.finalizada_por, colega.id, "quem encerrou continua sendo quem assinou o encerramento");
      const pausas = await amb.sql<{ id: string; inicio: Date; fim: Date; iniciada_por: string }>("select id, inicio, fim, iniciada_por from execucao_pausa where execucao_id = $1", [execId]);
      assert.equal(pausas.length, 1);
      assert.equal(pausas[0]!.id, P1);
      assert.equal(new Date(pausas[0]!.inicio).toISOString(), minuto(t0, 62));
      assert.equal(new Date(pausas[0]!.fim).toISOString(), minuto(t0, 135));
      assert.equal(pausas[0]!.iniciada_por, tecnico.id);
      const [guardado] = await amb.sql<{ snapshot: { canonico_antes: { executor_id: string; pausas: { id: string }[] } } }>("select snapshot from conferencia_execucao where id = $1", [montada.id]);
      assert.equal(guardado!.snapshot.canonico_antes.executor_id, colega.id, "o que valia antes fica guardado");
      assert.deepEqual(guardado!.snapshot.canonico_antes.pausas.map((p) => p.id), [P2]);
      assert.equal(await minhaAcao(colega, montada.id), "assinar");
      assert.equal(await minhaAcao(tecnico, montada.id), "aguardar");
      assert.deepEqual((await alertas(o.id, "conferencia_para_assinar")).map((a) => a.destinatario_id).sort(), [colega.id, terceiro.id].sort());
      assert.ok(L1);

      // Já está com os dados conferidos: o supervisor assina por último.
      assert.equal((await h.concluir(supervisor, o.id)).status, 200);
      assert.equal(await statusDa(o.id), "encerrada");

      // O responsável não assina a própria escolha; os demais assinam com a assinatura do perfil, e a ressalva avisa o supervisor.
      assert.equal((await assinar(tecnico, montada.id)).status, 403);
      assert.equal((await assinar(colega, montada.id)).status, 200);
      assert.equal((await conferenciaDe(execId))!.estado, "aguardando_assinaturas");
      const ultima = await assinar(terceiro, montada.id, "Cheguei depois do almoço; não vi a pausa.");
      assert.equal(ultima.status, 200);
      assert.equal(ultima.corpo.estado, "concluida");
      const assinaturas = await amb.sql<{ usuario_id: string; tipo: string; assinatura_path: string | null; ressalva: string | null }>("select usuario_id, tipo, assinatura_path, ressalva from conferencia_assinatura where conferencia_id = $1", [montada.id]);
      assert.equal(assinaturas.length, 2);
      assert.ok(assinaturas.every((a) => a.tipo === "assinatura" && a.assinatura_path));
      assert.equal(assinaturas.find((a) => a.usuario_id === terceiro.id)!.ressalva, "Cheguei depois do almoço; não vi a pausa.");
      assert.deepEqual((await alertas(o.id, "conferencia_ressalva")).map((a) => a.destinatario_id).sort(), [supervisor.id, tecnico.id].sort());
      assert.equal((await assinar(terceiro, montada.id)).status, 409, "a conferência já terminou");

      // O relatório da execução traz a conferência.
      const dados = await carregarDadosDoRelatorio(amb.deps, o.id);
      assert.equal(dados.conferencias.length, 1);
      assert.equal(dados.conferencias[0]!.dados.decisoes.length, 3);
      assert.equal(dados.conferencias[0]!.dados.assinaturas.find((a) => a.ressalva)!.nome, "Teresa Terceira");
      const pdf = await gerarRelatorioDaExecucao(amb.deps, o.id, { comprimir: false });
      assert.ok(Buffer.from(pdf).toString("latin1").startsWith("%PDF"));
    });

    it("o resultado que diverge (um encerrou, outro suspendeu) é do supervisor, e muda o status da OS", async () => {
      const { o, execId } = await tresAparelhos({ fimDoTecnico: "suspensa" });
      for (const u of [tecnico, colega, terceiro]) await sincronizar(u);
      const conf = (await conferenciaDe(execId))!;
      assert.equal(conf.estado, "aguardando_responsavel");
      const c = await ler(supervisor, conf.id);
      const resultado = c.campos.find((x) => x.campo === "resultado")!;
      assert.equal(resultado.divergente, true);
      assert.equal(resultado.decide, "supervisor");
      assert.equal(resultado.sugerido, tecnico.id, "a conclusão mais antiga: a suspensão do técnico (a mais cedo)");
      assert.ok(c.eu.pode_decidir.includes("resultado"));
      assert.deepEqual((await alertas(o.id, "conferencia_para_decidir")).map((a) => a.destinatario_id).sort(), [supervisor.id, tecnico.id].sort(), "o supervisor também é chamado");

      assert.equal((await decidir(tecnico, conf.id, [{ campo: "resultado", escolha: tecnico.id }])).status, 403, "o responsável não escolhe o resultado");
      assert.equal((await decidir(tecnico, conf.id, [{ campo: "inicio", escolha: tecnico.id }, { campo: "fim", escolha: tecnico.id }, { campo: "pausa:1", escolha: tecnico.id }])).status, 200);
      assert.equal((await conferenciaDe(execId))!.estado, "aguardando_responsavel", "falta o resultado");
      assert.equal(await minhaAcao(supervisor, conf.id), "decidir");
      const feito = await decidir(supervisor, conf.id, [{ campo: "resultado", escolha: tecnico.id }]);
      assert.equal(feito.status, 200, JSON.stringify(feito.corpo));
      assert.equal(feito.corpo.estado, "aguardando_assinaturas");
      const [e] = await amb.sql<{ resultado: string; finalizada_por: string; suspensao_motivo: string | null }>("select resultado, finalizada_por, suspensao_motivo from execucao where id = $1", [execId]);
      assert.deepEqual(e, { resultado: "suspensa", finalizada_por: tecnico.id, suspensao_motivo: "clima" });
      assert.equal(await statusDa(o.id), "pendente", "o serviço não terminou: a OS volta a pendente");
    });

    it("pausa registrada por um aparelho só, sem sinal: o responsável aceita ou descarta", async () => {
      const o = await novaOs();
      const aprId = await registrarApr(o.id, [tecnico, colega, terceiro]);
      await h.assinarApr(aprId, o.id, [tecnico, colega, terceiro]);
      const t0 = amb.relogio.agora;
      andar(3 * HORA);
      const L1 = randomUUID();
      const L2 = randomUUID();
      const P2 = randomUUID();
      limpas(
        await h.enviar(
          colega,
          ev("execucao_iniciada", { id: L2, apr_id: aprId, inicio: minuto(t0, 0), ...POSICAO }, o.id, minuto(t0, 0)),
          ev("pausa_iniciada", { id: P2, execucao_id: L2, inicio: minuto(t0, 60), motivo: "clima" }, o.id, minuto(t0, 60)),
          ev("pausa_encerrada", { pausa_id: P2, fim: minuto(t0, 90) }, o.id, minuto(t0, 90)),
          ev("execucao_encerrada", { execucao_id: L2, fim: minuto(t0, 120), ...POSICAO }, o.id, minuto(t0, 120)),
        ),
      );
      limpas(
        await h.enviar(
          tecnico,
          ev("execucao_iniciada", { id: L1, apr_id: aprId, inicio: minuto(t0, 1), ...POSICAO }, o.id, minuto(t0, 1)),
          ev("execucao_encerrada", { execucao_id: L1, fim: minuto(t0, 121), ...POSICAO }, o.id, minuto(t0, 121)),
        ),
      );
      assert.equal((await conferenciaDe(L2))!.estado, "aguardando_sincronizacao");
      for (const u of [tecnico, colega, terceiro]) await sincronizar(u);
      const conf = (await conferenciaDe(L2))!;
      assert.equal(conf.estado, "aguardando_responsavel");
      const c = await ler(colega, conf.id);
      assert.equal(c.responsavel!.id, colega.id, "começaram a menos de 5 minutos um do outro: fica quem a execução já tem");
      const pausa = c.campos.find((x) => x.campo === "pausa:1")!;
      assert.equal(pausa.so_um, true);
      assert.equal(pausa.divergente, true);
      assert.deepEqual(c.campos.filter((x) => x.divergente).map((x) => x.campo), ["pausa:1"]);

      assert.equal((await decidir(colega, conf.id, [{ campo: "pausa:1", escolha: "descartar" }])).status, 200);
      assert.equal((await amb.sql("select 1 from execucao_pausa where execucao_id = $1", [L2])).length, 0, "a pausa descartada sai da execução");
    });
  });

  describe("o resumo", () => {
    it("um aparelho só registrou tudo (o 'funcionário 2'): é um resumo, e os outros só dão ciência, sem assinar", async () => {
      // A terceira nunca baixou a cópia do app (só usa o sistema com sinal): não tem fila offline a esperar.
      const novata = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Nina Novata" });
      const o = await novaOs();
      const aprId = await registrarApr(o.id, [tecnico, colega, novata]);
      await h.assinarApr(aprId, o.id, [tecnico, colega, novata]);
      await sincronizar(tecnico);
      await sincronizar(colega);
      const t0 = amb.relogio.agora;
      andar(4 * HORA);
      const L2 = randomUUID();
      const P2 = randomUUID();
      limpas(
        await h.enviar(
          colega,
          ev("execucao_iniciada", { id: L2, apr_id: aprId, inicio: minuto(t0, 5), ...POSICAO }, o.id, minuto(t0, 5)),
          ev("pausa_iniciada", { id: P2, execucao_id: L2, inicio: minuto(t0, 60), motivo: "almoco" }, o.id, minuto(t0, 60)),
          ev("pausa_encerrada", { pausa_id: P2, fim: minuto(t0, 120) }, o.id, minuto(t0, 120)),
          ev("execucao_encerrada", { execucao_id: L2, fim: minuto(t0, 180), ...POSICAO }, o.id, minuto(t0, 180)),
        ),
      );
      const conf = (await conferenciaDe(L2))!;
      assert.equal(conf.estado, "aguardando_sincronizacao", "o técnico e o colega usam o app e ainda não sincronizaram depois do fim");
      await sincronizar(tecnico);
      assert.equal((await conferenciaDe(L2))!.estado, "aguardando_sincronizacao", "falta o colega");
      await sincronizar(colega);
      const montada = (await conferenciaDe(L2))!;
      assert.equal(montada.tipo, "resumo");
      assert.equal(montada.estado, "aguardando_assinaturas", "o resumo não espera escolha");
      assert.equal(montada.responsavel_id, colega.id);
      assert.equal((await decidir(colega, conf.id, [{ campo: "fim", escolha: colega.id }])).status, 409);
      assert.equal(await minhaAcao(tecnico, conf.id), "ciencia");
      assert.equal(await minhaAcao(colega, conf.id), "aguardar", "o responsável não dá ciência da própria execução");

      // Com os dados já conferidos, o supervisor pode assinar assim que o encerramento estiver assinado.
      await h.assinarEncerramento(colega, o.id, L2);
      assert.equal((await h.concluir(supervisor, o.id)).status, 200);

      assert.equal((await assinar(colega, conf.id)).status, 403);
      assert.equal((await assinar(tecnico, conf.id)).status, 200);
      assert.equal((await conferenciaDe(L2))!.estado, "aguardando_assinaturas");
      assert.equal((await assinar(novata, conf.id)).corpo.estado, "concluida");
      const assinaturas = await amb.sql<{ tipo: string; assinatura_path: string | null }>("select tipo, assinatura_path from conferencia_assinatura where conferencia_id = $1", [conf.id]);
      assert.deepEqual(assinaturas.map((a) => [a.tipo, a.assinatura_path]), [["ciencia", null], ["ciencia", null]]);
    });
  });

  describe("os prazos", () => {
    it("avisa quem falta às 24 h e às 48 h, libera o fechamento às 72 h e segue com o que existe", async () => {
      const { o, execId } = await tresAparelhos();
      const conf = (await conferenciaDe(execId))!;
      const criada = amb.relogio.agora;

      andar(25 * HORA);
      await conferirConferencias(amb.db, amb.relogio.agora);
      assert.equal((await alertas(o.id, "conferencia_cobranca")).length, 3, "os três ainda não sincronizaram");
      assert.ok((await conferenciaDe(execId))!.avisada24h_em);
      await conferirConferencias(amb.db, amb.relogio.agora);
      assert.equal((await alertas(o.id, "conferencia_cobranca")).length, 3, "não repete o aviso");

      andar(24 * HORA);
      await conferirConferencias(amb.db, amb.relogio.agora);
      assert.equal((await alertas(o.id, "conferencia_cobranca")).length, 6);
      assert.ok((await conferenciaDe(execId))!.avisada48h_em);

      // Antes das 72 h ninguém fecha.
      const cedo = await fechar(supervisor, conf.id);
      assert.equal(cedo.status, 409);
      assert.equal(cedo.corpo.erro.codigo, "fechamento_ainda_nao_liberado");

      andar(24 * HORA);
      assert.ok(amb.relogio.agora.getTime() - criada.getTime() >= 72 * HORA);
      assert.equal((await fechar(colega, conf.id)).status, 200, "quem a execução tem como responsável também fecha");
      const montada = (await conferenciaDe(execId))!;
      assert.equal(montada.estado, "aguardando_responsavel", "montou com o que existia, sem esperar quem não sincronizou");
      assert.equal(montada.faltaram!.sincronizar.length, 3);
      assert.equal((await fechar(supervisor, conf.id)).corpo.estado, "aguardando_assinaturas", "sem escolha, vale o padrão sugerido");
      const [e] = await amb.sql<{ inicio: Date; fim: Date }>("select inicio, fim from execucao where id = $1", [execId]);
      assert.equal(new Date(e!.inicio).getTime() <= new Date(e!.fim).getTime(), true);
      const fim = await fechar(supervisor, conf.id);
      assert.equal(fim.corpo.estado, "fechada_sem_todos");
      assert.equal(fim.corpo.fechada_por.id, supervisor.id);
      assert.equal(fim.corpo.faltaram.assinar.length, 2, "o responsável não assina; faltaram os outros dois");
    });

    it("aos 7 dias fecha sozinha, pelo padrão sugerido, e avisa o supervisor", async () => {
      const { o, t0, execId } = await tresAparelhos();
      andar(LIMITE_DA_CONFERENCIA_MS + HORA);
      await conferirConferencias(amb.db, amb.relogio.agora);
      const conf = (await conferenciaDe(execId))!;
      assert.equal(conf.estado, "fechada_sem_todos");
      assert.equal(conf.fechada_por, null, "foi o prazo, não uma pessoa");
      const [e] = await amb.sql<{ inicio: Date; fim: Date; executor_id: string }>("select inicio, fim, executor_id from execucao where id = $1", [execId]);
      assert.equal(new Date(e!.inicio).toISOString(), minuto(t0, 0), "o padrão sugerido: o início mais antigo");
      assert.equal(new Date(e!.fim).toISOString(), minuto(t0, 150), "e a conclusão mais antiga");
      assert.equal(e!.executor_id, tecnico.id);
      assert.ok((await alertas(o.id, "conferencia_tempo_esgotado")).some((a) => a.destinatario_id === supervisor.id));
      assert.equal((await ler(supervisor, conf.id)).fechada_por, null);
      // O resto já fechou: um novo envio da fila não reabre nem altera.
      await conferirConferencias(amb.db, amb.relogio.agora);
      assert.equal((await conferenciaDe(execId))!.estado, "fechada_sem_todos");
    });

    it("o que quem não é da equipe nem da APR vê: nada", async () => {
      const { execId } = await tresAparelhos();
      const conf = (await conferenciaDe(execId))!;
      const outro = await amb.criarUsuario({ perfil: "tecnico", equipeId: (await amb.criarEquipe()).id });
      assert.equal((await amb.req("GET", `/conferencias/${conf.id}`, { como: outro })).status, 404);
      assert.deepEqual((await amb.esperar(200, "GET", "/me/conferencias", { como: outro })).conferencias, []);
    });
  });

  describe("a comparação, sem banco", () => {
    const versao = (autor: string, p: Partial<VersaoDeAutor> = {}): VersaoDeAutor => ({
      autor_id: autor,
      autor_nome: autor.toUpperCase(),
      inicio: "2026-10-19T15:00:00.000Z",
      fim: "2026-10-19T17:00:00.000Z",
      resultado: "encerrada",
      motivo: null,
      complemento: null,
      pausas: [],
      evidencias: 0,
      sem_sinal: true,
      ...p,
    });
    const canonico = { inicio: "2026-10-19T15:00:00.000Z", fim: "2026-10-19T17:00:00.000Z", resultado: "encerrada" as const, finalizadaPor: "a", pausas: [] };
    const divergentes = (campos: ReturnType<typeof compararVersoes>) => campos.filter((c) => c.divergente).map((c) => c.campo);
    const em = (min: number) => new Date(Date.parse("2026-10-19T15:00:00.000Z") + min * 60_000).toISOString();

    it("até a tolerância os horários valem como o mesmo; acima dela divergem", () => {
      const dentro = compararVersoes([versao("a"), versao("b", { fim: em(120 + TOLERANCIA_MS / 60_000) })], "a", canonico);
      assert.deepEqual(divergentes(dentro), []);
      const fora = compararVersoes([versao("a"), versao("b", { fim: em(120 + TOLERANCIA_MS / 60_000 + 1) })], "a", canonico);
      assert.deepEqual(divergentes(fora), ["fim"]);
    });

    it("uma versão só nunca diverge, nem com pausas", () => {
      const campos = compararVersoes([versao("a", { pausas: [{ id: "p1", inicio: em(30), fim: em(60), motivo: "almoco", complemento: null }] })], "a", canonico);
      assert.deepEqual(divergentes(campos), []);
    });

    it("a pausa só de quem veio sem sinal pede confirmação; a de quem registrou com sinal, não", () => {
      const pausa = { id: "p1", inicio: em(30), fim: em(60), motivo: "almoco", complemento: null };
      const semSinal = compararVersoes([versao("a", { pausas: [pausa] }), versao("b")], "b", canonico);
      assert.deepEqual(divergentes(semSinal), ["pausa:1"]);
      const comSinal = compararVersoes([versao("a", { pausas: [pausa], sem_sinal: false }), versao("b")], "b", canonico);
      assert.deepEqual(divergentes(comSinal), []);
    });

    it("pausas se casam por sobreposição; motivos diferentes divergem; pausas separadas não se misturam", () => {
      const a = { id: "pa", inicio: em(30), fim: em(60), motivo: "almoco", complemento: null };
      const b = { id: "pb", inicio: em(31), fim: em(61), motivo: "almoco", complemento: null };
      const c = { id: "pc", inicio: em(90), fim: em(100), motivo: "clima", complemento: null };
      const iguais = compararVersoes([versao("x", { pausas: [a] }), versao("y", { pausas: [b] })], "x", canonico);
      assert.deepEqual(iguais.filter((x) => x.campo.startsWith("pausa:")).map((x) => [x.campo, x.divergente, x.opcoes.length]), [["pausa:1", false, 2]]);
      const motivoDiferente = compararVersoes([versao("x", { pausas: [a] }), versao("y", { pausas: [{ ...b, motivo: "descanso" }] })], "x", canonico);
      assert.deepEqual(divergentes(motivoDiferente), ["pausa:1"]);
      const separadas = compararVersoes([versao("x", { pausas: [a, c] }), versao("y", { pausas: [b] })], "x", canonico);
      assert.deepEqual(separadas.filter((x) => x.campo.startsWith("pausa:")).map((x) => [x.campo, x.opcoes.length]), [["pausa:1", 2], ["pausa:2", 1]]);
    });

    it("o resultado diferente diverge e é do supervisor; as fotos não entram na divergência", () => {
      const campos = compararVersoes([versao("a", { evidencias: 3 }), versao("b", { resultado: "suspensa", motivo: "clima", evidencias: 0 })], "a", canonico);
      assert.deepEqual(divergentes(campos), ["resultado"]);
      assert.equal(campos.find((c) => c.campo === "resultado")!.decide, "supervisor");
    });

    it("o responsável é quem começou mais de 5 minutos antes; dentro da tolerância, quem a execução já tem", () => {
      const a = versao("a", { inicio: em(10) });
      const b = versao("b", { inicio: em(0) });
      assert.equal(responsavelDaConferencia([a, b], "a", em(10)), "b");
      assert.equal(responsavelDaConferencia([versao("a", { inicio: em(3) }), versao("b", { inicio: em(0) })], "a", em(3)), "a");
      assert.equal(responsavelDaConferencia([], "a", em(0)), "a");
    });
  });
});
