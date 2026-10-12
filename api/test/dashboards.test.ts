import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { apr, atividade, equipe, execucao, itemModeloApr, localInstalacao, modeloApr, os, reprogramacao } from "../src/db/schema";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

/** "Agora" dos testes: 15/10/2026 12:00 em São Paulo (UTC-3); os 30 dias vão de 16/09 a 15/10. */
const AGORA = new Date("2026-10-15T15:00:00Z");
const h = (iso: string) => new Date(iso);

/**
 * Cenário: Equipe Norte (supervisor, dois técnicos) e Equipe Sul (sem supervisor, dois técnicos ativos e um inativo).
 * o1 preventiva encerrada (local crítico), o2 corretiva encerrada (com ciência e exportada), o3 preventiva liberada e
 * atrasada, o4 preventiva pendente com APR bloqueada e reprogramação (local crítico), o5 corretiva em execução há mais de
 * 12 h, o6 corretiva com execução interrompida por risco, o7 preventiva cancelada, o8 encerrada no período anterior.
 */
describe("Dashboards de Indicadores e exportação", () => {
  let amb: Ambiente;
  const u: Record<string, UsuarioDeTeste> = {};
  let norte: string;
  let sul: string;
  const ids: Record<string, string> = {};

  before(async () => {
    amb = await criarAmbiente({ relogio: AGORA });
    norte = (await amb.criarEquipe({ nome: "Equipe Norte" })).id;
    sul = (await amb.criarEquipe({ nome: "Equipe Sul" })).id;
    u.supervisor = await amb.criarUsuario({ perfil: "tecnico", equipeId: norte, nome: "Sandra Supervisora", supervisor: true });
    await amb.db.update(equipe).set({ supervisorId: u.supervisor.id }).where(eq(equipe.id, norte));
    u.ana = await amb.criarUsuario({ perfil: "tecnico", equipeId: norte, nome: "Ana Norte" });
    u.bruno = await amb.criarUsuario({ perfil: "tecnico", equipeId: norte, nome: "Bruno Norte", comAssinatura: false });
    u.carla = await amb.criarUsuario({ perfil: "tecnico", equipeId: sul, nome: "Carla Sul" });
    u.davi = await amb.criarUsuario({ perfil: "tecnico", equipeId: sul, nome: "Davi Sul", senhaProvisoria: true });
    u.ex = await amb.criarUsuario({ perfil: "tecnico", equipeId: sul, nome: "Ex Técnico", ativo: false });
    u.admin = await amb.criarUsuario({ perfil: "admin" });

    const [critico] = await amb.db.insert(localInstalacao).values({ codigo: "ESTAÇÃO/CRÍTICA", critico: true }).returning();
    const [comum] = await amb.db.insert(localInstalacao).values({ codigo: "REDE/COMUM" }).returning();
    const [m] = await amb.db.insert(modeloApr).values({ codigo: "APR 03", versao: 1, titulo: "Operação" }).returning();
    await amb.db.insert(itemModeloApr).values({ modeloAprId: m!.id, secao: "verificacao", ordem: 1, texto: "EPI?", respostaBloqueante: "nao", tipo: "eliminatorio" });
    await amb.db.update(modeloApr).set({ publicadoEm: h("2026-01-01T12:00:00Z") }).where(eq(modeloApr.id, m!.id));
    await amb.db.insert(atividade).values({ codigo: "9.9.9", descricao: "Sem modelo", modeloAprCodigo: null });

    let numero = 7_000_000;
    const novaOs = async (nome: string, d: { equipeId: string; tipo: "corretiva" | "preventiva"; status: "liberada" | "pendente" | "em_execucao" | "encerrada" | "cancelada"; inicio: string; local: string; cienciaEm?: Date; exportadaEm?: Date }) => {
      const [o] = await amb.db
        .insert(os)
        .values({
          numeroOrdem: String(++numero),
          tipo: d.tipo,
          titulo: `OS ${nome}`,
          localInstalacaoId: d.local,
          equipeId: d.equipeId,
          dataInicioProg: d.inicio,
          status: d.status,
          origem: "sap",
          cienciaPor: d.cienciaEm ? u.supervisor!.id : null,
          cienciaEm: d.cienciaEm ?? null,
          exportadaSapEm: d.exportadaEm ?? null,
        })
        .returning();
      ids[nome] = o!.id;
      return o!.id;
    };
    const novaApr = async (osId: string, por: UsuarioDeTeste, resultado: "aprovada" | "bloqueada", quando: string) => {
      const id = randomUUID();
      await amb.db.insert(apr).values({ id, osId, modeloAprId: m!.id, preenchidaPor: por.id, resultado, concluidaEm: h(quando) });
      return id;
    };
    const novaExecucao = async (osId: string, por: UsuarioDeTeste, inicio: string, fim: string | null, resultado: "encerrada" | "interrompida" | null) => {
      const aprId = await novaApr(osId, por, "aprovada", new Date(h(inicio).getTime() - 10 * 60_000).toISOString());
      await amb.db.insert(execucao).values({
        id: randomUUID(),
        osId,
        aprId,
        executorId: por.id,
        numeroPessoas: 1,
        inicio: h(inicio),
        fim: fim ? h(fim) : null,
        resultado,
        descricaoAtividade: resultado === "encerrada" ? "Feito" : null,
        motivo: resultado === "interrompida" ? "Vazamento no local" : null,
      });
    };

    const o1 = await novaOs("o1", { equipeId: norte, tipo: "preventiva", status: "encerrada", inicio: "2026-10-05", local: critico!.id });
    await novaExecucao(o1, u.ana, "2026-10-10T12:00:00Z", "2026-10-10T14:00:00Z", "encerrada");
    const o2 = await novaOs("o2", { equipeId: norte, tipo: "corretiva", status: "encerrada", inicio: "2026-10-08", local: comum!.id, cienciaEm: AGORA, exportadaEm: AGORA });
    await novaExecucao(o2, u.bruno, "2026-10-12T12:00:00Z", "2026-10-12T13:00:00Z", "encerrada");
    await novaOs("o3", { equipeId: norte, tipo: "preventiva", status: "liberada", inicio: "2026-10-01", local: comum!.id });
    const o4 = await novaOs("o4", { equipeId: sul, tipo: "preventiva", status: "pendente", inicio: "2026-10-02", local: critico!.id });
    await novaApr(o4, u.carla, "bloqueada", "2026-10-03T12:00:00Z");
    await amb.db.insert(reprogramacao).values({ osId: o4, usuarioId: u.admin!.id, dataAnterior: "2026-10-02", dataNova: "2026-10-02", justificativa: "Aguardando apoio", criadaEm: h("2026-10-04T12:00:00Z") });
    const o5 = await novaOs("o5", { equipeId: sul, tipo: "corretiva", status: "em_execucao", inicio: "2026-10-14", local: comum!.id });
    await novaExecucao(o5, u.carla, "2026-10-14T12:00:00Z", null, null);
    const o6 = await novaOs("o6", { equipeId: sul, tipo: "corretiva", status: "liberada", inicio: "2026-10-20", local: comum!.id });
    await novaExecucao(o6, u.carla, "2026-10-11T12:00:00Z", "2026-10-11T12:30:00Z", "interrompida");
    await novaOs("o7", { equipeId: norte, tipo: "preventiva", status: "cancelada", inicio: "2026-10-06", local: comum!.id });
    const o8 = await novaOs("o8", { equipeId: norte, tipo: "corretiva", status: "encerrada", inicio: "2026-08-25", local: comum!.id });
    await novaExecucao(o8, u.ana, "2026-09-01T12:00:00Z", "2026-09-01T13:00:00Z", "encerrada");
  });
  after(() => amb.fechar());

  const pedir = (caminho: string, como: UsuarioDeTeste, consulta: Record<string, string> = {}) => amb.esperar(200, "GET", caminho, { como, consulta });

  describe("GET /indicadores/geral", () => {
    it("carteira de agora, resumo do período e pendências", async () => {
      const r = await pedir("/indicadores/geral", u.admin!);
      assert.equal(r.de, "2026-09-16");
      assert.equal(r.ate, "2026-10-15");
      assert.deepEqual(r.carteira, { liberadas: 2, pendentes: 1, em_execucao: 1, atrasadas: 2, criticas: 1, apoio_abertas: 0 });
      assert.deepEqual(r.encerradas, { total: 2, anterior: 1, corretivas: 1, preventivas: 1 });
      assert.deepEqual(r.preventivas, { encerradas: 1, atrasadas_justificadas: 1, atrasadas_sem_justificativa: 1 });
      assert.deepEqual(r.aprs, { total: 5, bloqueadas: 1, anterior: 1, bloqueadas_anterior: 0 });
      assert.deepEqual(r.tempo, { execucoes: 2, tempo_liquido_medio_min: 90 });
      assert.equal(r.interrupcoes, 1);
      assert.deepEqual(r.pendencias, { a_exportar: 2, sem_ciencia: 2, execucoes_esquecidas: 1, atividades_sem_modelo: 1 });
    });

    it("equipe_id e o supervisor limitam tudo à equipe", async () => {
      const doSul = await pedir("/indicadores/geral", u.admin!, { equipe_id: sul });
      assert.deepEqual(doSul.carteira, { liberadas: 1, pendentes: 1, em_execucao: 1, atrasadas: 1, criticas: 1, apoio_abertas: 0 });
      assert.equal(doSul.encerradas.total, 0);
      const doSupervisor = await pedir("/indicadores/geral", u.supervisor!);
      assert.deepEqual(doSupervisor.carteira, { liberadas: 1, pendentes: 0, em_execucao: 0, atrasadas: 1, criticas: 0, apoio_abertas: 0 });
      assert.deepEqual(doSupervisor.encerradas, { total: 2, anterior: 1, corretivas: 1, preventivas: 1 });
      assert.equal(doSupervisor.pendencias.execucoes_esquecidas, 0);
    });
  });

  describe("GET /indicadores/os", () => {
    it("programadas, encerradas por faixa e tipo, preventivas, tempo, interrupções, reprogramações e locais", async () => {
      const r = await pedir("/indicadores/os", u.admin!);
      assert.deepEqual(r.programadas, { total: 5, corretivas: 2, preventivas: 3, canceladas: 1 });
      assert.deepEqual(r.encerradas, { total: 2, anterior: 1, corretivas: 1, preventivas: 1 });
      assert.equal(r.serie.length, 30);
      assert.deepEqual(r.serie.find((p: any) => p.inicio === "2026-10-10"), { inicio: "2026-10-10", fim: "2026-10-11", corretivas: 0, preventivas: 1 });
      assert.deepEqual(r.serie.find((p: any) => p.inicio === "2026-10-12"), { inicio: "2026-10-12", fim: "2026-10-13", corretivas: 1, preventivas: 0 });
      assert.deepEqual(r.tempo, { execucoes: 2, tempo_liquido_medio_min: 90, pausa_media_min: 0, proporcao_pausa: 0 });
      assert.equal(r.interrupcoes.total, 1);
      assert.deepEqual(
        r.interrupcoes.recentes.map((i: any) => [i.os_id, i.motivo, i.executor]),
        [[ids.o6, "Vazamento no local", "Carla Sul"]],
      );
      assert.equal(r.reprogramacoes, 1);
      assert.deepEqual(r.locais.map((l: any) => [l.codigo, l.critico, l.encerradas]), [["ESTAÇÃO/CRÍTICA", true, 1], ["REDE/COMUM", false, 1]]);
    });

    it("mês fechado: setembro só tem a o8", async () => {
      const r = await pedir("/indicadores/os", u.admin!, { periodo: "2026-09" });
      assert.equal(r.serie.length, 30);
      assert.deepEqual(r.encerradas, { total: 1, anterior: 0, corretivas: 1, preventivas: 0 });
    });
  });

  describe("GET /indicadores/equipes", () => {
    it("por equipe e por técnico, com o cadastro para o admin", async () => {
      const r = await pedir("/indicadores/equipes", u.admin!);
      assert.deepEqual(r.totais, { equipes: 2, tecnicos_ativos: 5, tecnicos_com_execucao: 2, execucoes: 2, tempo_liquido_medio_min: 90 });
      assert.deepEqual(r.equipes, [
        {
          id: norte,
          nome: "Equipe Norte",
          supervisor_nome: "Sandra Supervisora",
          tecnicos: 3,
          preventivas: { encerradas: 1, atrasadas_justificadas: 0, atrasadas_sem_justificativa: 1 },
          execucoes: 2,
          tempo_liquido_medio_min: 90,
          pausa_media_min: 0,
          proporcao_pausa: 0,
          aprs: 2,
          aprs_bloqueadas: 0,
          interrompidas: 0,
        },
        {
          id: sul,
          nome: "Equipe Sul",
          supervisor_nome: null,
          tecnicos: 2,
          preventivas: { encerradas: 0, atrasadas_justificadas: 1, atrasadas_sem_justificativa: 0 },
          execucoes: 0,
          tempo_liquido_medio_min: null,
          pausa_media_min: null,
          proporcao_pausa: null,
          aprs: 3,
          aprs_bloqueadas: 1,
          interrompidas: 1,
        },
      ]);
      assert.deepEqual(
        r.tecnicos.map((t: any) => [t.nome, t.execucoes, t.tempo_liquido_medio_min, t.aprs, t.aprs_bloqueadas, t.interrompidas]),
        [
          ["Ana Norte", 1, 120, 1, 0, 0],
          ["Bruno Norte", 1, 60, 1, 0, 0],
          ["Carla Sul", 0, null, 3, 1, 1],
          ["Davi Sul", 0, null, 0, 0, 0],
          ["Sandra Supervisora", 0, null, 0, 0, 0],
        ],
      );
      assert.deepEqual(r.cadastro, {
        ativos_por_perfil: { tecnico: 5, admin: 1 },
        tecnicos_sem_assinatura: 1,
        senha_provisoria: 1,
        sem_equipe: 0,
        inativos: 1,
        equipes_sem_supervisor: 1,
      });
    });

    it("sem cadastro para quem não é admin (o supervisor é um técnico que supervisiona a equipe); o supervisor só vê a própria equipe e seus técnicos", async () => {
      const r = await pedir("/indicadores/equipes", u.supervisor!);
      assert.deepEqual(r.equipes.map((e: any) => e.nome), ["Equipe Norte"]);
      assert.deepEqual(r.tecnicos.map((t: any) => t.nome), ["Ana Norte", "Bruno Norte", "Sandra Supervisora"]);
      assert.equal(r.cadastro, null);
    });

    it("equipe_id filtra equipes, técnicos e o cadastro", async () => {
      const r = await pedir("/indicadores/equipes", u.admin!, { equipe_id: sul });
      assert.deepEqual(r.equipes.map((e: any) => e.nome), ["Equipe Sul"]);
      assert.deepEqual(r.tecnicos.map((t: any) => t.nome), ["Carla Sul", "Davi Sul"]);
      assert.equal(r.cadastro.ativos_por_perfil.tecnico, 2);
      assert.equal(r.cadastro.inativos, 1);
    });
  });

  it("perfis: técnico 403, sem login 401; supervisor pedindo outra equipe 403; período inválido 422", async () => {
    for (const caminho of ["/indicadores/geral", "/indicadores/os", "/indicadores/equipes"]) {
      assert.equal((await amb.req("GET", caminho, { como: u.ana })).status, 403, caminho);
      assert.equal((await amb.req("GET", caminho)).status, 401, caminho);
      assert.equal((await amb.req("GET", caminho, { como: u.supervisor, consulta: { equipe_id: sul } })).status, 403, caminho);
      assert.equal((await amb.req("GET", caminho, { como: u.admin, consulta: { periodo: "ontem" } })).status, 422, caminho);
    }
  });
});
