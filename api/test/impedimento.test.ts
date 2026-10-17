import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { alerta, localInstalacao, os, reprogramacao, type AlertaTipo, type OsStatus } from "../src/db/schema";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

const ID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";

describe("Impedimento: reprogramar, cancelar OS de apoio e alertas", () => {
  let amb: Ambiente;
  let equipeA: string;
  let equipeB: string;
  let localId: string;
  /** OS lida do SAP que as OS de apoio destes testes destravam. */
  let osOrigemId: string;
  let supervisorA: UsuarioDeTeste;
  let supervisorB: UsuarioDeTeste;
  let admin: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;
  let contador = 0;

  before(async () => {
    amb = await criarAmbiente({ relogio: new Date("2026-10-11T12:00:00Z") });
    equipeA = (await amb.criarEquipe()).id;
    equipeB = (await amb.criarEquipe()).id;
    supervisorA = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeA, supervisor: true });
    supervisorB = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeB, supervisor: true });
    admin = await amb.criarUsuario({ perfil: "admin" });
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeA });
    const [local] = await amb.db.insert(localInstalacao).values({ codigo: "LOCAL/TESTE" }).returning({ id: localInstalacao.id });
    localId = local!.id;
    const [origem] = await amb.db
      .insert(os)
      .values({ numeroOrdem: "3999999", tipo: "corretiva", titulo: "OS de origem", localInstalacaoId: localId, equipeId: equipeA, dataInicioProg: "2026-10-20", origem: "sap" })
      .returning({ id: os.id });
    osOrigemId = origem!.id;
  });
  after(() => amb.fechar());

  async function criarOs(o: { equipeId?: string; status?: OsStatus; origem?: "sap" | "apoio"; inicio?: string; fim?: string | null } = {}) {
    contador++;
    const origem = o.origem ?? "apoio";
    const [linha] = await amb.db
      .insert(os)
      .values({
        numeroOrdem: origem === "apoio" ? null : `4000${contador}`,
        tipo: "corretiva",
        titulo: `OS de teste ${contador}`,
        localInstalacaoId: localId,
        equipeId: o.equipeId ?? equipeA,
        dataInicioProg: o.inicio ?? "2026-10-20",
        dataFimProg: o.fim === undefined ? null : o.fim,
        status: o.status ?? "liberada",
        origem,
        osOrigemId: origem === "apoio" ? osOrigemId : null,
      })
      .returning();
    return linha!;
  }

  async function criarAlerta(osId: string, destinatarioId: string, tipo: AlertaTipo = "bloqueio", criadoEm?: Date) {
    const [a] = await amb.db
      .insert(alerta)
      .values({ tipo, osId, destinatarioId, detalhe: "detalhe do alerta", ...(criadoEm && { criadoEm }) })
      .returning();
    return a!;
  }

  const lerOs = async (id: string) => (await amb.db.select().from(os).where(eq(os.id, id)))[0]!;
  const lerAlerta = async (id: string) => (await amb.db.select().from(alerta).where(eq(alerta.id, id)))[0]!;
  const historico = (id: string) => amb.db.select().from(reprogramacao).where(eq(reprogramacao.osId, id));

  describe("POST /os/:id/reprogramar", () => {
    it("supervisor reprograma a OS da própria equipe: muda as datas, mantém a duração e o status, e grava o histórico", async () => {
      const o = await criarOs({ status: "pendente", inicio: "2026-10-20", fim: "2026-10-22" });
      const r = await amb.esperar(200, "POST", `/os/${o.id}/reprogramar`, {
        como: supervisorA,
        json: { data_inicio_prog: "2026-11-01", justificativa: "  Aguardando drenagem  " },
      });
      assert.deepEqual(r, { id: o.id, status: "pendente" });

      const depois = await lerOs(o.id);
      assert.equal(depois.dataInicioProg, "2026-11-01");
      assert.equal(depois.dataFimProg, "2026-11-03");
      assert.equal(depois.equipeId, equipeA);
      assert.equal(depois.status, "pendente");

      const [h, ...resto] = await historico(o.id);
      assert.equal(resto.length, 0);
      assert.equal(h!.dataAnterior, "2026-10-20");
      assert.equal(h!.dataNova, "2026-11-01");
      assert.equal(h!.equipeAnteriorId, equipeA);
      assert.equal(h!.equipeNovaId, equipeA);
      assert.equal(h!.justificativa, "Aguardando drenagem");
      assert.equal(h!.usuarioId, supervisorA.id);
      assert.equal(h!.assinaturaPath, await amb.assinaturaDe(supervisorA));
    });

    it("data fim nula continua nula e antecipar a data desloca o fim para trás", async () => {
      const semFim = await criarOs({ inicio: "2026-10-20", fim: null });
      await amb.esperar(200, "POST", `/os/${semFim.id}/reprogramar`, { como: admin, json: { data_inicio_prog: "2026-10-15", justificativa: "Antecipada" } });
      const a = await lerOs(semFim.id);
      assert.equal(a.dataInicioProg, "2026-10-15");
      assert.equal(a.dataFimProg, null);

      const comFim = await criarOs({ inicio: "2026-03-01", fim: "2026-03-05" });
      await amb.esperar(200, "POST", `/os/${comFim.id}/reprogramar`, { como: admin, json: { data_inicio_prog: "2026-02-27", justificativa: "Antecipada" } });
      const b = await lerOs(comFim.id);
      assert.equal(b.dataInicioProg, "2026-02-27");
      assert.equal(b.dataFimProg, "2026-03-03");
    });

    it("supervisor pode passar a OS da própria equipe para outra equipe", async () => {
      const o = await criarOs();
      await amb.esperar(200, "POST", `/os/${o.id}/reprogramar`, {
        como: supervisorA,
        json: { data_inicio_prog: "2026-10-25", equipe_id: equipeB, justificativa: "Equipe B tem a ferramenta" },
      });
      assert.equal((await lerOs(o.id)).equipeId, equipeB);
      const [h] = await historico(o.id);
      assert.equal(h!.equipeAnteriorId, equipeA);
      assert.equal(h!.equipeNovaId, equipeB);
      // Depois disso a OS é da equipe B: o supervisor A já não a enxerga.
      const r = await amb.req("POST", `/os/${o.id}/reprogramar`, { como: supervisorA, json: { data_inicio_prog: "2026-10-26", justificativa: "x" } });
      assert.equal(r.status, 404);
    });

    it("equipe inexistente é 422 e nada é gravado", async () => {
      const o = await criarOs();
      const r = await amb.req("POST", `/os/${o.id}/reprogramar`, {
        como: admin,
        json: { data_inicio_prog: "2026-10-25", equipe_id: ID_INEXISTENTE, justificativa: "x" },
      });
      assert.equal(r.status, 422);
      assert.equal(r.corpo.erro.codigo, "equipe_inexistente");
      assert.equal((await lerOs(o.id)).dataInicioProg, "2026-10-20");
      assert.equal((await historico(o.id)).length, 0);
    });

    it("justificativa ausente, vazia ou só com espaços é 422 'Justificativa obrigatória'", async () => {
      const o = await criarOs();
      for (const json of [
        { data_inicio_prog: "2026-10-25" },
        { data_inicio_prog: "2026-10-25", justificativa: "" },
        { data_inicio_prog: "2026-10-25", justificativa: "   " },
      ]) {
        const r = await amb.req("POST", `/os/${o.id}/reprogramar`, { como: supervisorA, json });
        assert.equal(r.status, 422);
        assert.equal(r.corpo.erro.codigo, "justificativa_obrigatoria");
        assert.equal(r.corpo.erro.mensagem, "Justificativa obrigatória");
      }
      assert.equal((await historico(o.id)).length, 0);
      assert.equal((await lerOs(o.id)).dataInicioProg, "2026-10-20");
    });

    it("valida a data: formato errado, data inexistente e ausente são 422", async () => {
      const o = await criarOs();
      for (const data of ["25/10/2026", "2026-02-30", undefined]) {
        const r = await amb.req("POST", `/os/${o.id}/reprogramar`, { como: admin, json: { data_inicio_prog: data, justificativa: "x" } });
        assert.equal(r.status, 422);
        assert.equal(r.corpo.erro.codigo, "validacao");
      }
    });

    it("OS encerrada ou cancelada é 409 e nada muda", async () => {
      for (const status of ["encerrada", "cancelada"] as const) {
        const o = await criarOs({ status });
        const r = await amb.req("POST", `/os/${o.id}/reprogramar`, { como: admin, json: { data_inicio_prog: "2026-12-01", justificativa: "x" } });
        assert.equal(r.status, 409, status);
        assert.equal(r.corpo.erro.codigo, "os_finalizada");
        assert.equal((await lerOs(o.id)).dataInicioProg, "2026-10-20");
        assert.equal((await historico(o.id)).length, 0);
      }
    });

    it("reprograma OS liberada, pendente e em execução sem mudar o status", async () => {
      for (const status of ["liberada", "pendente", "em_execucao"] as const) {
        const o = await criarOs({ status });
        const r = await amb.esperar(200, "POST", `/os/${o.id}/reprogramar`, { como: admin, json: { data_inicio_prog: "2026-12-01", justificativa: "x" } });
        assert.equal(r.status, status);
        assert.equal((await lerOs(o.id)).status, status);
      }
    });

    it("supervisor de outra equipe recebe 404 (não vaza a existência); OS inexistente e id inválido também", async () => {
      const o = await criarOs({ equipeId: equipeA });
      const corpo = { data_inicio_prog: "2026-12-01", justificativa: "x" };
      assert.equal((await amb.req("POST", `/os/${o.id}/reprogramar`, { como: supervisorB, json: corpo })).status, 404);
      assert.equal((await amb.req("POST", `/os/${ID_INEXISTENTE}/reprogramar`, { como: supervisorB, json: corpo })).status, 404);
      assert.equal((await amb.req("POST", "/os/abc/reprogramar", { como: admin, json: corpo })).status, 404);
      assert.equal((await lerOs(o.id)).dataInicioProg, "2026-10-20");
    });

    it("perfis: técnico (que não supervisiona) 403; sem token 401; admin reprograma qualquer equipe", async () => {
      const o = await criarOs({ equipeId: equipeB });
      const corpo = { data_inicio_prog: "2026-12-01", justificativa: "x" };
      assert.equal((await amb.req("POST", `/os/${o.id}/reprogramar`, { json: corpo })).status, 401);
      assert.equal((await amb.req("POST", `/os/${o.id}/reprogramar`, { como: tecnico, json: corpo })).status, 403);
      await amb.esperar(200, "POST", `/os/${o.id}/reprogramar`, { como: admin, json: corpo });
      await amb.esperar(200, "POST", `/os/${o.id}/reprogramar`, { como: admin, json: { ...corpo, data_inicio_prog: "2026-12-02" } });
      assert.equal((await historico(o.id)).length, 2);
    });
  });

  describe("POST /os/:id/cancelar", () => {
    it("admin cancela OS de apoio liberada ou pendente e grava quem, quando e por quê", async () => {
      for (const status of ["liberada", "pendente"] as const) {
        const o = await criarOs({ status });
        const r = await amb.esperar(200, "POST", `/os/${o.id}/cancelar`, { como: admin, json: { justificativa: "  Aberta em duplicidade " } });
        assert.deepEqual(r, { id: o.id, status: "cancelada" });
        const depois = await lerOs(o.id);
        assert.equal(depois.status, "cancelada");
        assert.equal(depois.canceladaPor, admin.id);
        assert.deepEqual(depois.canceladaEm, new Date("2026-10-11T12:00:00Z"));
        assert.equal(depois.justificativaCancelamento, "Aberta em duplicidade");
        assert.equal(depois.canceladaAssinaturaPath, await amb.assinaturaDe(admin));
      }
    });

    it("OS do SAP é 422 e continua como estava", async () => {
      const o = await criarOs({ origem: "sap" });
      const r = await amb.req("POST", `/os/${o.id}/cancelar`, { como: admin, json: { justificativa: "x" } });
      assert.equal(r.status, 422);
      assert.equal(r.corpo.erro.mensagem, "Só OS de apoio pode ser cancelada pelo sistema");
      assert.equal((await lerOs(o.id)).status, "liberada");
    });

    it("em execução, encerrada ou já cancelada é 409", async () => {
      for (const status of ["em_execucao", "encerrada", "cancelada"] as const) {
        const o = await criarOs({ status });
        const r = await amb.req("POST", `/os/${o.id}/cancelar`, { como: admin, json: { justificativa: "x" } });
        assert.equal(r.status, 409, status);
        assert.equal((await lerOs(o.id)).status, status);
      }
    });

    it("justificativa obrigatória: ausente ou em branco é 422", async () => {
      const o = await criarOs();
      for (const json of [{}, { justificativa: "" }, { justificativa: "  " }]) {
        const r = await amb.req("POST", `/os/${o.id}/cancelar`, { como: admin, json });
        assert.equal(r.status, 422);
        assert.equal(r.corpo.erro.codigo, "justificativa_obrigatoria");
      }
      assert.equal((await lerOs(o.id)).status, "liberada");
    });

    it("perfis: supervisor e técnico 403; sem token 401; OS inexistente 404", async () => {
      const o = await criarOs();
      const json = { justificativa: "x" };
      assert.equal((await amb.req("POST", `/os/${o.id}/cancelar`, { json })).status, 401);
      for (const quem of [supervisorA, tecnico]) {
        assert.equal((await amb.req("POST", `/os/${o.id}/cancelar`, { como: quem, json })).status, 403, quem.perfil);
      }
      assert.equal((await amb.req("POST", `/os/${ID_INEXISTENTE}/cancelar`, { como: admin, json })).status, 404);
      assert.equal((await lerOs(o.id)).status, "liberada");
    });
  });

  describe("alertas", () => {
    let osA: Awaited<ReturnType<typeof criarOs>>;
    let osB: Awaited<ReturnType<typeof criarOs>>;
    let aSupAntigo: Awaited<ReturnType<typeof criarAlerta>>;
    let aSupNovo: Awaited<ReturnType<typeof criarAlerta>>;
    let aAdmin: Awaited<ReturnType<typeof criarAlerta>>;
    let aSupB: Awaited<ReturnType<typeof criarAlerta>>;
    let leitor: UsuarioDeTeste;

    before(async () => {
      // Supervisor novo, só com os alertas criados aqui.
      leitor = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeA, supervisor: true });
      osA = await criarOs({ equipeId: equipeA, status: "pendente", origem: "sap" });
      osB = await criarOs({ equipeId: equipeB, status: "pendente" });
      aSupAntigo = await criarAlerta(osA.id, leitor.id, "bloqueio", new Date("2026-10-01T10:00:00Z"));
      aSupNovo = await criarAlerta(osA.id, leitor.id, "conflito_planejamento", new Date("2026-10-05T10:00:00Z"));
      aAdmin = await criarAlerta(osB.id, admin.id, "apoio_encerrado", new Date("2026-10-03T10:00:00Z"));
      aSupB = await criarAlerta(osB.id, supervisorB.id, "bloqueio", new Date("2026-10-04T10:00:00Z"));
    });

    const ids = (corpo: any): string[] => corpo.alertas.map((a: any) => a.id);

    it("supervisor vê só os seus, do mais recente ao mais antigo, com os dados da OS", async () => {
      const c = await amb.esperar(200, "GET", "/alertas", { como: leitor });
      assert.deepEqual(ids(c), [aSupNovo.id, aSupAntigo.id]);
      assert.equal(c.total, 2);
      assert.equal(c.pagina, 1);
      assert.equal(c.tamanho, 50);
      const a = c.alertas[0];
      assert.equal(a.tipo, "conflito_planejamento");
      assert.equal(a.os_id, osA.id);
      assert.equal(a.numero_ordem, osA.numeroOrdem);
      assert.equal(a.titulo, osA.titulo);
      assert.equal(a.equipe_id, equipeA);
      assert.equal(a.detalhe, "detalhe do alerta");
      assert.equal(a.email_enviado_em, null);
      assert.equal(a.lido_em, null);
      assert.ok(a.criado_em);
    });

    it("admin vê todos e filtra por equipe", async () => {
      const meus = [aSupNovo, aSupAntigo, aAdmin, aSupB].map((a) => a.id);
      for (const quem of [admin]) {
        const todos = ids(await amb.esperar(200, "GET", "/alertas", { como: quem }));
        for (const id of meus) assert.ok(todos.includes(id), quem.perfil);
        const daB = ids(await amb.esperar(200, "GET", "/alertas", { como: quem, consulta: { equipe_id: equipeB } }));
        assert.deepEqual(daB.filter((id) => meus.includes(id)), [aSupB.id, aAdmin.id]);
        assert.ok(!daB.includes(aSupNovo.id));
      }
      // Cada alerta diz de quem é: o painel só marca como lido o alerta de quem o abre.
      const lista = (await amb.esperar(200, "GET", "/alertas", { como: admin, consulta: { equipe_id: equipeB } })).alertas;
      const doSupB = lista.find((a: any) => a.id === aSupB.id);
      assert.equal(doSupB.destinatario_id, supervisorB.id);
      assert.equal(doSupB.destinatario_nome, (await amb.sql<{ nome: string }>("select nome from usuario where id = $1", [supervisorB.id]))[0]!.nome);
      assert.equal(lista.find((a: any) => a.id === aAdmin.id).destinatario_id, admin.id);
    });

    it("equipe_id filtra também para o supervisor (equipe atual da OS)", async () => {
      assert.deepEqual(ids(await amb.esperar(200, "GET", "/alertas", { como: leitor, consulta: { equipe_id: equipeA } })), [aSupNovo.id, aSupAntigo.id]);
      const outra = await amb.esperar(200, "GET", "/alertas", { como: leitor, consulta: { equipe_id: equipeB } });
      assert.deepEqual(outra.alertas, []);
      assert.equal(outra.total, 0);
    });

    it("o técnico tem o sino, mas só vê os alertas endereçados a ele (os da equipe não); sem token é 401", async () => {
      const meus = await amb.esperar(200, "GET", "/alertas", { como: tecnico });
      assert.deepEqual(meus.alertas, []);
      assert.equal(meus.total, 0);
      assert.equal((await amb.req("GET", "/alertas")).status, 401);
    });

    it("pagina a lista", async () => {
      const p1 = await amb.esperar(200, "GET", "/alertas", { como: leitor, consulta: { tamanho: 1, pagina: 1 } });
      const p2 = await amb.esperar(200, "GET", "/alertas", { como: leitor, consulta: { tamanho: 1, pagina: 2 } });
      assert.deepEqual([ids(p1), ids(p2)], [[aSupNovo.id], [aSupAntigo.id]]);
      assert.equal(p1.total, 2);
    });

    it("PATCH marca como lido (idempotente) e o filtro lido separa lidos de não lidos", async () => {
      await amb.esperar(200, "PATCH", `/alertas/${aSupAntigo.id}`, { como: leitor, json: { lido: true } });
      assert.deepEqual((await lerAlerta(aSupAntigo.id)).lidoEm, new Date("2026-10-11T12:00:00Z"));

      amb.relogio.agora = new Date("2026-10-11T12:10:00Z");
      await amb.esperar(200, "PATCH", `/alertas/${aSupAntigo.id}`, { como: leitor, json: { lido: true } });
      assert.deepEqual((await lerAlerta(aSupAntigo.id)).lidoEm, new Date("2026-10-11T12:00:00Z"));
      amb.relogio.agora = new Date("2026-10-11T12:00:00Z");

      assert.deepEqual(ids(await amb.esperar(200, "GET", "/alertas", { como: leitor, consulta: { lido: false } })), [aSupNovo.id]);
      const lidos = await amb.esperar(200, "GET", "/alertas", { como: leitor, consulta: { lido: true } });
      assert.deepEqual(ids(lidos), [aSupAntigo.id]);
      assert.ok(lidos.alertas[0].lido_em);
      assert.equal((await amb.req("GET", "/alertas", { como: leitor, consulta: { lido: "talvez" } })).status, 422);
    });

    it("PATCH com lido false, sem o campo ou com texto é 422", async () => {
      for (const json of [{ lido: false }, {}, { lido: "true" }]) {
        const r = await amb.req("PATCH", `/alertas/${aSupNovo.id}`, { como: leitor, json });
        assert.equal(r.status, 422);
        assert.equal(r.corpo.erro.codigo, "validacao");
      }
      assert.equal((await lerAlerta(aSupNovo.id)).lidoEm, null);
    });

    it("só o destinatário (ou o admin) marca: outro supervisor e o técnico recebem 404", async () => {
      assert.equal((await amb.req("PATCH", `/alertas/${aSupB.id}`, { como: leitor, json: { lido: true } })).status, 404);
      assert.equal((await amb.req("PATCH", `/alertas/${aSupB.id}`, { como: tecnico, json: { lido: true } })).status, 404);
      assert.equal((await amb.req("PATCH", `/alertas/${ID_INEXISTENTE}`, { como: admin, json: { lido: true } })).status, 404);
      assert.equal((await lerAlerta(aSupB.id)).lidoEm, null);

      await amb.esperar(200, "PATCH", `/alertas/${aSupB.id}`, { como: admin, json: { lido: true } });
      assert.ok((await lerAlerta(aSupB.id)).lidoEm);
      await amb.esperar(200, "PATCH", `/alertas/${aAdmin.id}`, { como: admin, json: { lido: true } });
    });
  });
});
