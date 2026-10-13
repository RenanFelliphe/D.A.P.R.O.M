import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import ExcelJS from "exceljs";
import { and, eq } from "drizzle-orm";
import { alerta, auditoria, execucao, localInstalacao, os, planoPreventiva } from "../src/db/schema";
import { processarOrdens } from "../src/dominio/importacao-ordens";
import { lerPlanilha } from "../src/dominio/importacao-planilha";
import { descreverIntervalo, diasEntre, lerIntervalo, somarIntervalo, verificarCiclos } from "../src/dominio/preventivas";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";
import { criarOs } from "./fixture-os";

describe("Intervalo entre ciclos: cálculo", () => {
  it("entende o intervalo em texto, como o SAP e a planilha trazem", () => {
    assert.deepEqual(lerIntervalo("3 MES"), { quantidade: 3, unidade: "mes" });
    assert.deepEqual(lerIntervalo("3 meses"), { quantidade: 3, unidade: "mes" });
    assert.deepEqual(lerIntervalo("Trimestral"), { quantidade: 1, unidade: "trimestre" });
    assert.deepEqual(lerIntervalo("a cada 2 semanas"), { quantidade: 2, unidade: "semana" });
    assert.deepEqual(lerIntervalo("15 dias"), { quantidade: 15, unidade: "dia" });
    assert.deepEqual(lerIntervalo("quinzenal"), { quantidade: 1, unidade: "quinzena" });
    assert.deepEqual(lerIntervalo("1 JAH"), { quantidade: 1, unidade: "ano" });
    assert.deepEqual(lerIntervalo("mês"), { quantidade: 1, unidade: "mes" });
    assert.deepEqual(lerIntervalo({ quantidade: 6, unidade: "semestre" }), { quantidade: 6, unidade: "semestre" });
    assert.equal(lerIntervalo(""), null);
    assert.equal(lerIntervalo(null), null);
    assert.equal(lerIntervalo("30"), undefined);
    assert.equal(lerIntervalo("m"), undefined);
    assert.equal(lerIntervalo("quando der"), undefined);
    assert.equal(lerIntervalo({ quantidade: 0, unidade: "dia" }), undefined);
  });

  it("soma meses de calendário sem pular o fim do mês", () => {
    assert.equal(somarIntervalo("2026-01-31", { quantidade: 1, unidade: "mes" }), "2026-02-28");
    assert.equal(somarIntervalo("2028-01-31", { quantidade: 1, unidade: "mes" }), "2028-02-29");
    assert.equal(somarIntervalo("2026-01-31", { quantidade: 1, unidade: "mes" }, 2), "2026-03-31");
    assert.equal(somarIntervalo("2026-11-15", { quantidade: 1, unidade: "trimestre" }), "2027-02-15");
    assert.equal(somarIntervalo("2026-10-13", { quantidade: 1, unidade: "quinzena" }), "2026-10-28");
    assert.equal(somarIntervalo("2026-10-13", { quantidade: 2, unidade: "semana" }), "2026-10-27");
    assert.equal(somarIntervalo("2026-10-13", { quantidade: 1, unidade: "ano" }), "2027-10-13");
    assert.equal(diasEntre("2026-10-13", "2026-10-20"), 7);
    assert.equal(diasEntre("2026-10-20", "2026-10-13"), -7);
    assert.equal(descreverIntervalo({ quantidade: 1, unidade: "mes" }), "mensal");
    assert.equal(descreverIntervalo({ quantidade: 3, unidade: "mes" }), "a cada 3 meses");
  });
});

describe("Intervalo entre ciclos das preventivas", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let supervisor: UsuarioDeTeste;
  let tecnicoDeOutra: UsuarioDeTeste;
  let equipeId: string;
  let localId: string;
  const CT = "PROT_CAT";

  before(async () => {
    // Hoje é 13/10/2026 em São Paulo.
    amb = await criarAmbiente({ relogio: new Date("2026-10-13T15:00:00Z") });
    admin = await amb.criarUsuario({ perfil: "admin" });
    equipeId = (await amb.criarEquipe({ centroTrabalho: CT })).id;
    supervisor = await amb.criarUsuario({ perfil: "tecnico", equipeId, supervisor: true });
    const outra = (await amb.criarEquipe()).id;
    tecnicoDeOutra = await amb.criarUsuario({ perfil: "tecnico", equipeId: outra });
    [{ id: localId }] = (await amb.db.insert(localInstalacao).values({ codigo: "CARIACICA/ERP" }).returning({ id: localInstalacao.id })) as [{ id: string }];
  });
  after(() => amb.fechar());

  /** Uma OS preventiva do plano, direto na tabela. */
  async function osDoPlano(d: { plano: string; item?: string | null; inicio: string; status?: "liberada" | "pendente" | "encerrada" | "cancelada"; titulo?: string }) {
    const [o] = await amb.db
      .insert(os)
      .values({
        numeroOrdem: `49${Math.floor(Math.random() * 1e6)}`,
        tipo: "preventiva",
        titulo: d.titulo ?? `Preventiva do plano ${d.plano}`,
        localInstalacaoId: localId,
        equipeId,
        planoManutencao: d.plano,
        itemManutencao: d.item === undefined ? "1" : d.item,
        dataInicioProg: d.inicio,
        status: d.status ?? "liberada",
        origem: "sap",
      })
      .returning();
    return o!;
  }

  async function plano(codigo: string, intervalo: { quantidade: number; unidade: "dia" | "semana" | "mes" | "trimestre" } | null, extra: Partial<typeof planoPreventiva.$inferInsert> = {}) {
    const [p] = await amb.db
      .insert(planoPreventiva)
      .values({ planoManutencao: codigo, itemManutencao: "1", intervaloQuantidade: intervalo?.quantidade ?? null, intervaloUnidade: intervalo?.unidade ?? null, ...extra })
      .returning();
    return p!;
  }

  const listar = (como: UsuarioDeTeste, consulta: Record<string, string> = {}) => amb.esperar(200, "GET", "/preventivas", { como, consulta });
  const doPlano = (lista: { planos: { id: string }[] }, id: string) => lista.planos.find((p) => p.id === id) as any;

  describe("situação do ciclo", () => {
    let proximo: { id: string };
    let vencido: { id: string };
    let emDia: { id: string };
    let aguardando: { id: string };
    let semIntervalo: { id: string };
    let porExecucao: { id: string };

    before(async () => {
      proximo = await plano("P-PROX", { quantidade: 1, unidade: "mes" }, { contarAPartir: "programacao" });
      await osDoPlano({ plano: "P-PROX", inicio: "2026-08-20", status: "encerrada" });
      await osDoPlano({ plano: "P-PROX", inicio: "2026-09-20", status: "encerrada", titulo: "Inspeção de retificador" });
      // Cancelada não conta como ciclo.
      await osDoPlano({ plano: "P-PROX", inicio: "2026-10-01", status: "cancelada" });

      vencido = await plano("P-VENC", { quantidade: 1, unidade: "mes" }, { contarAPartir: "programacao" });
      await osDoPlano({ plano: "P-VENC", inicio: "2026-08-01", status: "encerrada" });

      emDia = await plano("P-DIA", { quantidade: 1, unidade: "trimestre" }, { contarAPartir: "programacao" });
      await osDoPlano({ plano: "P-DIA", inicio: "2026-10-01" });

      aguardando = await plano("P-AGU", { quantidade: 1, unidade: "mes" });
      await osDoPlano({ plano: "P-AGU", inicio: "2026-10-10" });

      semIntervalo = await plano("P-SEM", null);
      await osDoPlano({ plano: "P-SEM", inicio: "2026-10-05" });

      // Contando da execução: encerrada em 09/10 (São Paulo), semanal → vence 16/10.
      porExecucao = await plano("P-EXE", { quantidade: 1, unidade: "semana" });
      const enc = await criarOs(amb, { equipeId, encerrada: true });
      await amb.db.update(os).set({ tipo: "preventiva", planoManutencao: "P-EXE", itemManutencao: "1", dataInicioProg: "2026-10-08", dataFimProg: null }).where(eq(os.id, enc.osId));
    });

    it("conta os dias até o próximo ciclo e ordena pelo que pede ação", async () => {
      const r = await listar(admin);
      assert.equal(r.hoje, "2026-10-13");

      const p = doPlano(r, proximo.id);
      assert.equal(p.situacao, "proximo");
      assert.equal(p.referencia, "2026-09-20");
      assert.equal(p.proximo_ciclo, "2026-10-20");
      assert.equal(p.dias_restantes, 7);
      assert.equal(p.total_ciclos, 2);
      assert.equal(p.titulo, "Inspeção de retificador");
      assert.equal(p.intervalo_descricao, "mensal");
      assert.equal(p.pode_editar, true);

      const v = doPlano(r, vencido.id);
      assert.equal(v.situacao, "vencido");
      assert.equal(v.proximo_ciclo, "2026-09-01");
      assert.equal(v.dias_restantes, -42);
      assert.ok(v.progresso > 1);

      assert.equal(doPlano(r, emDia.id).situacao, "em_dia");
      assert.equal(doPlano(r, emDia.id).proximo_ciclo, "2027-01-01");

      const a = doPlano(r, aguardando.id);
      assert.equal(a.situacao, "aguardando_execucao");
      assert.equal(a.proximo_ciclo, null);
      assert.equal(a.os_abertas, 1);

      assert.equal(doPlano(r, semIntervalo.id).situacao, "sem_intervalo");

      const e = doPlano(r, porExecucao.id);
      assert.equal(e.referencia, "2026-10-09");
      assert.equal(e.proximo_ciclo, "2026-10-16");
      assert.equal(e.situacao, "proximo");

      // Vencidos primeiro, depois os próximos (o que vence antes primeiro).
      const ordem = r.planos.map((x: { id: string }) => x.id);
      assert.ok(ordem.indexOf(vencido.id) < ordem.indexOf(porExecucao.id));
      assert.ok(ordem.indexOf(porExecucao.id) < ordem.indexOf(proximo.id));
      assert.ok(ordem.indexOf(proximo.id) < ordem.indexOf(aguardando.id));
      assert.ok(ordem.indexOf(aguardando.id) < ordem.indexOf(emDia.id));

      assert.ok(r.contagem.vencido >= 1 && r.contagem.proximo >= 2 && r.contagem.sem_intervalo >= 1);
    });

    it("filtra por situação sem mudar a contagem, e busca pelo plano", async () => {
      const r = await listar(admin, { situacao: "vencido" });
      assert.ok(r.planos.every((p: { situacao: string }) => p.situacao === "vencido"));
      assert.ok(r.contagem.em_dia >= 1);
      const busca = await listar(admin, { busca: "p-agu" });
      assert.deepEqual(busca.planos.map((p: { id: string }) => p.id), [aguardando.id]);
    });

    it("cada um vê só os planos das próprias equipes", async () => {
      assert.ok(doPlano(await listar(supervisor), proximo.id));
      const outra = await listar(tecnicoDeOutra);
      assert.equal(doPlano(outra, proximo.id), undefined);
      assert.equal(outra.contagem.total, 0);
      assert.equal((await amb.req("GET", `/preventivas/${proximo.id}`, { como: tecnicoDeOutra })).status, 404);
    });

    it("o detalhe traz os ciclos, as próximas datas e o cumprimento", async () => {
      const d = await amb.esperar(200, "GET", `/preventivas/${proximo.id}`, { como: admin });
      assert.equal(d.ciclos.length, 2);
      assert.equal(d.ciclos[0].data_inicio_prog, "2026-09-20");
      assert.equal(d.ciclos[0].previsto, "2026-09-20");
      assert.deepEqual(d.proximas_datas.slice(0, 3), ["2026-10-20", "2026-11-20", "2026-12-20"]);
      assert.equal(d.proximas_datas.length, 6);
      assert.equal(d.estatisticas.intervalo_definido_dias, 30);
    });

    it("o detalhe da OS mostra o plano dela", async () => {
      const [ultima] = await amb.db.select({ id: os.id }).from(os).where(and(eq(os.planoManutencao, "P-PROX"), eq(os.dataInicioProg, "2026-09-20")));
      const p = await amb.esperar(200, "GET", `/os/${ultima!.id}/preventiva`, { como: supervisor });
      assert.equal(p.id, proximo.id);
      assert.equal(p.eh_ultima_do_plano, true);
      const corretiva = await criarOs(amb, { equipeId });
      assert.equal((await amb.req("GET", `/os/${corretiva.osId}/preventiva`, { como: admin })).status, 404);
    });

    it("avisa uma vez por vencimento: ciclo próximo e ciclo vencido, para o supervisor da equipe", async () => {
      const criados = await verificarCiclos(amb.db, amb.relogio.agora);
      assert.ok(criados >= 3);
      const doSupervisor = await amb.db.select().from(alerta).where(eq(alerta.destinatarioId, supervisor.id));
      const vencida = doSupervisor.find((a) => a.planoPreventivaId === vencido.id)!;
      assert.equal(vencida.tipo, "preventiva_vencida");
      assert.match(vencida.detalhe, /venceu em 01\/09\/2026 \(há 42 dias\)/);
      assert.ok(vencida.osId);
      const prox = doSupervisor.find((a) => a.planoPreventivaId === proximo.id)!;
      assert.equal(prox.tipo, "preventiva_proxima");
      assert.match(prox.detalhe, /vence em 20\/10\/2026, daqui a 7 dias/);
      // Sem intervalo, aguardando execução ou em dia: nada.
      assert.equal(doSupervisor.filter((a) => [semIntervalo.id, aguardando.id, emDia.id].includes(a.planoPreventivaId!)).length, 0);

      assert.equal(await verificarCiclos(amb.db, amb.relogio.agora), 0);

      // O ciclo próximo que vence passa a pedir o alerta de vencido (uma vez).
      const dia21 = new Date("2026-10-21T15:00:00Z");
      await verificarCiclos(amb.db, dia21, [proximo.id]);
      assert.equal(await verificarCiclos(amb.db, dia21, [proximo.id]), 0);
      const tipos = (await amb.db.select({ tipo: alerta.tipo }).from(alerta).where(eq(alerta.planoPreventivaId, proximo.id))).map((a) => a.tipo);
      assert.deepEqual(tipos.sort(), ["preventiva_proxima", "preventiva_vencida"]);

      // A OS do ciclo seguinte chega do SAP: a contagem recomeça e nenhum alerta novo sai.
      await osDoPlano({ plano: "P-PROX", inicio: "2026-10-20" });
      const r = await listar(admin);
      assert.equal(doPlano(r, proximo.id).proximo_ciclo, "2026-11-20");
      assert.equal(await verificarCiclos(amb.db, dia21, [proximo.id]), 0);

      const lista = await amb.esperar(200, "GET", "/alertas", { como: supervisor, consulta: { tipo: "preventiva_vencida" } });
      assert.ok(lista.alertas.some((a: { plano_preventiva_id: string }) => a.plano_preventiva_id === vencido.id));
    });
  });

  describe("definição do intervalo", () => {
    let p: { id: string };

    before(async () => {
      p = await plano("P-EDIT", null);
      await osDoPlano({ plano: "P-EDIT", inicio: "2026-10-01", titulo: "Lavagem da estação" });
    });

    it("o admin e o supervisor da equipe definem; o técnico não", async () => {
      assert.equal((await amb.req("PUT", `/preventivas/${p.id}`, { como: tecnicoDeOutra, json: { intervalo: { quantidade: 1, unidade: "mes" } } })).status, 403);
      const r = await amb.esperar(200, "PUT", `/preventivas/${p.id}`, {
        como: supervisor,
        json: { intervalo: { quantidade: 2, unidade: "semana" }, base_do_ciclo: "programacao", antecedencia_dias: 3 },
      });
      assert.equal(r.plano.intervalo_descricao, "a cada 2 semanas");
      assert.equal(r.plano.proximo_ciclo, "2026-10-15");
      assert.equal(r.plano.situacao, "proximo");
      // O vencimento novo, dentro da antecedência, já avisa.
      const [aviso] = await amb.db.select().from(alerta).where(eq(alerta.planoPreventivaId, p.id));
      assert.equal(aviso?.tipo, "preventiva_proxima");

      const [registro] = await amb.db.select().from(auditoria).where(and(eq(auditoria.entidade, "plano_preventiva"), eq(auditoria.entidadeId, p.id)));
      assert.equal(registro?.acao, "plano_preventiva.editar");
    });

    it("valida o intervalo e pausa o ciclo", async () => {
      const r = await amb.req("PUT", `/preventivas/${p.id}`, { como: admin, json: { intervalo: { quantidade: 0, unidade: "mes" } } });
      assert.equal(r.status, 422);
      assert.equal((await amb.req("PUT", `/preventivas/${p.id}`, { como: admin, json: { intervalo: { quantidade: 1, unidade: "decada" } } })).status, 422);
      const pausado = await amb.esperar(200, "PUT", `/preventivas/${p.id}`, { como: admin, json: { ativo: false, observacao: "Equipamento fora de operação" } });
      assert.equal(pausado.plano.situacao, "pausado");
      assert.equal(pausado.plano.observacao, "Equipamento fora de operação");
      assert.deepEqual(pausado.proximas_datas, []);
      const acoes = (await amb.db.select({ acao: auditoria.acao }).from(auditoria).where(eq(auditoria.entidadeId, p.id))).map((a) => a.acao);
      assert.ok(acoes.includes("plano_preventiva.editar"));
      const semIntervalo = await amb.esperar(200, "PUT", `/preventivas/${p.id}`, { como: admin, json: { intervalo: null, ativo: true } });
      assert.equal(semIntervalo.plano.situacao, "sem_intervalo");
    });

    it("plano inexistente é 404", async () => {
      assert.equal((await amb.req("GET", `/preventivas/${randomUUID()}`, { como: admin })).status, 404);
      assert.equal((await amb.req("PUT", `/preventivas/${randomUUID()}`, { como: admin, json: { ativo: false } })).status, 404);
    });
  });

  describe("importação", () => {
    const ordem = (numero: string, extra: Record<string, unknown> = {}) => ({
      numero_ordem: numero,
      tipo_ordem: "YBA2",
      titulo: "Inspeção funcional de retificador",
      centro_trabalho: CT,
      local_instalacao: { codigo: "SERRA/RET-12" },
      data_inicio_prog: "2026-10-13",
      status_sap: "LIB",
      plano_manutencao: "10573",
      item_manutencao: "10603",
      ...extra,
    });
    const doPlanoImportado = async () =>
      (await amb.db.select().from(planoPreventiva).where(and(eq(planoPreventiva.planoManutencao, "10573"), eq(planoPreventiva.itemManutencao, "10603"))))[0];

    it("a primeira OS do plano cria o plano; sem intervalo, a importação avisa", async () => {
      const r = await processarOrdens(amb.db, [{ ordem: ordem("4019821") }], { origem: "sap", agora: amb.relogio.agora });
      assert.equal(r.criadas, 1);
      const p = await doPlanoImportado();
      assert.ok(p);
      assert.equal(p!.intervaloQuantidade, null);
      assert.deepEqual(r.planos, [p!.id]);
      assert.deepEqual(
        r.planosSemIntervalo.map((x) => [x.planoManutencao, x.itemManutencao, x.numeroOrdem]),
        [["10573", "10603", "4019821"]],
      );
    });

    it("o intervalo que vem na ordem é gravado no plano; o que não dá para entender vira aviso", async () => {
      const r = await processarOrdens(amb.db, [{ ordem: ordem("4019821", { intervalo_ciclo: "3 MES" }) }], { origem: "sap", agora: amb.relogio.agora });
      assert.equal(r.atualizadas, 1);
      assert.deepEqual(r.planosSemIntervalo, []);
      let p = await doPlanoImportado();
      assert.deepEqual([p!.intervaloQuantidade, p!.intervaloUnidade], [3, "mes"]);

      const ruim = await processarOrdens(amb.db, [{ ordem: ordem("4019899", { intervalo_ciclo: "sempre que der" }) }], { origem: "sap", agora: amb.relogio.agora });
      assert.equal(ruim.criadas, 1);
      assert.match(ruim.avisos.map((a) => a.motivo).join(" "), /Intervalo entre ciclos não reconhecido/);
      p = await doPlanoImportado();
      assert.deepEqual([p!.intervaloQuantidade, p!.intervaloUnidade], [3, "mes"]);
      // Sem o campo, o intervalo fica como está.
      await processarOrdens(amb.db, [{ ordem: ordem("4019899") }], { origem: "sap", agora: amb.relogio.agora });
      assert.equal((await doPlanoImportado())!.intervaloQuantidade, 3);
    });

    it("a corretiva com plano não vira ciclo", async () => {
      const r = await processarOrdens(amb.db, [{ ordem: ordem("4023470", { tipo_ordem: "YBA1", plano_manutencao: "99999" }) }], { origem: "sap", agora: amb.relogio.agora });
      assert.equal(r.criadas, 1);
      assert.deepEqual(r.planos, []);
      assert.equal((await amb.db.select().from(planoPreventiva).where(eq(planoPreventiva.planoManutencao, "99999"))).length, 0);
    });

    it("a planilha lê a coluna do intervalo", async () => {
      const livro = new ExcelJS.Workbook();
      const aba = livro.addWorksheet("Ordens");
      aba.addRow(["Ordem", "Tipo", "Centro de trabalho", "Local", "Início programado", "Título", "Plano", "Item", "Periodicidade"]);
      aba.addRow(["4031201", "Preventiva", CT, "SERRA/ERP", "2026-10-20", "Lavagem da estação", "10580", "10622", "Mensal"]);
      aba.addRow(["4031202", "Preventiva", CT, "SERRA/ERP", "2026-10-20", "Sem intervalo", "10581", "", ""]);
      const { entradas } = await lerPlanilha(new Uint8Array(await livro.xlsx.writeBuffer()));
      assert.equal((entradas[0]!.ordem as any).intervalo_ciclo, "Mensal");
      assert.equal((entradas[1]!.ordem as any).intervalo_ciclo, undefined);
      const r = await processarOrdens(amb.db, entradas, { origem: "planilha", agora: amb.relogio.agora });
      assert.equal(r.criadas, 2);
      const [mensal] = await amb.db.select().from(planoPreventiva).where(eq(planoPreventiva.planoManutencao, "10580"));
      assert.deepEqual([mensal!.intervaloQuantidade, mensal!.intervaloUnidade], [1, "mes"]);
      assert.deepEqual(r.planosSemIntervalo.map((x) => [x.planoManutencao, x.itemManutencao]), [["10581", null]]);
    });
  });
});

/** Uso do `execucao` para o encerramento: confere que o fixture mantém o dia esperado. */
describe("Intervalo entre ciclos: referência do encerramento", () => {
  it("o dia do encerramento é o de São Paulo", async () => {
    const amb = await criarAmbiente({ relogio: new Date("2026-10-13T15:00:00Z") });
    try {
      const equipeId = (await amb.criarEquipe()).id;
      const admin = await amb.criarUsuario({ perfil: "admin" });
      const enc = await criarOs(amb, { equipeId, encerrada: true });
      // Encerrada às 01:30 UTC de 10/10 = 22:30 de 09/10 em São Paulo.
      await amb.db.update(execucao).set({ fim: new Date("2026-10-10T01:30:00Z") }).where(eq(execucao.id, enc.execId));
      await amb.db.update(os).set({ tipo: "preventiva", planoManutencao: "FUSO", dataInicioProg: "2026-10-09", dataFimProg: null }).where(eq(os.id, enc.osId));
      await amb.db.insert(planoPreventiva).values({ planoManutencao: "FUSO", intervaloQuantidade: 10, intervaloUnidade: "dia" });
      const r = await amb.esperar(200, "GET", "/preventivas", { como: admin });
      assert.equal(r.planos[0].referencia, "2026-10-09");
      assert.equal(r.planos[0].proximo_ciclo, "2026-10-19");
    } finally {
      await amb.fechar();
    }
  });
});
