import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { alerta, ausencia, ausenciaAto, auditoria, execucao, itemModeloApr, localInstalacao, modeloApr, os, usuario } from "../src/db/schema";
import { conferirAusencias } from "../src/dominio/ausencia";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

const HOJE = new Date("2026-10-15T15:00:00Z"); // 12h em São Paulo
const dia = (n: number) => new Date(HOJE.getTime() + n * 86_400_000);
const ID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";

describe("Usuário ausente", () => {
  let amb: Ambiente;
  let equipeId: string;
  let supervisor: UsuarioDeTeste;
  let admin: UsuarioDeTeste;
  let semAssinatura: UsuarioDeTeste;
  let outraEquipeId: string;
  let supervisorDeOutra: UsuarioDeTeste;
  let modelo: { id: string; itens: (typeof itemModeloApr.$inferSelect)[] };
  let localId: string;
  let contadorOs = 4200000;
  let contador = 0;

  before(async () => {
    amb = await criarAmbiente({ comCarga: true, relogio: HOJE, duracaoDoTokenSeg: 90 * 86_400 });
    supervisor = await amb.criarUsuario({ perfil: "tecnico", nome: "Sônia Supervisora" });
    equipeId = (await amb.criarEquipe({ supervisorId: supervisor.id })).id;
    await amb.db.update(usuario).set({ equipeId }).where(eq(usuario.id, supervisor.id));
    supervisorDeOutra = await amb.criarUsuario({ perfil: "tecnico", nome: "Outro Supervisor" });
    outraEquipeId = (await amb.criarEquipe({ supervisorId: supervisorDeOutra.id })).id;
    admin = await amb.criarUsuario({ perfil: "admin" });
    semAssinatura = await amb.criarUsuario({ perfil: "tecnico", equipeId, comAssinatura: false, nome: "Sem Assinatura" });
    const [m] = await amb.db.select().from(modeloApr).where(eq(modeloApr.codigo, "APR 01"));
    modelo = { id: m!.id, itens: await amb.db.select().from(itemModeloApr).where(eq(itemModeloApr.modeloAprId, m!.id)) };
    const [local] = await amb.db.insert(localInstalacao).values({ codigo: "VILA VELHA/REDE" }).returning({ id: localInstalacao.id });
    localId = local!.id;
  });
  after(() => amb.fechar());

  /** Cada teste trabalha com gente nova e com o relógio em `HOJE`: uma pessoa só tem uma ausência por vez. */
  const novo = (nome?: string) => {
    contador++;
    return amb.criarUsuario({ perfil: "tecnico", equipeId, nome: nome ?? `Técnico ${contador}` });
  };
  const relogio = (d: Date) => (amb.relogio.agora = d);
  const comeco = () => relogio(HOJE);
  const ASSINA = { assinar: true };

  const pedir = (como: UsuarioDeTeste | null, json: object) => amb.req("POST", "/ausencias", { ...(como && { como }), json });
  const acao = (como: UsuarioDeTeste, id: string, nome: string, json: object = ASSINA) => amb.req("POST", `/ausencias/${id}/${nome}`, { como, json });
  const lerAusencia = async (id: string) => (await amb.db.select().from(ausencia).where(eq(ausencia.id, id)))[0]!;
  /** Os atos da ausência, em ordem alfabética: o relógio dos testes fica parado, então os atos do mesmo instante não têm ordem. */
  const atos = async (id: string) => (await amb.db.select().from(ausenciaAto).where(eq(ausenciaAto.ausenciaId, id))).map((a) => a.tipo).sort();
  /** A rodada da tarefa periódica; outras ausências do mesmo banco também podem ter o que fazer, então os testes olham a ausência deles. */
  const rodada = () => conferirAusencias(amb.db, amb.relogio.agora);
  const SEM_NADA = { canceladas: 0, iniciadas: 0, vencidas: 0 };
  const alertasDe = async (usuarioId: string, tipo?: string) =>
    (await amb.db.select().from(alerta).where(eq(alerta.destinatarioId, usuarioId))).filter((a) => !tipo || a.tipo === tipo);

  /** O supervisor registra a ausência de alguém, sem pedido: vale na hora. */
  async function registrar(quem: UsuarioDeTeste, json: object = { inicio: "2026-10-15", dias: 10 }) {
    const r = await amb.esperar(201, "POST", "/ausencias", { como: supervisor, json: { motivo: "Atestado médico", usuario_id: quem.id, ...ASSINA, ...json } });
    return r.ausencia.id as string;
  }

  // ---- o pedido -------------------------------------------------------------------------------------------------

  describe("POST /ausencias (pedir)", () => {
    it("o técnico pede com os dias corridos: o retorno é o primeiro dia de volta, e o supervisor é avisado", async () => {
      comeco();
      const ana = await novo("Ana Souza");
      const r = await amb.esperar(201, "POST", "/ausencias", { como: ana, json: { motivo: "Férias", inicio: "2026-10-20", dias: 14 } });
      assert.equal(r.ausencia.estado, "pedida");
      assert.equal(r.ausencia.situacao, "pedida");
      assert.equal(r.ausencia.origem, "pedido");
      assert.equal(r.ausencia.inicio, "2026-10-20");
      assert.equal(r.ausencia.retorno, "2026-11-03");
      assert.equal(r.ausencia.dias, 14);
      assert.equal(r.ausencia.dias_informados, 14);
      assert.equal(r.ausencia.supervisor_id, null);
      assert.equal(r.execucao_aberta, false);

      assert.deepEqual(await atos(r.ausencia.id), ["pedido"]);
      const [ato] = await amb.db.select().from(ausenciaAto).where(eq(ausenciaAto.ausenciaId, r.ausencia.id));
      assert.equal(ato!.assinaturaPath, null, "o pedido inicial não é assinado");
      const avisos = await alertasDe(supervisor.id, "ausencia_pedida");
      assert.equal(avisos.length, 1);
      assert.equal(avisos[0]!.usuarioAlvoId, ana.id);
      assert.equal(avisos[0]!.osId, null);
      assert.match(avisos[0]!.detalhe, /Ana Souza/);
      const [registro] = await amb.db.select().from(auditoria).where(eq(auditoria.entidadeId, r.ausencia.id));
      assert.equal(registro!.acao, "ausencia.pedido");
    });

    it("com a data de retorno vale o mesmo, e os dias informados ficam vazios", async () => {
      comeco();
      const r = await amb.esperar(201, "POST", "/ausencias", { como: await novo(), json: { motivo: "Viagem", inicio: "2026-10-20", retorno: "2026-10-23" } });
      assert.equal(r.ausencia.dias, 3);
      assert.equal(r.ausencia.dias_informados, null);
    });

    it("o período: um dos dois (dias ou retorno), início de hoje em diante, retorno depois do início, até 365 dias, motivo de até 500", async () => {
      comeco();
      const ana = await novo();
      const recusa = async (json: object, status: number, codigo: string) => {
        const r = await pedir(ana, { motivo: "Férias", inicio: "2026-10-20", ...json });
        assert.equal(r.status, status, JSON.stringify(json));
        assert.equal(r.corpo.erro.codigo, codigo, JSON.stringify(json));
      };
      await recusa({}, 422, "periodo_invalido");
      await recusa({ dias: 3, retorno: "2026-10-23" }, 422, "periodo_invalido");
      await recusa({ retorno: "2026-10-20" }, 422, "periodo_invalido");
      await recusa({ retorno: "2026-10-19" }, 422, "periodo_invalido");
      await recusa({ inicio: "2026-10-14", dias: 3 }, 422, "inicio_no_passado");
      await recusa({ dias: 366 }, 422, "validacao");
      await recusa({ dias: 0 }, 422, "validacao");
      await recusa({ retorno: "2027-10-21" }, 422, "periodo_longo");
      await recusa({ dias: 3, motivo: "   " }, 422, "validacao");
      await recusa({ dias: 3, motivo: "x".repeat(501) }, 422, "validacao");
      await recusa({ dias: 3, inicio: "2026-02-30" }, 422, "validacao");
      assert.equal((await pedir(ana, { motivo: "x".repeat(500), inicio: "2026-10-15", dias: 365 })).status, 201);
    });

    it("não pode se sobrepor a outra ausência da pessoa; períodos vizinhos passam", async () => {
      comeco();
      const ana = await novo();
      await amb.esperar(201, "POST", "/ausencias", { como: ana, json: { motivo: "Férias", inicio: "2026-10-20", dias: 5 } });
      for (const json of [{ inicio: "2026-10-22", dias: 2 }, { inicio: "2026-10-18", dias: 3 }, { inicio: "2026-10-19", dias: 10 }]) {
        const r = await pedir(ana, { motivo: "Outra", ...json });
        assert.equal(r.status, 409, JSON.stringify(json));
        assert.equal(r.corpo.erro.codigo, "ausencia_sobreposta");
      }
      await amb.esperar(201, "POST", "/ausencias", { como: ana, json: { motivo: "Depois", inicio: "2026-10-25", dias: 2 } });
      await amb.esperar(201, "POST", "/ausencias", { como: ana, json: { motivo: "Antes", inicio: "2026-10-16", dias: 4 } });
    });

    it("equipe sem supervisor não pede (409); o admin não pede nem registra (403); sem token 401", async () => {
      comeco();
      const equipeSemSup = (await amb.criarEquipe()).id;
      const solta = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeSemSup });
      const r = await pedir(solta, { motivo: "Férias", inicio: "2026-10-20", dias: 3 });
      assert.equal(r.status, 409);
      assert.equal(r.corpo.erro.codigo, "equipe_sem_supervisor");
      const semEquipe = await amb.criarUsuario({ perfil: "tecnico" });
      assert.equal((await pedir(semEquipe, { motivo: "Férias", inicio: "2026-10-20", dias: 3 })).corpo.erro.codigo, "sem_equipe");
      assert.equal((await pedir(admin, { motivo: "Férias", inicio: "2026-10-20", dias: 3 })).status, 403);
      assert.equal((await pedir(null, { motivo: "Férias", inicio: "2026-10-20", dias: 3 })).status, 401);
    });
  });

  // ---- o fluxo do pedido ----------------------------------------------------------------------------------------

  describe("a resposta do supervisor e a confirmação do técnico", () => {
    const pedirDe = async (quem: UsuarioDeTeste, json: object = { inicio: "2026-10-20", dias: 14 }) =>
      (await amb.esperar(201, "POST", "/ausencias", { como: quem, json: { motivo: "Férias", ...json } })).ausencia.id as string;

    it("aprova (assinando) com ajuste das datas, o técnico confirma (assinando) e a ausência fica agendada", async () => {
      comeco();
      const ana = await novo("Ana");
      const id = await pedirDe(ana);
      const aprovada = await amb.esperar(200, "POST", `/ausencias/${id}/aprovar`, { como: supervisor, json: { ...ASSINA, inicio: "2026-10-22", dias: 7 } });
      assert.equal(aprovada.ausencia.estado, "aguardando_confirmacao");
      assert.equal(aprovada.ausencia.inicio, "2026-10-22");
      assert.equal(aprovada.ausencia.retorno, "2026-10-29");
      assert.equal(aprovada.ausencia.supervisor_id, supervisor.id);

      const aviso = await alertasDe(ana.id, "ausencia_aprovada");
      assert.equal(aviso.length, 1);
      assert.match(aviso[0]!.detalhe, /datas ajustadas/);

      const confirmada = await amb.esperar(200, "POST", `/ausencias/${id}/confirmar`, { como: ana, json: ASSINA });
      assert.equal(confirmada.ausencia.estado, "confirmada");
      assert.equal(confirmada.ausencia.situacao, "agendada");
      assert.deepEqual(await atos(id), ["aprovacao", "confirmacao", "pedido"]);
      const assinados = (await amb.db.select().from(ausenciaAto).where(eq(ausenciaAto.ausenciaId, id))).filter((a) => a.assinaturaPath !== null).map((a) => a.tipo);
      assert.deepEqual(assinados.sort(), ["aprovacao", "confirmacao"]);

      // Antes do início, o funcionário trabalha normalmente.
      assert.equal((await amb.req("PUT", "/me/ranking-anonimo", { como: ana, json: { anonimo: true } })).status, 200);
      const acoes = (await amb.db.select().from(auditoria).where(eq(auditoria.entidadeId, id))).map((r) => r.acao).sort();
      assert.deepEqual(acoes, ["ausencia.aprovacao", "ausencia.confirmacao", "ausencia.pedido"]);
    });

    it("sem ajuste, aprovar mantém as datas; só o início novo mantém a duração", async () => {
      comeco();
      const a = await pedirDe(await novo());
      const sem = await amb.esperar(200, "POST", `/ausencias/${a}/aprovar`, { como: supervisor, json: ASSINA });
      assert.deepEqual([sem.ausencia.inicio, sem.ausencia.retorno], ["2026-10-20", "2026-11-03"]);
      assert.equal((await alertasDe((await lerAusencia(a)).usuarioId, "ausencia_aprovada"))[0]!.detalhe.includes("ajustadas"), false);
      const b = await pedirDe(await novo());
      const so = await amb.esperar(200, "POST", `/ausencias/${b}/aprovar`, { como: supervisor, json: { ...ASSINA, inicio: "2026-10-27" } });
      assert.deepEqual([so.ausencia.inicio, so.ausencia.retorno], ["2026-10-27", "2026-11-10"]);
    });

    it("toda ação assinada pede a confirmação da assinatura e a assinatura cadastrada no perfil", async () => {
      comeco();
      const ana = await novo();
      const id = await pedirDe(ana);
      const sem = await amb.req("POST", `/ausencias/${id}/aprovar`, { como: supervisor, json: {} });
      assert.equal(sem.status, 422);
      assert.equal((await amb.req("POST", `/ausencias/${id}/aprovar`, { como: supervisor, json: { assinar: false } })).status, 422);
      assert.equal((await lerAusencia(id)).estado, "pedida");

      // O supervisor sem assinatura cadastrada: o cadastro vem antes de qualquer ação (o bloqueio é da autenticação).
      const supSemAssinatura = await amb.criarUsuario({ perfil: "tecnico", comAssinatura: false });
      const eq2 = await amb.criarEquipe({ supervisorId: supSemAssinatura.id });
      const membro = await amb.criarUsuario({ perfil: "tecnico", equipeId: eq2.id });
      const pedido = (await amb.esperar(201, "POST", "/ausencias", { como: membro, json: { motivo: "Férias", inicio: "2026-10-20", dias: 3 } })).ausencia.id;
      const r = await acao(supSemAssinatura, pedido, "aprovar");
      assert.equal(r.status, 403);
      assert.equal(r.corpo.erro.codigo, "assinatura_pendente");
    });

    it("recusa com o motivo (assinada) e avisa o técnico; sem motivo é 422", async () => {
      comeco();
      const ana = await novo();
      const id = await pedirDe(ana);
      assert.equal((await acao(supervisor, id, "recusar", ASSINA)).status, 422);
      const r = await amb.esperar(200, "POST", `/ausencias/${id}/recusar`, { como: supervisor, json: { ...ASSINA, motivo: "Equipe desfalcada" } });
      assert.equal(r.ausencia.estado, "recusada");
      assert.ok(r.ausencia.encerrada_em);
      assert.match((await alertasDe(ana.id, "ausencia_recusada"))[0]!.detalhe, /Equipe desfalcada/);
      // O pedido recusado já não aceita outra ação.
      assert.equal((await acao(supervisor, id, "aprovar")).status, 409);
      // A pessoa pode pedir de novo: a recusada não conta na sobreposição.
      assert.equal((await pedir(ana, { motivo: "Outra vez", inicio: "2026-10-20", dias: 14 })).status, 201);
    });

    it("o técnico recusa o ajuste (assinando): o supervisor é avisado e o pedido termina recusado", async () => {
      comeco();
      const ana = await novo("Ana");
      const id = await pedirDe(ana);
      await amb.esperar(200, "POST", `/ausencias/${id}/aprovar`, { como: supervisor, json: { ...ASSINA, dias: 3 } });
      const r = await amb.esperar(200, "POST", `/ausencias/${id}/recusar-ajuste`, { como: ana, json: { ...ASSINA, motivo: "Preciso das duas semanas" } });
      assert.equal(r.ausencia.estado, "recusada");
      const aviso = (await alertasDe(supervisor.id, "ausencia_recusada")).find((a) => a.ausenciaId === id);
      assert.ok(aviso);
      assert.match(aviso.detalhe, /Preciso das duas semanas/);
    });

    it("o técnico cancela o pedido (pedido ou aprovado e ainda não confirmado), assinando", async () => {
      comeco();
      const ana = await novo();
      const id = await pedirDe(ana);
      const r = await amb.esperar(200, "POST", `/ausencias/${id}/cancelar`, { como: ana, json: ASSINA });
      assert.equal(r.ausencia.estado, "cancelada");
      assert.deepEqual(await atos(id), ["cancelamento", "pedido"]);
      const b = await pedirDe(ana);
      await acao(supervisor, b, "aprovar");
      assert.equal((await acao(ana, b, "cancelar")).status, 200);
    });

    it("quem pode o quê: técnico comum, supervisor de outra equipe e admin não respondem; o supervisor não confirma pelo técnico", async () => {
      comeco();
      const ana = await novo();
      const colega = await novo();
      const id = await pedirDe(ana);
      assert.equal((await acao(colega, id, "aprovar")).status, 404, "colega de equipe não enxerga o pedido");
      assert.equal((await acao(supervisorDeOutra, id, "aprovar")).status, 404);
      assert.equal((await acao(admin, id, "aprovar")).status, 403);
      assert.equal((await acao(admin, id, "recusar", { ...ASSINA, motivo: "x" })).status, 403);
      assert.equal((await acao(ana, id, "aprovar")).status, 403, "ninguém aprova o próprio pedido");
      assert.equal((await acao(supervisor, id, "cancelar")).status, 403);
      await acao(supervisor, id, "aprovar");
      assert.equal((await acao(supervisor, id, "confirmar")).status, 403);
      assert.equal((await acao(colega, id, "confirmar")).status, 404);
      assert.equal((await acao(ana, ID_INEXISTENTE, "confirmar")).status, 404);
      assert.equal((await acao(ana, id, "confirmar")).status, 200);
    });

    it("o pedido parado cuja data de retorno chega é cancelado pelo sistema, com o aviso às duas pessoas (e só uma vez)", async () => {
      comeco();
      const ana = await novo("Ana");
      const id = await pedirDe(ana, { inicio: "2026-10-16", dias: 2 });
      relogio(dia(3));
      assert.ok((await rodada()).canceladas >= 1);
      const a = await lerAusencia(id);
      assert.equal(a.estado, "cancelada");
      assert.equal(a.encerradaPor, null);
      assert.ok((await atos(id)).includes("cancelamento_automatico"));
      assert.equal((await alertasDe(ana.id, "ausencia_cancelada")).length, 1);
      assert.equal((await alertasDe(supervisor.id, "ausencia_cancelada")).filter((x) => x.ausenciaId === id).length, 1);
      assert.deepEqual(await rodada(), SEM_NADA, "a segunda rodada não repete nada");
      comeco();
    });
  });

  // ---- o registro pelo supervisor -------------------------------------------------------------------------------

  describe("o supervisor registra a ausência", () => {
    it("de alguém, sem pedido: nasce confirmada e assinada, e o técnico é avisado", async () => {
      comeco();
      const ana = await novo("Ana");
      const r = await amb.esperar(201, "POST", "/ausencias", { como: supervisor, json: { motivo: "Treinamento", inicio: "2026-10-18", dias: 3, usuario_id: ana.id, ...ASSINA } });
      assert.equal(r.ausencia.estado, "confirmada");
      assert.equal(r.ausencia.situacao, "agendada");
      assert.equal(r.ausencia.origem, "supervisor");
      assert.equal(r.ausencia.supervisor_id, supervisor.id);
      assert.deepEqual(await atos(r.ausencia.id), ["registro"]);
      assert.equal((await alertasDe(ana.id, "ausencia_registrada")).length, 1);
    });

    it("exige a assinatura; só o supervisor da equipe da pessoa registra (técnico comum, outra equipe e admin, não)", async () => {
      comeco();
      const ana = await novo();
      const corpo = { motivo: "Treinamento", inicio: "2026-10-18", dias: 3, usuario_id: ana.id };
      assert.equal((await pedir(supervisor, corpo)).corpo.erro.codigo, "assinatura_obrigatoria");
      assert.equal((await pedir(supervisor, { ...corpo, assinar: false })).status, 422);
      assert.equal((await pedir(supervisorDeOutra, { ...corpo, ...ASSINA })).status, 403);
      assert.equal((await pedir(await novo(), { ...corpo, ...ASSINA })).status, 403);
      assert.equal((await pedir(admin, { ...corpo, ...ASSINA })).status, 403);
      const naoTecnico = await pedir(supervisor, { ...corpo, usuario_id: admin.id, ...ASSINA });
      assert.equal(naoTecnico.status, 403);
      assert.equal((await pedir(supervisor, { ...corpo, usuario_id: ID_INEXISTENTE, ...ASSINA })).status, 404);
      const inativo = await amb.criarUsuario({ perfil: "tecnico", equipeId, ativo: false });
      assert.equal((await pedir(supervisor, { ...corpo, usuario_id: inativo.id, ...ASSINA })).corpo.erro.codigo, "usuario_invalido");
      assert.equal((await amb.db.select().from(ausencia).where(eq(ausencia.usuarioId, ana.id))).length, 0);
    });

    it("a própria ausência do supervisor vale na hora, e o aviso de execução aberta vem na resposta", async () => {
      comeco();
      const sup = await amb.criarUsuario({ perfil: "tecnico", nome: "Supervisor da Vez" });
      const eq2 = await amb.criarEquipe({ supervisorId: sup.id });
      const r = await amb.esperar(201, "POST", "/ausencias", { como: sup, json: { motivo: "Viagem", inicio: "2026-10-30", dias: 4, ...ASSINA } });
      assert.equal(r.ausencia.origem, "propria");
      assert.equal(r.ausencia.estado, "confirmada");
      assert.equal(r.ausencia.equipe_id, eq2.id);
      assert.equal(r.ausencia.supervisor_id, sup.id);
      assert.equal((await pedir(sup, { motivo: "Viagem", inicio: "2026-10-31", dias: 1, ...ASSINA })).corpo.erro.codigo, "ausencia_sobreposta");
    });
  });

  // ---- o ausente só visualiza -----------------------------------------------------------------------------------

  describe("o bloqueio do ausente", () => {
    it("começada a ausência, só visualiza: alterar é 403 usuario_ausente, ler segue valendo", async () => {
      comeco();
      const ana = await novo("Ana");
      const id = await registrar(ana, { inicio: "2026-10-15", dias: 10 });
      assert.equal((await lerAusencia(id)).estado, "confirmada");

      for (const [metodo, caminho, json] of [
        ["PUT", "/me/ranking-anonimo", { anonimo: true }],
        ["PUT", "/me/treinamento", { estado: "pulado" }],
        ["POST", "/aprs/avaliar", {}],
        ["POST", "/ausencias", { motivo: "Outra", inicio: "2026-11-30", dias: 2 }],
        ["POST", `/os/${ID_INEXISTENTE}/devolver`, { justificativa: "x" }],
      ] as const) {
        const r = await amb.req(metodo, caminho, { como: ana, json });
        assert.equal(r.status, 403, `${metodo} ${caminho}`);
        assert.equal(r.corpo.erro.codigo, "usuario_ausente", `${metodo} ${caminho}`);
        assert.match(r.corpo.erro.mensagem, /ausente até 25\/10\/2026/);
      }
      assert.equal((await amb.req("GET", "/me", { como: ana })).status, 200);
      assert.equal((await amb.req("GET", "/os", { como: ana })).status, 200);
      assert.equal((await amb.req("GET", "/ausencias", { como: ana })).status, 200);
      assert.equal((await amb.req("POST", "/sync/pull", { como: ana, json: {} })).status, 200);
      assert.equal((await amb.req("PUT", "/me/ranking-anonimo", { como: ana, json: { anonimo: true } })).status, 403);
      assert.equal((await amb.req("PUT", "/me/ranking-anonimo", { como: await novo(), json: { anonimo: true } })).status, 200);
    });

    it("pode sair, trocar a senha e marcar os avisos como lidos", async () => {
      comeco();
      const ana = await novo();
      const id = await registrar(ana);
      const [aviso] = await alertasDe(ana.id, "ausencia_registrada");
      const lista = await amb.esperar(200, "GET", "/alertas", { como: ana });
      assert.equal(lista.alertas.length, 1);
      assert.equal(lista.alertas[0].ausencia_id, id);
      assert.equal(lista.alertas[0].usuario_alvo_id, ana.id);
      assert.equal(typeof lista.alertas[0].usuario_alvo_nome, "string");
      assert.equal(lista.alertas[0].ausencia_equipe_id, equipeId);
      await amb.esperar(200, "PATCH", `/alertas/${aviso!.id}`, { como: ana, json: { lido: true } });
      assert.ok((await amb.db.select().from(alerta).where(eq(alerta.id, aviso!.id)))[0]!.lidoEm);
      assert.equal((await amb.req("POST", "/auth/trocar-senha", { como: ana, json: { senha_atual: ana.senha, senha_nova: "outra-senha-de-teste-9" } })).status, 200);
      assert.equal((await amb.req("POST", "/auth/sair", { como: ana })).status, 200);
    });

    it("agendada ainda não bloqueia; no dia do início passa a bloquear, e o encerramento libera na hora", async () => {
      comeco();
      const ana = await novo();
      const id = await registrar(ana, { inicio: "2026-10-18", dias: 2 });
      assert.equal((await amb.req("PUT", "/me/ranking-anonimo", { como: ana, json: { anonimo: true } })).status, 200);
      relogio(dia(3));
      assert.equal((await amb.req("PUT", "/me/ranking-anonimo", { como: ana, json: { anonimo: false } })).status, 403);
      await amb.esperar(200, "POST", `/ausencias/${id}/encerrar`, { como: supervisor, json: ASSINA });
      assert.equal((await amb.req("PUT", "/me/ranking-anonimo", { como: ana, json: { anonimo: false } })).status, 200);
      comeco();
    });

    it("o selo aparece em /me, nas listas de pessoas, no perfil, na equipe e no snapshot", async () => {
      comeco();
      const ana = await novo("Ana Ausente");
      await registrar(ana, { inicio: "2026-10-15", dias: 5 });
      const me = await amb.esperar(200, "GET", "/me", { como: ana });
      assert.equal(me.ausencia.situacao, "em_curso");
      assert.equal(me.ausencia.retorno, "2026-10-20");
      assert.equal(me.ausencia.rotulo, "Ausente até 20/10/2026");
      assert.equal(me.usuario.ausencia.rotulo, "Ausente até 20/10/2026");
      const lista = await amb.esperar(200, "GET", "/usuarios", { como: supervisor, consulta: { equipe_id: equipeId, tamanho: 100 } });
      assert.equal(lista.usuarios.find((u: any) => u.id === ana.id).ausencia.situacao, "em_curso");
      assert.equal(lista.usuarios.find((u: any) => u.id === supervisor.id).ausencia, null);
      const perfil = await amb.esperar(200, "GET", `/usuarios/${ana.id}`, { como: supervisor });
      assert.equal(perfil.usuario.ausencia.rotulo, "Ausente até 20/10/2026");
      const equipe = await amb.esperar(200, "GET", `/equipes/${equipeId}`, { como: supervisor });
      assert.equal(equipe.membros.find((m: any) => m.id === ana.id).ausencia.rotulo, "Ausente até 20/10/2026");
      const colega = await novo();
      const snap = await amb.esperar(200, "POST", "/sync/pull", { como: colega, json: {} });
      assert.equal(snap.usuarios.find((u: any) => u.id === ana.id).ausencia.situacao, "em_curso");
      assert.equal(snap.minha_ausencia, null);
      const doAusente = await amb.esperar(200, "POST", "/sync/pull", { como: ana, json: {} });
      assert.equal(doAusente.minha_ausencia.retorno, "2026-10-20");
      // Quem não está ausente não tem selo.
      assert.equal((await amb.esperar(200, "GET", "/me", { como: colega })).ausencia, null);
    });
  });

  // ---- reserva, APR e execução ----------------------------------------------------------------------------------

  describe("reserva de OS, APR e execução aberta", () => {
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
    const reservar = (osId: string, usuarioId: string) => amb.req("PUT", `/os/${osId}/responsavel`, { como: supervisor, json: { usuario_id: usuarioId } });

    it("no início da ausência a reserva cai para a equipe toda, e a linha do tempo da OS conta", async () => {
      comeco();
      const ana = await novo("Ana Souza");
      const beto = await novo("Beto Lima");
      const o = await novaOs();
      const outra = await novaOs({ status: "pendente" });
      const deBeto = await novaOs();
      await reservar(o.id, ana.id);
      await reservar(outra.id, ana.id);
      await reservar(deBeto.id, beto.id);

      await registrar(ana, { inicio: "2026-10-15", dias: 3 });
      for (const x of [o, outra]) {
        const depois = await lerOs(x.id);
        assert.deepEqual([depois.responsavelId, depois.reservadaPor, depois.reservadaEm], [null, null, null]);
      }
      assert.equal((await lerOs(deBeto.id)).responsavelId, beto.id, "a reserva dos outros não muda");
      const detalhe = await amb.esperar(200, "GET", `/os/${o.id}`, { como: beto });
      assert.equal(detalhe.os.responsavel, null);
      const linha = detalhe.linha_do_tempo.find((e: any) => e.tipo === "reserva_desfeita");
      assert.equal(linha.descricao, "Reserva desfeita: ausência de Ana Souza");
    });

    it("o ausente não pode ser escolhido como responsável (responsavel_ausente), e agendada ainda pode", async () => {
      comeco();
      const ana = await novo();
      const bia = await novo();
      await registrar(ana, { inicio: "2026-10-15", dias: 3 });
      await registrar(bia, { inicio: "2026-10-20", dias: 3 });
      const o = await novaOs();
      const r = await reservar(o.id, ana.id);
      assert.equal(r.status, 422);
      assert.equal(r.corpo.erro.codigo, "responsavel_ausente");
      assert.equal((await lerOs(o.id)).responsavelId, null);
      assert.equal((await reservar(o.id, bia.id)).status, 200);
    });

    it("o ausente não entra em APR (participante_ausente); o ausente em ação própria é recusado na hora", async () => {
      comeco();
      const ana = await novo("Ana");
      const beto = await novo("Beto");
      await registrar(ana, { inicio: "2026-10-15", dias: 3 });
      const o = await novaOs();
      const r = await enviar(beto, evento("apr_concluida", payloadApr([beto, ana]), o.id));
      assert.deepEqual(r.confirmados, []);
      assert.equal(r.rejeitados[0].codigo, "participante_ausente");
      assert.match(r.rejeitados[0].mensagem, /Ana/);
      const { evidencias: _e, id: _id, ...paraAvaliar } = payloadApr([beto, ana]);
      const v = await amb.req("POST", "/aprs/avaliar", { como: beto, json: { ...paraAvaliar, id: randomUUID(), os_id: o.id } });
      assert.equal(v.corpo.erro.codigo, "participante_ausente");
      // Sem a Ana, a APR passa.
      assert.equal((await enviar(beto, evento("apr_concluida", payloadApr([beto]), o.id))).confirmados.length, 1);
    });

    it("a execução aberta é suspensa no início (a OS fica pendente), e o supervisor é avisado na resposta do registro", async () => {
      comeco();
      const ana = await novo("Ana");
      const o = await novaOs();
      const p = payloadApr([ana]);
      await enviar(ana, evento("apr_concluida", p, o.id));
      const execId = randomUUID();
      const e = await enviar(ana, evento("execucao_iniciada", { id: execId, apr_id: p.id, inicio: agora() }, o.id));
      assert.deepEqual(e.os, [{ id: o.id, status: "em_execucao" }]);
      await enviar(ana, evento("pausa_iniciada", { id: randomUUID(), execucao_id: execId, inicio: agora(), motivo: "almoco" }, o.id));

      relogio(new Date(HOJE.getTime() + 60_000));
      const r = await amb.esperar(201, "POST", "/ausencias", { como: supervisor, json: { motivo: "Atestado", inicio: "2026-10-15", dias: 2, usuario_id: ana.id, ...ASSINA } });
      assert.equal(r.execucao_aberta, true);
      const [depois] = await amb.db.select().from(execucao).where(eq(execucao.id, execId));
      assert.equal(depois!.resultado, "suspensa");
      assert.deepEqual(depois!.fim, amb.relogio.agora);
      assert.equal((await amb.sql("select 1 from execucao_pausa where execucao_id = $1 and fim is null", [execId])).length, 0, "a pausa aberta é fechada");
      assert.equal((await lerOs(o.id)).status, "pendente");
      // A equipe a retoma com uma APR nova.
      const beto = await novo("Beto");
      const nova = payloadApr([beto], agora());
      assert.equal((await enviar(beto, evento("apr_concluida", nova, o.id))).confirmados.length, 1);
      comeco();
    });

    it("a fila offline: o que foi feito antes do início da ausência é aceito, o que veio depois é recusado", async () => {
      comeco();
      const ana = await novo("Ana");
      await registrar(ana, { inicio: "2026-10-15", dias: 3 }); // começa às 0h de 15/10 em São Paulo (03:00Z)
      const o = await novaOs();
      const antes = "2026-10-14T20:00:00Z";
      const depois = "2026-10-15T14:00:00Z";
      const doPassado = payloadApr([ana], antes);
      const dePresente = payloadApr([ana], depois);
      const r = await enviar(ana, evento("apr_concluida", doPassado, o.id, antes), evento("apr_concluida", dePresente, o.id, depois));
      assert.deepEqual(r.confirmados.length, 1);
      assert.equal(r.aprs[0].id, doPassado.id);
      assert.equal(r.rejeitados[0].codigo, "usuario_ausente");
      // Os arquivos da fila também sobem.
      const form = new FormData();
      form.set("arquivo", new File(["x"], "x.png", { type: "image/png" }));
      form.set("tipo", "foto");
      assert.equal((await amb.req("PUT", `/arquivos/${randomUUID()}`, { como: ana, form })).status, 200);
    });
  });

  // ---- durante a ausência -----------------------------------------------------------------------------------------

  describe("durante a ausência", () => {
    it("a ausência não termina sozinha: passada a data de retorno ela fica vencida, o supervisor é avisado (uma vez) e o ausente segue só visualizando", async () => {
      comeco();
      const ana = await novo("Ana");
      const id = await registrar(ana, { inicio: "2026-10-15", dias: 2 }); // retorno 17/10
      relogio(dia(1));
      await rodada();
      assert.equal((await lerAusencia(id)).vencidaAvisadaEm, null);
      assert.equal((await amb.esperar(200, "GET", `/ausencias/${id}`, { como: ana })).ausencia.situacao, "em_curso");

      relogio(dia(2));
      assert.equal((await amb.esperar(200, "GET", `/ausencias/${id}`, { como: ana })).ausencia.situacao, "vencida");
      assert.ok((await rodada()).vencidas >= 1);
      assert.deepEqual(await rodada(), SEM_NADA, "a segunda rodada não repete nada");
      const avisos = (await alertasDe(supervisor.id, "ausencia_vencida")).filter((a) => a.ausenciaId === id);
      assert.equal(avisos.length, 1);
      assert.match(avisos[0]!.detalhe, /venceu/);

      const me = await amb.esperar(200, "GET", "/me", { como: ana });
      assert.equal(me.ausencia.situacao, "vencida");
      assert.match(me.ausencia.rotulo, /Ausência vencida desde 17\/10\/2026/);
      const r = await amb.req("PUT", "/me/ranking-anonimo", { como: ana, json: { anonimo: true } });
      assert.equal(r.status, 403);
      assert.match(r.corpo.erro.mensagem, /^Você está ausente: /);
      comeco();
    });

    it("o ausente confirma o retorno (assinando) só depois da data; a conta volta ao normal na hora", async () => {
      comeco();
      const ana = await novo("Ana");
      const id = await registrar(ana, { inicio: "2026-10-15", dias: 2 });
      const cedo = await acao(ana, id, "confirmar-retorno");
      assert.equal(cedo.status, 409);
      assert.equal(cedo.corpo.erro.codigo, "ausencia_nao_vencida");
      relogio(dia(2));
      assert.equal((await acao(ana, id, "confirmar-retorno", {})).status, 422, "pede a assinatura");
      assert.equal((await acao(supervisor, id, "confirmar-retorno")).status, 403, "só o ausente confirma");
      const r = await amb.esperar(200, "POST", `/ausencias/${id}/confirmar-retorno`, { como: ana, json: ASSINA });
      assert.equal(r.ausencia.estado, "encerrada");
      assert.equal(r.ausencia.forma_encerramento, "retorno");
      assert.equal((await amb.req("PUT", "/me/ranking-anonimo", { como: ana, json: { anonimo: true } })).status, 200);
      assert.equal((await amb.esperar(200, "GET", "/me", { como: ana })).ausencia, null);
      assert.equal((await acao(ana, id, "confirmar-retorno")).status, 409);
      comeco();
    });

    it("fim antecipado: o ausente pede (assinando), o supervisor aprova (hoje encerra na hora)", async () => {
      comeco();
      const ana = await novo("Ana");
      const id = await registrar(ana, { inicio: "2026-10-15", dias: 10 });
      const pedido = await amb.esperar(200, "POST", `/ausencias/${id}/pedir-fim`, { como: ana, json: { ...ASSINA, data: "2026-10-15" } });
      assert.equal(pedido.ausencia.fim_pedido_data, "2026-10-15");
      assert.equal((await alertasDe(supervisor.id, "ausencia_fim_pedido")).filter((a) => a.ausenciaId === id).length, 1);
      assert.equal((await acao(ana, id, "pedir-fim", { ...ASSINA, data: "2026-10-16" })).corpo.erro.codigo, "fim_ja_pedido");
      assert.equal((await acao(ana, id, "responder-fim", { ...ASSINA, aprovar: true })).status, 403);

      const r = await amb.esperar(200, "POST", `/ausencias/${id}/responder-fim`, { como: supervisor, json: { ...ASSINA, aprovar: true } });
      assert.equal(r.terminou, true);
      assert.equal(r.ausencia.estado, "encerrada");
      assert.equal(r.ausencia.forma_encerramento, "antecipada");
      assert.equal(r.ausencia.fim_pedido_data, null);
      assert.equal((await alertasDe(ana.id, "ausencia_fim_respondido")).length, 1);
      assert.equal((await amb.req("PUT", "/me/ranking-anonimo", { como: ana, json: { anonimo: true } })).status, 200);
      assert.deepEqual(await atos(id), ["fim_aprovado", "fim_pedido", "inicio", "registro"]);
    });

    it("fim antecipado para um dia à frente: o retorno passa a ser essa data; recusado, nada muda; datas fora do período são 422", async () => {
      comeco();
      const ana = await novo();
      const id = await registrar(ana, { inicio: "2026-10-15", dias: 10 }); // retorno 25/10
      for (const data of ["2026-10-14", "2026-10-25", "2026-11-01"]) {
        assert.equal((await acao(ana, id, "pedir-fim", { ...ASSINA, data })).corpo.erro.codigo, "data_invalida", data);
      }
      await amb.esperar(200, "POST", `/ausencias/${id}/pedir-fim`, { como: ana, json: { ...ASSINA, data: "2026-10-20" } });
      const recusado = await amb.esperar(200, "POST", `/ausencias/${id}/responder-fim`, { como: supervisor, json: { ...ASSINA, aprovar: false, motivo: "Ainda precisamos de você fora" } });
      assert.equal(recusado.ausencia.retorno, "2026-10-25");
      assert.equal(recusado.ausencia.fim_pedido_em, null);
      assert.match((await alertasDe(ana.id, "ausencia_fim_respondido"))[0]!.detalhe, /Ainda precisamos/);
      assert.equal((await acao(supervisor, id, "responder-fim", { ...ASSINA, aprovar: true })).corpo.erro.codigo, "sem_pedido_de_fim");

      await amb.esperar(200, "POST", `/ausencias/${id}/pedir-fim`, { como: ana, json: { ...ASSINA, data: "2026-10-20" } });
      const aprovado = await amb.esperar(200, "POST", `/ausencias/${id}/responder-fim`, { como: supervisor, json: { ...ASSINA, aprovar: true } });
      assert.equal(aprovado.terminou, false);
      assert.equal(aprovado.ausencia.retorno, "2026-10-20");
      assert.equal(aprovado.ausencia.situacao, "em_curso");
    });

    it("fim antecipado só vale na ausência em curso, e quem registrou a própria não pede", async () => {
      comeco();
      const ana = await novo();
      const id = await registrar(ana, { inicio: "2026-10-20", dias: 3 });
      assert.equal((await acao(ana, id, "pedir-fim", { ...ASSINA, data: "2026-10-21" })).corpo.erro.codigo, "ausencia_estado_invalido");
      const sup = await amb.criarUsuario({ perfil: "tecnico" });
      await amb.criarEquipe({ supervisorId: sup.id });
      const propria = (await amb.esperar(201, "POST", "/ausencias", { como: sup, json: { motivo: "Viagem", inicio: "2026-10-15", dias: 5, ...ASSINA } })).ausencia.id;
      assert.equal((await acao(sup, propria, "pedir-fim", { ...ASSINA, data: "2026-10-16" })).corpo.erro.codigo, "ausencia_propria");
    });

    it("o supervisor prorroga a ausência, inclusive a vencida, e o ausente é avisado", async () => {
      comeco();
      const ana = await novo("Ana");
      const id = await registrar(ana, { inicio: "2026-10-15", dias: 1 }); // retorno 16/10
      relogio(dia(1));
      await rodada();
      assert.equal((await lerAusencia(id)).vencidaAvisadaEm !== null, true);

      const igual = await acao(supervisor, id, "prorrogar", { ...ASSINA, retorno: "2026-10-16" });
      assert.equal(igual.status, 422);
      const passado = await acao(supervisor, id, "prorrogar", { ...ASSINA, retorno: "2026-10-16" });
      assert.equal(passado.status, 422);
      const r = await amb.esperar(200, "POST", `/ausencias/${id}/prorrogar`, { como: supervisor, json: { ...ASSINA, retorno: "2026-10-20", motivo: "Atestado prorrogado" } });
      assert.equal(r.ausencia.retorno, "2026-10-20");
      assert.equal(r.ausencia.situacao, "em_curso");
      assert.equal((await lerAusencia(id)).vencidaAvisadaEm, null, "pode avisar de novo quando vencer outra vez");
      assert.match((await alertasDe(ana.id, "ausencia_alterada"))[0]!.detalhe, /Atestado prorrogado/);
      assert.ok((await atos(id)).includes("prorrogacao"));
      assert.equal((await acao(ana, id, "prorrogar", { ...ASSINA, retorno: "2026-10-30" })).status, 403, "o ausente não se prorroga");
      assert.equal((await acao(admin, id, "prorrogar", { ...ASSINA, retorno: "2026-10-30" })).status, 403);
      comeco();
    });

    it("a prorrogação não pode invadir a ausência seguinte da pessoa", async () => {
      comeco();
      const ana = await novo();
      const id = await registrar(ana, { inicio: "2026-10-15", dias: 3 });
      await registrar(ana, { inicio: "2026-10-25", dias: 3 });
      assert.equal((await acao(supervisor, id, "prorrogar", { ...ASSINA, retorno: "2026-10-26" })).corpo.erro.codigo, "ausencia_sobreposta");
      assert.equal((await acao(supervisor, id, "prorrogar", { ...ASSINA, retorno: "2026-10-25" })).status, 200);
    });

    it("o supervisor encerra a qualquer momento, assinando, e o ausente é avisado", async () => {
      comeco();
      const ana = await novo();
      const id = await registrar(ana, { inicio: "2026-10-15", dias: 10 });
      assert.equal((await acao(ana, id, "encerrar")).status, 403);
      assert.equal((await acao(supervisorDeOutra, id, "encerrar")).status, 404);
      assert.equal((await acao(supervisor, id, "encerrar", {})).status, 422);
      const r = await amb.esperar(200, "POST", `/ausencias/${id}/encerrar`, { como: supervisor, json: { ...ASSINA, motivo: "Voltou antes" } });
      assert.equal(r.ausencia.estado, "encerrada");
      assert.equal(r.ausencia.forma_encerramento, "supervisor");
      assert.equal((await alertasDe(ana.id, "ausencia_alterada")).length, 1);
      assert.equal((await acao(supervisor, id, "encerrar")).status, 409);
      assert.equal((await amb.req("PUT", "/me/ranking-anonimo", { como: ana, json: { anonimo: true } })).status, 200);
    });

    it("o supervisor ausente não age pela equipe, mas encerra a própria ausência em emergência", async () => {
      comeco();
      const sup = await amb.criarUsuario({ perfil: "tecnico", nome: "Supervisor Ausente" });
      const eq2 = await amb.criarEquipe({ supervisorId: sup.id });
      const membro = await amb.criarUsuario({ perfil: "tecnico", equipeId: eq2.id });
      const pedido = (await amb.esperar(201, "POST", "/ausencias", { como: membro, json: { motivo: "Férias", inicio: "2026-10-20", dias: 3 } })).ausencia.id;
      const propria = (await amb.esperar(201, "POST", "/ausencias", { como: sup, json: { motivo: "Viagem", inicio: "2026-10-15", dias: 5, ...ASSINA } })).ausencia.id;

      const naoAge = await acao(sup, pedido, "aprovar");
      assert.equal(naoAge.status, 403);
      assert.equal(naoAge.corpo.erro.codigo, "usuario_ausente");
      assert.equal((await acao(sup, pedido, "prorrogar", { ...ASSINA, retorno: "2026-10-30" })).corpo.erro.codigo, "usuario_ausente");
      assert.equal((await amb.req("POST", "/ausencias", { como: sup, json: { motivo: "x", inicio: "2026-10-20", dias: 1, usuario_id: membro.id, ...ASSINA } })).corpo.erro.codigo, "usuario_ausente");
      // O pedido do membro espera ele voltar; o aviso continua indo para ele.
      assert.equal((await lerAusencia(pedido)).estado, "pedida");
      assert.equal((await alertasDe(sup.id, "ausencia_pedida")).length, 1);

      const r = await amb.esperar(200, "POST", `/ausencias/${propria}/encerrar`, { como: sup, json: { ...ASSINA, motivo: "Emergência na empresa" } });
      assert.equal(r.ausencia.forma_encerramento, "emergencia");
      assert.equal((await acao(sup, pedido, "aprovar")).status, 200, "voltou: age de novo pela equipe");
    });

    it("o supervisor prorroga a própria ausência sem esperar ninguém", async () => {
      comeco();
      const sup = await amb.criarUsuario({ perfil: "tecnico" });
      await amb.criarEquipe({ supervisorId: sup.id });
      const id = (await amb.esperar(201, "POST", "/ausencias", { como: sup, json: { motivo: "Viagem", inicio: "2026-10-15", dias: 2, ...ASSINA } })).ausencia.id;
      const r = await amb.esperar(200, "POST", `/ausencias/${id}/prorrogar`, { como: sup, json: { ...ASSINA, retorno: "2026-10-22" } });
      assert.equal(r.ausencia.retorno, "2026-10-22");
      assert.equal((await alertasDe(sup.id, "ausencia_alterada")).length, 0);
    });
  });

  // ---- tarefa periódica -----------------------------------------------------------------------------------------

  describe("a tarefa periódica", () => {
    it("aplica o início das ausências que começaram, uma só vez (a subida e a rodada não repetem)", async () => {
      comeco();
      const ana = await novo("Ana");
      const o = (await amb.db.insert(os).values({ numeroOrdem: String(++contadorOs), tipo: "corretiva", titulo: "DCV", localInstalacaoId: localId, equipeId, dataInicioProg: "2026-10-16", origem: "sap", responsavelId: ana.id, reservadaPor: supervisor.id, reservadaEm: HOJE }).returning())[0]!;
      const id = await registrar(ana, { inicio: "2026-10-17", dias: 2 });
      assert.equal((await amb.db.select().from(os).where(eq(os.id, o.id)))[0]!.responsavelId, ana.id, "agendada: a reserva continua");
      assert.equal((await lerAusencia(id)).inicioAplicadoEm, null);

      relogio(dia(2));
      assert.ok((await rodada()).iniciadas >= 1);
      assert.equal((await amb.db.select().from(os).where(eq(os.id, o.id)))[0]!.responsavelId, null);
      assert.ok((await lerAusencia(id)).inicioAplicadoEm);
      assert.deepEqual(await rodada(), SEM_NADA, "a segunda rodada não repete nada");
      assert.equal((await atos(id)).filter((t) => t === "inicio").length, 1);
      const linha = (await amb.esperar(200, "GET", `/os/${o.id}`, { como: supervisor })).linha_do_tempo.filter((e: any) => e.tipo === "reserva_desfeita");
      assert.equal(linha.length, 1);
      comeco();
    });

    it("a ausência registrada para hoje já aplica o início na hora (sem esperar a rodada)", async () => {
      comeco();
      const ana = await novo();
      const id = await registrar(ana, { inicio: "2026-10-15", dias: 2 });
      assert.ok((await lerAusencia(id)).inicioAplicadoEm);
      assert.deepEqual(await rodada(), SEM_NADA);
    });
  });

  // ---- consulta -----------------------------------------------------------------------------------------------------

  describe("GET /ausencias", () => {
    it("cada um vê as suas e, o supervisor, as da equipe; outra equipe não; o admin só consulta (vê todas)", async () => {
      comeco();
      const eqX = (await amb.criarEquipe()).id;
      const supX = await amb.criarUsuario({ perfil: "tecnico", equipeId: eqX, supervisor: true });
      const ana = await amb.criarUsuario({ perfil: "tecnico", equipeId: eqX });
      const bia = await amb.criarUsuario({ perfil: "tecnico", equipeId: eqX });
      await amb.esperar(201, "POST", "/ausencias", { como: ana, json: { motivo: "Férias", inicio: "2026-10-20", dias: 3 } });
      const daBia = (await amb.esperar(201, "POST", "/ausencias", { como: supX, json: { motivo: "Atestado", inicio: "2026-10-15", dias: 3, usuario_id: bia.id, ...ASSINA } })).ausencia.id;

      const ids = (r: any) => r.ausencias.map((a: any) => a.usuario_id).sort();
      assert.deepEqual(ids(await amb.esperar(200, "GET", "/ausencias", { como: ana })), [ana.id]);
      assert.deepEqual(ids(await amb.esperar(200, "GET", "/ausencias", { como: supX })), [ana.id, bia.id].sort());
      assert.deepEqual(ids(await amb.esperar(200, "GET", "/ausencias", { como: supervisorDeOutra })), []);
      const todas = await amb.esperar(200, "GET", "/ausencias", { como: admin, consulta: { tamanho: 100 } });
      assert.ok(todas.total >= 2);

      const emCurso = await amb.esperar(200, "GET", "/ausencias", { como: supX, consulta: { situacao: "em_curso" } });
      assert.deepEqual(emCurso.ausencias.map((a: any) => a.id), [daBia]);
      const pedidas = await amb.esperar(200, "GET", "/ausencias", { como: supX, consulta: { situacao: "pedida" } });
      assert.deepEqual(ids(pedidas), [ana.id]);
      assert.equal((await amb.req("GET", "/ausencias", { como: supX, consulta: { situacao: "inventada" } })).status, 422);
      const abertas = await amb.esperar(200, "GET", "/ausencias", { como: supX, consulta: { abertas: true } });
      assert.equal(abertas.total, 2);
    });

    it("o detalhe traz a linha do tempo dos atos; quem não enxerga a ausência recebe 404; o admin consulta", async () => {
      comeco();
      const ana = await novo("Ana");
      const colega = await novo();
      const id = (await amb.esperar(201, "POST", "/ausencias", { como: ana, json: { motivo: "Férias", inicio: "2026-10-20", dias: 3 } })).ausencia.id;
      relogio(new Date(HOJE.getTime() + 60_000));
      await acao(supervisor, id, "aprovar");
      const r = await amb.esperar(200, "GET", `/ausencias/${id}`, { como: ana });
      comeco();
      assert.deepEqual(r.ausencia.atos.map((a: any) => [a.tipo, a.autor_nome, a.assinado]), [["pedido", "Ana", false], ["aprovacao", "Sônia Supervisora", true]]);
      assert.equal((await amb.req("GET", `/ausencias/${id}`, { como: colega })).status, 404);
      assert.equal((await amb.req("GET", `/ausencias/${id}`, { como: supervisorDeOutra })).status, 404);
      assert.equal((await amb.req("GET", `/ausencias/${id}`, { como: admin })).status, 200);
      assert.equal((await amb.req("GET", "/ausencias/nao-e-uuid", { como: ana })).status, 404);
      assert.equal((await amb.req("GET", "/ausencias")).status, 401);
    });
  });

  it("quem não cadastrou a assinatura não pede nem confirma nada: o bloqueio vem antes de qualquer ação", async () => {
    comeco();
    const r = await amb.req("POST", "/ausencias", { como: semAssinatura, json: { motivo: "Férias", inicio: "2026-10-20", dias: 3 } });
    assert.equal(r.status, 403);
    assert.equal(r.corpo.erro.codigo, "assinatura_pendente");
    // Cadastrando a assinatura, o pedido passa.
    await amb.cadastrarAssinatura(semAssinatura);
    await amb.esperar(201, "POST", "/ausencias", { como: semAssinatura, json: { motivo: "Férias", inicio: "2026-10-20", dias: 3 } });
  });

  it("o banco recusa o que as regras proíbem (retorno antes do início, estado sem encerramento)", async () => {
    comeco();
    const ana = await novo();
    const base = { usuarioId: ana.id, equipeId, motivo: "x", inicio: "2026-10-20", retorno: "2026-10-22", estado: "pedida" as const, origem: "pedido" as const };
    await assert.rejects(amb.db.insert(ausencia).values({ ...base, retorno: "2026-10-20" }));
    await assert.rejects(amb.db.insert(ausencia).values({ ...base, estado: "encerrada" }));
    await assert.rejects(amb.db.insert(ausencia).values({ ...base, estado: "confirmada" }), (e: any) => /ausencia_supervisor_check/.test(String(e.cause?.message)));
    assert.equal((await amb.db.select().from(alerta).where(and(eq(alerta.usuarioAlvoId, ana.id)))).length, 0);
  });
});
