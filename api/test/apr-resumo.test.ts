import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { apr, aprResposta, atividade, itemModeloApr, localInstalacao, modeloApr, os } from "../src/db/schema";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

/** "Agora" dos testes: 15/10/2026 12:00 em São Paulo (UTC-3); os 30 dias vão de 16/09 a 15/10. */
const AGORA = new Date("2026-10-15T15:00:00Z");
const h = (iso: string) => new Date(iso);

describe("Diagnóstico das APRs (GET /aprs/resumo)", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;
  const usuarios: Record<string, UsuarioDeTeste> = {};
  let equipeA: string;
  let equipeB: string;

  before(async () => {
    amb = await criarAmbiente({ relogio: AGORA });
    equipeA = (await amb.criarEquipe({ nome: "Equipe Norte" })).id;
    equipeB = (await amb.criarEquipe({ nome: "Equipe Sul" })).id;
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeA });
    admin = await amb.criarUsuario({ perfil: "admin" });
    usuarios.admin = await amb.criarUsuario({ perfil: "admin" });
    usuarios.supervisor = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeA, supervisor: true });

    const modelo = async (codigo: string, titulo: string, itens: (typeof itemModeloApr.$inferInsert)[]) => {
      const [m] = await amb.db.insert(modeloApr).values({ codigo, versao: 1, titulo }).returning();
      const criados = await amb.db.insert(itemModeloApr).values(itens.map((i) => ({ ...i, modeloAprId: m!.id }))).returning();
      await amb.db.update(modeloApr).set({ publicadoEm: h("2026-01-01T12:00:00Z") }).where(eq(modeloApr.id, m!.id));
      return { id: m!.id, item: (texto: string) => criados.find((i) => i.texto === texto)!.id };
    };
    const verificacao = (ordem: number, texto: string, respostaBloqueante: "sim" | "nao", tipo: "eliminatorio" | "alerta") =>
      ({ modeloAprId: "", secao: "verificacao", ordem, texto, respostaBloqueante, tipo }) as const;
    const apr03 = await modelo("APR 03", "Operação e manutenção", [
      verificacao(1, "Há EPI adequado?", "nao", "eliminatorio"),
      verificacao(2, "Requer iluminação auxiliar?", "sim", "alerta"),
      verificacao(3, "Há impedimento?", "sim", "eliminatorio"),
    ]);
    const apr05 = await modelo("APR 05", "Conversão de clientes", [verificacao(1, "Medidor lacrado?", "nao", "eliminatorio")]);

    // A OS da Equipe Norte tem a atividade ligada ao modelo; a da Equipe Sul, não (o técnico escolheu).
    await amb.db.insert(atividade).values({ codigo: "8.7.1", descricao: "Drenagem", modeloAprCodigo: "APR 03" });
    const [local] = await amb.db.insert(localInstalacao).values({ codigo: "VILA VELHA/REDE" }).returning();
    const novaOs = async (equipeId: string, codigoAtividade: string | null) =>
      (await amb.db.insert(os).values({ numeroOrdem: randomUUID().slice(0, 8), tipo: "preventiva", titulo: "OS", localInstalacaoId: local!.id, equipeId, dataInicioProg: "2026-10-01", origem: "sap", codigoAtividade }).returning())[0]!.id;
    const osNorte = await novaOs(equipeA, "8.7.1");
    const osSul = await novaOs(equipeB, null);

    const criarApr = async (osId: string, m: { id: string; item: (t: string) => string }, resultado: "aprovada" | "bloqueada", quando: string, respostas: Record<string, "sim" | "nao" | "na"> = {}) => {
      const id = randomUUID();
      await amb.db.insert(apr).values({ id, osId, modeloAprId: m.id, preenchidaPor: tecnico.id, resultado, concluidaEm: h(quando) });
      const linhas = Object.entries(respostas).map(([texto, resposta]) => ({ aprId: id, itemId: m.item(texto), resposta, observacao: resposta === "na" ? "Não se aplica" : null, respondidaEm: h(quando) }));
      if (linhas.length) await amb.db.insert(aprResposta).values(linhas);
    };
    await criarApr(osNorte, apr03, "aprovada", "2026-10-15T12:00:00Z", { "Há EPI adequado?": "sim", "Requer iluminação auxiliar?": "sim", "Há impedimento?": "nao" });
    await criarApr(osNorte, apr03, "bloqueada", "2026-10-14T12:00:00Z", { "Há EPI adequado?": "nao", "Requer iluminação auxiliar?": "nao", "Há impedimento?": "nao" });
    await criarApr(osSul, apr05, "bloqueada", "2026-10-10T12:00:00Z", { "Medidor lacrado?": "nao" });
    await criarApr(osSul, apr03, "bloqueada", "2026-10-14T13:00:00Z", { "Há EPI adequado?": "nao", "Requer iluminação auxiliar?": "sim", "Há impedimento?": "sim" });
    // NA nunca é a resposta que o modelo marca
    await criarApr(osNorte, apr03, "aprovada", "2026-10-13T12:00:00Z", { "Há EPI adequado?": "sim", "Requer iluminação auxiliar?": "na", "Há impedimento?": "nao" });
    // Virada do dia no fuso de São Paulo: 00:30 de 16/09 entra no período; 23:30 de 15/09 fica no anterior.
    await criarApr(osNorte, apr03, "aprovada", "2026-09-16T03:30:00Z");
    await criarApr(osNorte, apr03, "aprovada", "2026-09-16T02:30:00Z");
    await criarApr(osNorte, apr03, "bloqueada", "2026-09-01T12:00:00Z");
  });
  after(() => amb.fechar());

  const resumo = (consulta: Record<string, string> = {}, como = admin) => amb.esperar(200, "GET", "/aprs/resumo", { como, consulta });

  it("30 dias por padrão: totais, comparação com o período anterior e a série por dia", async () => {
    const r = await resumo();
    assert.equal(r.periodo, "30d");
    assert.equal(r.agrupamento, "dia");
    assert.equal(r.de, "2026-09-16");
    assert.equal(r.ate, "2026-10-15");
    assert.deepEqual(r.totais, { aprs: 6, aprovadas: 3, bloqueadas: 3, alertas: 2, sem_modelo_ligado: 2 });
    assert.deepEqual(r.anterior, { aprs: 2, bloqueadas: 1 });
    assert.equal(r.serie.length, 30);
    const doDia = (d: string) => r.serie.find((p: any) => p.inicio === d);
    assert.deepEqual(doDia("2026-09-16"), { inicio: "2026-09-16", fim: "2026-09-17", aprovadas: 1, bloqueadas: 0 });
    assert.deepEqual(doDia("2026-10-14"), { inicio: "2026-10-14", fim: "2026-10-15", aprovadas: 0, bloqueadas: 2 });
    assert.deepEqual(doDia("2026-10-15"), { inicio: "2026-10-15", fim: "2026-10-16", aprovadas: 1, bloqueadas: 0 });
  });

  it("itens que mais bloqueiam e alertas mais registrados: só a resposta que o modelo marca conta", async () => {
    const r = await resumo();
    assert.deepEqual(r.itens_que_bloqueiam, [
      { modelo: "APR 03", texto: "Há EPI adequado?", secao: "verificacao", total: 2 },
      { modelo: "APR 03", texto: "Há impedimento?", secao: "verificacao", total: 1 },
      { modelo: "APR 05", texto: "Medidor lacrado?", secao: "verificacao", total: 1 },
    ]);
    assert.deepEqual(r.alertas_registrados, [{ modelo: "APR 03", texto: "Requer iluminação auxiliar?", secao: "verificacao", total: 2 }]);
  });

  it("APRs por modelo e por equipe, da que tem mais APRs à que tem menos", async () => {
    const r = await resumo();
    assert.deepEqual(r.por_modelo, [
      { codigo: "APR 03", titulo: "Operação e manutenção", aprs: 5, bloqueadas: 2 },
      { codigo: "APR 05", titulo: "Conversão de clientes", aprs: 1, bloqueadas: 1 },
    ]);
    assert.deepEqual(r.por_equipe, [
      { id: equipeA, nome: "Equipe Norte", aprs: 4, bloqueadas: 1 },
      { id: equipeB, nome: "Equipe Sul", aprs: 2, bloqueadas: 2 },
    ]);
  });

  it("7 dias, 90 dias (semanas) e 12 meses mudam a faixa e o agrupamento", async () => {
    const sete = await resumo({ periodo: "7d" });
    assert.equal(sete.de, "2026-10-09");
    assert.equal(sete.serie.length, 7);
    assert.equal(sete.totais.aprs, 5);
    const noventa = await resumo({ periodo: "90d" });
    assert.equal(noventa.agrupamento, "semana");
    assert.equal(noventa.serie.length, 13);
    const doze = await resumo({ periodo: "12m" });
    assert.equal(doze.agrupamento, "mes");
    assert.equal(doze.serie.length, 12);
    assert.equal(doze.totais.aprs, 8);
  });

  it("mês fechado: um ponto por dia do mês, comparado com o mês anterior; mês passado vai até o último dia", async () => {
    const outubro = await resumo({ periodo: "2026-10" });
    assert.equal(outubro.agrupamento, "dia");
    assert.equal(outubro.de, "2026-10-01");
    assert.equal(outubro.ate, "2026-10-15", "o mês corrente vai até hoje");
    assert.equal(outubro.serie.length, 31);
    assert.deepEqual(outubro.totais, { aprs: 5, aprovadas: 2, bloqueadas: 3, alertas: 2, sem_modelo_ligado: 2 });
    assert.deepEqual(outubro.anterior, { aprs: 3, bloqueadas: 1 }, "setembro inteiro, inclusive 23:30 de 15/09 em São Paulo");
    const setembro = await resumo({ periodo: "2026-09" });
    assert.equal(setembro.ate, "2026-09-30");
    assert.equal(setembro.serie.length, 30);
    assert.equal(setembro.totais.aprs, 3);
  });

  it("equipe_id filtra pela equipe da OS", async () => {
    const sul = await resumo({ equipe_id: equipeB });
    assert.deepEqual(sul.totais, { aprs: 2, aprovadas: 0, bloqueadas: 2, alertas: 1, sem_modelo_ligado: 2 });
    assert.deepEqual(sul.por_equipe.map((e: any) => e.nome), ["Equipe Sul"]);
  });

  it("toda a gestão vê; o supervisor só a própria equipe (outra é 403); técnico 403; período inválido 422", async () => {
    await resumo({}, usuarios.admin);
    const doSupervisor = await resumo({}, usuarios.supervisor);
    assert.equal(doSupervisor.totais.aprs, 4);
    assert.deepEqual(doSupervisor.por_equipe.map((e: any) => e.nome), ["Equipe Norte"]);
    assert.equal((await amb.req("GET", "/aprs/resumo", { como: usuarios.supervisor, consulta: { equipe_id: equipeB } })).status, 403);
    assert.equal((await amb.req("GET", "/aprs/resumo", { como: tecnico })).status, 403);
    assert.equal((await amb.req("GET", "/aprs/resumo")).status, 401);
    for (const periodo of ["1a", "2026-13", "2026-1"]) {
      assert.equal((await amb.req("GET", "/aprs/resumo", { como: admin, consulta: { periodo } })).status, 422, periodo);
    }
  });
});
