import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import ExcelJS from "exceljs";
import { eq } from "drizzle-orm";
import { alerta, auditoria, itemModeloApr, localInstalacao, modeloApr, os, type OsStatus } from "../src/db/schema";
import { processarOrdens } from "../src/dominio/importacao-ordens";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

const ID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";

describe("Atribuição individual e devolução de OS", () => {
  let amb: Ambiente;
  let equipeId: string;
  let outraEquipeId: string;
  let supervisor: UsuarioDeTeste;
  let supervisorDeOutra: UsuarioDeTeste;
  let ana: UsuarioDeTeste;
  let beto: UsuarioDeTeste;
  let deOutraEquipe: UsuarioDeTeste;
  let comum: UsuarioDeTeste;
  let admin: UsuarioDeTeste;
  let modelo: { id: string; itens: (typeof itemModeloApr.$inferSelect)[] };
  let localId: string;
  let contadorOs = 4100000;

  before(async () => {
    amb = await criarAmbiente({ comCarga: true, relogio: new Date("2026-10-15T15:00:00Z") });
    supervisor = await amb.criarUsuario({ perfil: "tecnico", nome: "Sônia Supervisora" });
    equipeId = (await amb.criarEquipe({ supervisorId: supervisor.id })).id;
    supervisorDeOutra = await amb.criarUsuario({ perfil: "tecnico" });
    outraEquipeId = (await amb.criarEquipe({ supervisorId: supervisorDeOutra.id })).id;
    ana = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Ana Souza" });
    beto = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Beto Lima" });
    comum = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    deOutraEquipe = await amb.criarUsuario({ perfil: "tecnico", equipeId: outraEquipeId });
    admin = await amb.criarUsuario({ perfil: "admin" });
    const [m] = await amb.db.select().from(modeloApr).where(eq(modeloApr.codigo, "APR 01"));
    modelo = { id: m!.id, itens: await amb.db.select().from(itemModeloApr).where(eq(itemModeloApr.modeloAprId, m!.id)) };
    const [local] = await amb.db.insert(localInstalacao).values({ codigo: "VILA VELHA/REDE" }).returning({ id: localInstalacao.id });
    localId = local!.id;
  });
  after(() => amb.fechar());

  async function novaOs(dados: Partial<typeof os.$inferInsert> = {}) {
    const [o] = await amb.db
      .insert(os)
      .values({ numeroOrdem: String(++contadorOs), tipo: "corretiva", titulo: "DCV Desobstrução", localInstalacaoId: localId, equipeId, dataInicioProg: "2026-10-15", origem: "sap", ...dados })
      .returning();
    return o!;
  }
  const lerOs = async (id: string) => (await amb.db.select().from(os).where(eq(os.id, id)))[0]!;
  const agora = () => amb.relogio.agora.toISOString();
  const evento = (tipo: string, payload: object, osId: string, ocorrido = agora()) => ({ id: randomUUID(), tipo, os_id: osId, payload, ocorrido_em: ocorrido });
  const enviar = (como: UsuarioDeTeste, ...eventos: unknown[]) => amb.esperar(200, "POST", "/eventos", { como, json: { eventos } });

  /** APR sem item reprovado; o primeiro participante é o responsável. */
  function payloadApr(quem: UsuarioDeTeste[], concluidaEm = agora()) {
    const respostas = modelo.itens
      .filter((i) => i.secao === "verificacao")
      .map((i) => ({ item_id: i.id, resposta: i.respostaBloqueante === "sim" ? "nao" : "sim" }));
    return {
      id: randomUUID(),
      modelo_apr_id: modelo.id,
      participantes: quem.map((u, i) => ({ usuario_id: u.id, funcao: i === 0 ? "responsavel" : "executor" })),
      riscos: [],
      respostas,
      evidencias: [],
      concluida_em: concluidaEm,
    };
  }
  const reservar = (osId: string, usuarioId: string, como: UsuarioDeTeste | null = supervisor) => amb.req("PUT", `/os/${osId}/responsavel`, { ...(como && { como }), json: { usuario_id: usuarioId } });

  describe("PUT /os/:id/responsavel (reservar)", () => {
    it("o supervisor reserva a OS a uma pessoa da equipe: ela segue no quadro, com a marca, e a trilha registra", async () => {
      const o = await novaOs();
      const r = await amb.esperar(200, "PUT", `/os/${o.id}/responsavel`, { como: supervisor, json: { usuario_id: ana.id } });
      assert.deepEqual(r, { id: o.id, status: "liberada", responsavel: { id: ana.id, nome: "Ana Souza" } });
      const depois = await lerOs(o.id);
      assert.equal(depois.responsavelId, ana.id);
      assert.equal(depois.reservadaPor, supervisor.id);
      assert.deepEqual(depois.reservadaEm, amb.relogio.agora);

      // Quem não é o responsável continua vendo a OS no quadro da equipe, agora com o nome de quem vai fazê-la.
      const quadro = await amb.esperar(200, "GET", "/os", { como: beto, consulta: { status: "liberada", tamanho: 100 } });
      assert.deepEqual(quadro.os.find((x: any) => x.id === o.id).responsavel, { id: ana.id, nome: "Ana Souza" });
      const detalhe = await amb.esperar(200, "GET", `/os/${o.id}`, { como: beto });
      assert.equal(detalhe.os.responsavel.nome, "Ana Souza");
      assert.equal(detalhe.os.responsavel.reservada_por_nome, "Sônia Supervisora");
      assert.ok(detalhe.linha_do_tempo.some((e: any) => e.tipo === "reserva" && e.descricao.includes("Ana Souza")));

      const [registro] = await amb.db.select().from(auditoria).where(eq(auditoria.entidadeId, o.id));
      assert.equal(registro!.acao, "os.reservar");
      assert.equal(registro!.atorId, supervisor.id);
    });

    it("trocar o responsável vale enquanto a OS não começou, e repetir a mesma pessoa não muda nada", async () => {
      const o = await novaOs({ status: "pendente" });
      await amb.esperar(200, "PUT", `/os/${o.id}/responsavel`, { como: supervisor, json: { usuario_id: ana.id } });
      const reservadaEm = (await lerOs(o.id)).reservadaEm;
      amb.relogio.agora = new Date(amb.relogio.agora.getTime() + 60_000);
      await amb.esperar(200, "PUT", `/os/${o.id}/responsavel`, { como: supervisor, json: { usuario_id: ana.id } });
      assert.deepEqual((await lerOs(o.id)).reservadaEm, reservadaEm);
      await amb.esperar(200, "PUT", `/os/${o.id}/responsavel`, { como: supervisor, json: { usuario_id: beto.id } });
      assert.equal((await lerOs(o.id)).responsavelId, beto.id);
      assert.equal((await amb.db.select().from(auditoria).where(eq(auditoria.entidadeId, o.id))).length, 2);
    });

    it("o responsável precisa ser técnico ativo da equipe da OS", async () => {
      const o = await novaOs();
      const inativo = await amb.criarUsuario({ perfil: "tecnico", equipeId, ativo: false });
      for (const quem of [deOutraEquipe, admin, inativo, supervisorDeOutra]) {
        const r = await reservar(o.id, quem.id);
        assert.equal(r.status, 422, quem.perfil);
        assert.equal(r.corpo.erro.codigo, "responsavel_invalido");
      }
      assert.equal((await reservar(o.id, ID_INEXISTENTE)).status, 422);
      assert.equal((await lerOs(o.id)).responsavelId, null);
    });

    it("só a OS que ainda não começou: em execução, encerrada, cancelada e devolvida são 409", async () => {
      for (const status of ["em_execucao", "encerrada", "cancelada", "devolvida"] as const) {
        const o = await novaOs({ status, ...(status === "devolvida" && { devolvidaEm: amb.relogio.agora, devolvidaPor: supervisor.id, justificativaDevolucao: "x" }) });
        const r = await reservar(o.id, ana.id);
        assert.equal(r.status, 409, status);
        assert.equal(r.corpo.erro.codigo, "status_invalido_para_reservar");
      }
    });

    it("perfis: sem token 401; técnico comum e admin 403; supervisor de outra equipe 404 (não vaza a OS)", async () => {
      const o = await novaOs();
      assert.equal((await reservar(o.id, ana.id, null)).status, 401);
      assert.equal((await reservar(o.id, ana.id, comum)).status, 403);
      assert.equal((await reservar(o.id, ana.id, ana)).status, 403);
      assert.equal((await reservar(o.id, ana.id, admin)).status, 403);
      assert.equal((await reservar(o.id, ana.id, supervisorDeOutra)).status, 404);
      assert.equal((await reservar(ID_INEXISTENTE, ana.id)).status, 404);
      assert.equal((await lerOs(o.id)).responsavelId, null);
    });
  });

  describe("DELETE /os/:id/responsavel (liberar para a equipe)", () => {
    it("tira a reserva e a OS volta a ser da equipe toda; sem reserva é 409", async () => {
      const o = await novaOs();
      assert.equal((await amb.req("DELETE", `/os/${o.id}/responsavel`, { como: supervisor })).status, 409);
      await reservar(o.id, ana.id);
      const r = await amb.esperar(200, "DELETE", `/os/${o.id}/responsavel`, { como: supervisor });
      assert.deepEqual(r, { id: o.id, status: "liberada" });
      const depois = await lerOs(o.id);
      assert.deepEqual([depois.responsavelId, depois.reservadaPor, depois.reservadaEm], [null, null, null]);
      assert.equal((await amb.db.select().from(auditoria).where(eq(auditoria.acao, "os.liberar_reserva"))).length >= 1, true);
    });

    it("perfis: técnico comum 403 e supervisor de outra equipe 404", async () => {
      const o = await novaOs();
      await reservar(o.id, ana.id);
      assert.equal((await amb.req("DELETE", `/os/${o.id}/responsavel`, { como: comum })).status, 403);
      assert.equal((await amb.req("DELETE", `/os/${o.id}/responsavel`, { como: supervisorDeOutra })).status, 404);
      assert.equal((await lerOs(o.id)).responsavelId, ana.id);
    });
  });

  describe("quem pode iniciar a OS reservada", () => {
    it("só o responsável aplica a APR: o colega é recusado nos eventos e na validação", async () => {
      const o = await novaOs();
      await reservar(o.id, ana.id);

      const doColega = payloadApr([beto, ana]);
      const r = await enviar(beto, evento("apr_concluida", doColega, o.id));
      assert.deepEqual(r.confirmados, []);
      assert.equal(r.rejeitados[0].codigo, "os_reservada");
      assert.match(r.rejeitados[0].mensagem, /Ana Souza/);
      assert.equal((await amb.sql("select 1 from apr where os_id = $1", [o.id])).length, 0);

      const { id: _id, evidencias: _e, ...paraAvaliar } = doColega;
      const v = await amb.req("POST", "/aprs/avaliar", { como: beto, json: { ...paraAvaliar, id: randomUUID(), os_id: o.id } });
      assert.equal(v.status, 409);
      assert.equal(v.corpo.erro.codigo, "os_reservada");

      const dela = payloadApr([ana, beto]);
      const ok = await enviar(ana, evento("apr_concluida", dela, o.id));
      assert.deepEqual(ok.aprs, [{ id: dela.id, resultado: "aprovada" }]);
    });

    it("na APR da OS reservada, o responsável é a pessoa designada; os colegas entram como participantes", async () => {
      const o = await novaOs();
      await reservar(o.id, ana.id);
      const invertida = payloadApr([beto, ana]);
      // Ana envia, mas o responsável da APR é o Beto: recusada.
      const r = await enviar(ana, evento("apr_concluida", { ...invertida, participantes: [{ usuario_id: ana.id, funcao: "executor" }, { usuario_id: beto.id, funcao: "responsavel" }] }, o.id));
      assert.equal(r.rejeitados[0].codigo, "responsavel_reservado");
    });

    it("o colega participante da APR da Ana também não inicia a execução", async () => {
      const o = await novaOs();
      await reservar(o.id, ana.id);
      const p = payloadApr([ana, beto]);
      await enviar(ana, evento("apr_concluida", p, o.id));
      const execId = randomUUID();
      const r = await enviar(beto, evento("execucao_iniciada", { id: execId, apr_id: p.id, inicio: agora() }, o.id));
      assert.equal(r.rejeitados[0].codigo, "os_reservada");
      const dela = await enviar(ana, evento("execucao_iniciada", { id: execId, apr_id: p.id, inicio: agora() }, o.id));
      assert.deepEqual(dela.os, [{ id: o.id, status: "em_execucao" }]);
    });

    it("liberada a reserva, qualquer um da equipe volta a poder iniciar", async () => {
      const o = await novaOs();
      await reservar(o.id, ana.id);
      await amb.esperar(200, "DELETE", `/os/${o.id}/responsavel`, { como: supervisor });
      const p = payloadApr([beto]);
      const r = await enviar(beto, evento("apr_concluida", p, o.id));
      assert.deepEqual(r.aprs, [{ id: p.id, resultado: "aprovada" }]);
    });

    it("vindo da fila offline, o evento do colega é aplicado e vira alerta ao supervisor (Decisão-chave 2)", async () => {
      const o = await novaOs();
      await reservar(o.id, ana.id);
      const antes = new Date(amb.relogio.agora.getTime() - 10 * 60_000).toISOString();
      const p = payloadApr([beto], antes);
      const r = await enviar(beto, evento("apr_concluida", p, o.id, antes));
      assert.deepEqual(r.aprs, [{ id: p.id, resultado: "aprovada" }]);
      const alertas = await amb.db.select().from(alerta).where(eq(alerta.osId, o.id));
      assert.equal(alertas.some((a) => a.tipo === "conflito_planejamento" && a.detalhe.includes("responsável reservado")), true);
    });

    it("o snapshot do modo offline leva a reserva", async () => {
      const o = await novaOs();
      await reservar(o.id, ana.id);
      const s = await amb.esperar(200, "POST", "/sync/pull", { como: beto, json: {} });
      assert.equal(s.os.find((x: any) => x.id === o.id).responsavel_id, ana.id);
    });

    it("a leitura do SAP não desfaz a reserva", async () => {
      const o = await novaOs({ numeroOrdem: "4999001" });
      await reservar(o.id, ana.id);
      const centro = (await amb.sql<{ centro_trabalho: string }>("select centro_trabalho from equipe where id = $1", [equipeId]))[0]!.centro_trabalho;
      const r = await processarOrdens(
        amb.db,
        [{ ordem: { numero_ordem: "4999001", tipo_ordem: "YBA1", titulo: "Título novo", centro_trabalho: centro, local_instalacao: { codigo: "VILA VELHA/REDE" }, data_inicio_prog: "2026-10-15", status_sap: "LIB" } }],
        { origem: "sap", agora: amb.relogio.agora },
      );
      assert.equal(r.atualizadas, 1);
      const depois = await lerOs(o.id);
      assert.equal(depois.titulo, "Título novo");
      assert.equal(depois.responsavelId, ana.id);
    });
  });

  describe("POST /os/:id/devolver", () => {
    const devolver = (osId: string, justificativa: unknown, como: UsuarioDeTeste | null = supervisor) =>
      amb.req("POST", `/os/${osId}/devolver`, { ...(como && { como }), json: justificativa === undefined ? {} : { justificativa } });

    it("o supervisor devolve a OS liberada: ela sai do quadro, perde a reserva e guarda quem, quando e por quê", async () => {
      const o = await novaOs();
      await reservar(o.id, ana.id);
      const r = await amb.esperar(200, "POST", `/os/${o.id}/devolver`, { como: supervisor, json: { justificativa: "  Local de instalação errado na ordem " } });
      assert.deepEqual(r, { id: o.id, status: "devolvida" });
      const depois = await lerOs(o.id);
      assert.equal(depois.status, "devolvida");
      assert.equal(depois.devolvidaPor, supervisor.id);
      assert.equal(depois.devolvidaAssinaturaPath, await amb.assinaturaDe(supervisor));
      assert.deepEqual(depois.devolvidaEm, amb.relogio.agora);
      assert.equal(depois.justificativaDevolucao, "Local de instalação errado na ordem");
      assert.equal(depois.responsavelId, null);
      assert.equal(depois.devolucaoExportadaEm, null);

      const liberadas = await amb.esperar(200, "GET", "/os", { como: beto, consulta: { status: "liberada", tamanho: 200 } });
      assert.equal(liberadas.os.some((x: any) => x.id === o.id), false);
      assert.equal(liberadas.contagem_por_status.devolvida >= 1, true);
      const detalhe = await amb.esperar(200, "GET", `/os/${o.id}`, { como: beto });
      assert.equal(detalhe.os.devolucao.justificativa, "Local de instalação errado na ordem");
      assert.equal(detalhe.os.devolucao.por_nome, "Sônia Supervisora");
      assert.ok(detalhe.linha_do_tempo.some((e: any) => e.tipo === "devolucao"));
      const snapshot = await amb.esperar(200, "POST", "/sync/pull", { como: beto, json: {} });
      assert.equal(snapshot.os.some((x: any) => x.id === o.id), false);
      assert.equal((await amb.db.select().from(auditoria).where(eq(auditoria.acao, "os.devolver"))).length >= 1, true);
    });

    it("justificativa obrigatória: ausente ou em branco é 422 e a OS não muda", async () => {
      const o = await novaOs();
      for (const j of [undefined, "", "   "]) {
        const r = await devolver(o.id, j);
        assert.equal(r.status, 422);
        assert.equal(r.corpo.erro.codigo, "justificativa_obrigatoria");
      }
      assert.equal((await lerOs(o.id)).status, "liberada");
    });

    it("só a OS liberada, que ainda não foi iniciada: pendente, em execução, encerrada, cancelada e já devolvida são 409", async () => {
      for (const status of ["pendente", "em_execucao", "encerrada", "cancelada"] as const satisfies readonly OsStatus[]) {
        const o = await novaOs({ status });
        const r = await devolver(o.id, "x");
        assert.equal(r.status, 409, status);
        assert.equal(r.corpo.erro.codigo, "status_invalido_para_devolver");
      }
      const o = await novaOs();
      await devolver(o.id, "x");
      assert.equal((await devolver(o.id, "y")).status, 409);
    });

    it("a OS de apoio não é do SAP: é 422 (o admin a cancela)", async () => {
      const origem = await novaOs();
      const apoio = await novaOs({ numeroOrdem: null, origem: "apoio", osOrigemId: origem.id });
      const r = await devolver(apoio.id, "x");
      assert.equal(r.status, 422);
      assert.equal(r.corpo.erro.codigo, "os_apoio");
    });

    it("só o supervisor da equipe: técnico comum e admin 403, supervisor de outra equipe 404, sem token 401", async () => {
      const o = await novaOs();
      assert.equal((await devolver(o.id, "x", null)).status, 401);
      assert.equal((await devolver(o.id, "x", comum)).status, 403);
      assert.equal((await devolver(o.id, "x", admin)).status, 403);
      assert.equal((await devolver(o.id, "x", supervisorDeOutra)).status, 404);
      assert.equal((await devolver(ID_INEXISTENTE, "x")).status, 404);
      assert.equal((await lerOs(o.id)).status, "liberada");
    });

    it("a OS devolvida não recebe mais APR nem execução: online é recusada, da fila offline vira alerta", async () => {
      const o = await novaOs();
      await devolver(o.id, "Ordem duplicada");
      const online = await enviar(ana, evento("apr_concluida", payloadApr([ana]), o.id));
      assert.equal(online.rejeitados[0].codigo, "os_devolvida");

      const antes = new Date(amb.relogio.agora.getTime() - 10 * 60_000).toISOString();
      const p = payloadApr([ana], antes);
      const offline = await enviar(ana, evento("apr_concluida", p, o.id, antes));
      assert.deepEqual(offline.aprs, [{ id: p.id, resultado: "aprovada" }]);
      assert.equal((await lerOs(o.id)).status, "devolvida");
      const alertas = await amb.db.select().from(alerta).where(eq(alerta.osId, o.id));
      assert.equal(alertas.some((a) => a.tipo === "conflito_planejamento" && a.detalhe.includes("devolvida")), true);
    });
  });

  describe("a devolução na planilha de baixa e a volta pelo SAP", () => {
    const exportar = async () => {
      const r = await amb.req("POST", "/exportacoes/sap", { como: admin });
      assert.equal(r.status, 200);
      const livro = new ExcelJS.Workbook();
      await livro.xlsx.load(r.corpo as ExcelJS.Buffer);
      return { livro, mensagem: r.cabecalhos.get("x-mensagem") };
    };
    const linhasDa = (livro: ExcelJS.Workbook, nome: string) => {
      const aba = livro.getWorksheet(nome)!;
      const cab = (aba.getRow(1).values as unknown[]).slice(1).map(String);
      const linhas: Record<string, unknown>[] = [];
      aba.eachRow((linha, n) => {
        if (n === 1) return;
        const v = (linha.values as unknown[]).slice(1);
        linhas.push(Object.fromEntries(cab.map((c, i) => [c, v[i] ?? null])));
      });
      return linhas;
    };

    it("a devolvida sai na aba Devolvidas, com a justificativa, uma vez só", async () => {
      // Esvazia o que outros testes deixaram pendente.
      await exportar();
      const o = await novaOs({ numeroOrdem: "4888001", titulo: "Troca de regulador" });
      await amb.esperar(200, "POST", `/os/${o.id}/devolver`, { como: supervisor, json: { justificativa: "Equipamento informado não existe no local" } });

      const primeira = await exportar();
      assert.deepEqual(primeira.livro.worksheets.map((a) => a.name), ["Encerradas", "Sem ordem SAP", "Impedimentos", "Devolvidas"]);
      const linhas = linhasDa(primeira.livro, "Devolvidas");
      assert.equal(linhas.length, 1);
      assert.equal(String(linhas[0]!.numero_ordem), "4888001");
      assert.equal(linhas[0]!.titulo, "Troca de regulador");
      assert.equal(linhas[0]!.justificativa, "Equipamento informado não existe no local");
      assert.equal(linhas[0]!.devolvida_por, "Sônia Supervisora");
      assert.equal(primeira.mensagem, null);
      assert.notEqual((await lerOs(o.id)).devolucaoExportadaEm, null);

      const segunda = await exportar();
      assert.equal(linhasDa(segunda.livro, "Devolvidas").length, 0);
      assert.equal(segunda.mensagem, "Nenhuma OS nova para exportar");
    });

    it("quando o SAP traz a ordem de volta, a OS devolvida volta liberada, sem a devolução (o PDF impresso não a traz)", async () => {
      const o = await novaOs({ numeroOrdem: "4888002" });
      await amb.esperar(200, "POST", `/os/${o.id}/devolver`, { como: supervisor, json: { justificativa: "Prioridade errada" } });
      const centro = (await amb.sql<{ centro_trabalho: string }>("select centro_trabalho from equipe where id = $1", [equipeId]))[0]!.centro_trabalho;
      const ordem = { numero_ordem: "4888002", tipo_ordem: "YBA1", titulo: "DCV Desobstrução", centro_trabalho: centro, local_instalacao: { codigo: "VILA VELHA/REDE" }, data_inicio_prog: "2026-10-15", status_sap: "LIB" };

      await processarOrdens(amb.db, [{ ordem }], { origem: "pdf", agora: amb.relogio.agora });
      assert.equal((await lerOs(o.id)).status, "devolvida");

      await processarOrdens(amb.db, [{ ordem }], { origem: "sap", agora: amb.relogio.agora });
      const depois = await lerOs(o.id);
      assert.equal(depois.status, "liberada");
      assert.deepEqual([depois.devolvidaEm, depois.devolvidaPor, depois.justificativaDevolucao, depois.devolucaoExportadaEm], [null, null, null, null]);
      // E pode ser devolvida de novo, saindo de novo na planilha.
      await amb.esperar(200, "POST", `/os/${o.id}/devolver`, { como: supervisor, json: { justificativa: "Ainda errada" } });
    });
  });
});
