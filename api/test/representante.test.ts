import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { alerta, auditoria, equipe, usuario } from "../src/db/schema";
import { DIAS_SEM_ATIVIDADE, garantirRepresentantes, representacoesEmVigor, sincronizarRepresentacao } from "../src/dominio/representacao";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

const HOJE = new Date("2026-10-15T15:00:00Z"); // 12h em São Paulo
const dia = (n: number) => new Date(HOJE.getTime() + n * 86_400_000);
const ASSINA = { assinar: true };

describe("Representante da equipe", () => {
  let amb: Ambiente;
  let contador = 0;

  before(async () => {
    amb = await criarAmbiente({ relogio: HOJE, duracaoDoTokenSeg: 90 * 86_400 });
  });
  after(() => amb.fechar());

  const relogio = (d: Date) => (amb.relogio.agora = d);

  /** Uma equipe nova: o supervisor, o representante escolhido pela `api` (o primeiro pelo nome) e dois técnicos. */
  async function montar() {
    relogio(HOJE);
    contador++;
    const supervisor = await amb.criarUsuario({ perfil: "tecnico", nome: `Sônia Supervisora ${contador}` });
    const e = await amb.criarEquipe({ supervisorId: supervisor.id });
    await amb.db.update(usuario).set({ equipeId: e.id }).where(eq(usuario.id, supervisor.id));
    const representante = await amb.criarUsuario({ perfil: "tecnico", equipeId: e.id, nome: `Ana Representante ${contador}` });
    const bruno = await amb.criarUsuario({ perfil: "tecnico", equipeId: e.id, nome: `Bruno Técnico ${contador}` });
    const carla = await amb.criarUsuario({ perfil: "tecnico", equipeId: e.id, nome: `Carla Técnica ${contador}` });
    const admin = await amb.criarUsuario({ perfil: "admin" });
    await garantirRepresentantes(amb.db, [e.id]);
    // O relógio dos testes anda; o instante "real" do banco não: a última atividade de cada um parte do dia do teste.
    await amb.db.update(usuario).set({ ultimaAtividadeEm: HOJE }).where(eq(usuario.equipeId, e.id));
    return { equipeId: e.id, supervisor, representante, bruno, carla, admin };
  }

  const lerEquipe = async (id: string) => (await amb.db.select().from(equipe).where(eq(equipe.id, id)))[0]!;
  const alertasDe = async (destinatarioId: string, tipo: string) =>
    (await amb.db.select().from(alerta).where(and(eq(alerta.destinatarioId, destinatarioId), eq(alerta.tipo, tipo as never)))).length;
  const meus = async (como: UsuarioDeTeste) => (await amb.esperar(200, "GET", "/me", { como })) as { equipes_supervisionadas: { id: string }[]; equipes_representadas: { id: string; motivo: string; supervisor_nome: string }[] };

  /** O supervisor registra a própria ausência (vale na hora quando começa hoje). */
  const ausentar = (supervisor: UsuarioDeTeste, json: object = { inicio: "2026-10-15", dias: 10 }) =>
    amb.esperar(201, "POST", "/ausencias", { como: supervisor, json: { motivo: "Férias", ...ASSINA, ...json } });

  describe("a escolha do representante", () => {
    it("toda equipe com gente ganha um: o técnico mais antigo que não é o supervisor", async () => {
      const t = await montar();
      const e = await lerEquipe(t.equipeId);
      assert.equal(e.representanteId, t.representante.id);
      assert.notEqual(e.representanteId, t.supervisor.id);
      assert.equal(e.representacaoDesde, null);
    });

    it("sem nenhum técnico elegível, a equipe fica sem representante", async () => {
      const supervisor = await amb.criarUsuario({ perfil: "tecnico" });
      const e = await amb.criarEquipe({ supervisorId: supervisor.id });
      await amb.db.update(usuario).set({ equipeId: e.id }).where(eq(usuario.id, supervisor.id));
      await garantirRepresentantes(amb.db, [e.id]);
      assert.equal((await lerEquipe(e.id)).representanteId, null);
      assert.deepEqual(await representacoesEmVigor(amb.db, dia(10), { equipeIds: [e.id] }), []);
    });

    it("desativar o representante passa a função ao próximo", async () => {
      const t = await montar();
      await amb.esperar(200, "PATCH", `/usuarios/${t.representante.id}`, { como: t.admin, json: { ativo: false } });
      assert.equal((await lerEquipe(t.equipeId)).representanteId, t.bruno.id);
    });

    it("tirar o representante da equipe também passa a função ao próximo", async () => {
      const t = await montar();
      const outra = await amb.criarEquipe();
      await amb.esperar(200, "PATCH", `/usuarios/${t.representante.id}`, { como: t.admin, json: { equipe_id: outra.id } });
      assert.equal((await lerEquipe(t.equipeId)).representanteId, t.bruno.id);
    });

    it("quem vira supervisor deixa de ser o representante", async () => {
      const t = await montar();
      await amb.esperar(200, "PATCH", `/equipes/${t.equipeId}`, { como: t.admin, json: { supervisor_id: t.representante.id } });
      const e = await lerEquipe(t.equipeId);
      assert.equal(e.supervisorId, t.representante.id);
      assert.equal(e.representanteId, t.bruno.id);
    });
  });

  describe("PUT /equipes/{id}/representante", () => {
    it("o supervisor da equipe designa um técnico dela, e a troca vai para a auditoria", async () => {
      const t = await montar();
      const r = await amb.esperar(200, "PUT", `/equipes/${t.equipeId}/representante`, { como: t.supervisor, json: { usuario_id: t.carla.id } });
      assert.equal(r.equipe.representante_id, t.carla.id);
      assert.equal((await lerEquipe(t.equipeId)).representanteId, t.carla.id);
      const [trilha] = await amb.db.select().from(auditoria).where(and(eq(auditoria.entidadeId, t.equipeId), eq(auditoria.acao, "equipe.designar_representante")));
      assert.ok(trilha, "a designação fica na auditoria");
    });

    it("o admin também designa", async () => {
      const t = await montar();
      await amb.esperar(200, "PUT", `/equipes/${t.equipeId}/representante`, { como: t.admin, json: { usuario_id: t.bruno.id } });
      assert.equal((await lerEquipe(t.equipeId)).representanteId, t.bruno.id);
    });

    it("o técnico comum não designa (403) e quem não vê a equipe recebe 404", async () => {
      const t = await montar();
      await amb.esperar(403, "PUT", `/equipes/${t.equipeId}/representante`, { como: t.bruno, json: { usuario_id: t.bruno.id } });
      const estranho = await amb.criarUsuario({ perfil: "tecnico" });
      await amb.esperar(404, "PUT", `/equipes/${t.equipeId}/representante`, { como: estranho, json: { usuario_id: t.bruno.id } });
    });

    it("o escolhido precisa ser técnico ativo e liberado da própria equipe, e não o supervisor", async () => {
      const t = await montar();
      const fora = await amb.criarUsuario({ perfil: "tecnico", equipeId: (await amb.criarEquipe()).id });
      const inativo = await amb.criarUsuario({ perfil: "tecnico", equipeId: t.equipeId, ativo: false });
      for (const usuario_id of [t.supervisor.id, fora.id, inativo.id, t.admin.id]) {
        const r = await amb.req("PUT", `/equipes/${t.equipeId}/representante`, { como: t.supervisor, json: { usuario_id } });
        assert.equal(r.status, 422, JSON.stringify(r.corpo));
        assert.equal(r.corpo.erro.codigo, "representante_invalido");
      }
      assert.equal((await lerEquipe(t.equipeId)).representanteId, t.representante.id, "nada mudou");
    });

    it("o perfil da equipe mostra o representante e quando ele está no comando", async () => {
      const t = await montar();
      let r = await amb.esperar(200, "GET", `/equipes/${t.equipeId}`, { como: t.bruno });
      assert.equal(r.representante.id, t.representante.id);
      assert.equal(r.representacao, null);
      await ausentar(t.supervisor);
      r = await amb.esperar(200, "GET", `/equipes/${t.equipeId}`, { como: t.bruno });
      assert.equal(r.representacao.motivo, "ausencia");
      assert.match(r.representacao.rotulo, /ausente até 25\/10\/2026/);
    });
  });

  describe("manual: o supervisor se ausenta", () => {
    it("ao registrar a própria ausência, o representante assume na hora e os dois são avisados", async () => {
      const t = await montar();
      assert.deepEqual((await meus(t.representante)).equipes_representadas, []);
      await ausentar(t.supervisor);

      const eu = await meus(t.representante);
      assert.deepEqual(eu.equipes_representadas.map((e) => e.id), [t.equipeId]);
      assert.equal(eu.equipes_representadas[0]!.motivo, "ausencia");
      assert.ok(eu.equipes_supervisionadas.some((e) => e.id === t.equipeId), "ele passa a ter as ações de supervisão da equipe");

      const e = await lerEquipe(t.equipeId);
      assert.equal(e.representacaoMotivo, "ausencia");
      assert.ok(e.representacaoDesde);
      assert.equal(await alertasDe(t.representante.id, "representacao_iniciada"), 1);
      assert.equal(await alertasDe(t.supervisor.id, "representacao_iniciada"), 1);
      const [trilha] = await amb.db.select().from(auditoria).where(and(eq(auditoria.entidadeId, t.equipeId), eq(auditoria.acao, "equipe.representacao_iniciada")));
      assert.ok(trilha);
    });

    it("o representante aprova, assinando, o pedido de ausência de um colega", async () => {
      const t = await montar();
      const pedido = await amb.esperar(201, "POST", "/ausencias", { como: t.bruno, json: { motivo: "Consulta", inicio: "2026-10-20", dias: 2 } });
      // Com o supervisor presente, o representante é só um colega.
      await amb.esperar(404, "POST", `/ausencias/${pedido.ausencia.id}/aprovar`, { como: t.representante, json: ASSINA });
      await ausentar(t.supervisor);
      assert.equal(await alertasDe(t.representante.id, "ausencia_pedida"), 0, "o pedido anterior continua com o supervisor");
      const r = await amb.esperar(200, "POST", `/ausencias/${pedido.ausencia.id}/aprovar`, { como: t.representante, json: ASSINA });
      assert.equal(r.ausencia.estado, "aguardando_confirmacao");
      assert.equal(r.ausencia.supervisor_id, t.representante.id);
    });

    it("o pedido de ausência feito durante a substituição chega ao representante e ao supervisor", async () => {
      const t = await montar();
      await ausentar(t.supervisor);
      await amb.esperar(201, "POST", "/ausencias", { como: t.bruno, json: { motivo: "Consulta", inicio: "2026-10-20", dias: 2 } });
      assert.equal(await alertasDe(t.representante.id, "ausencia_pedida"), 1);
      assert.equal(await alertasDe(t.supervisor.id, "ausencia_pedida"), 1);
    });

    it("o supervisor que encerra a própria ausência retoma a equipe na hora, e os dois são avisados", async () => {
      const t = await montar();
      const { ausencia } = await ausentar(t.supervisor);
      await amb.esperar(200, "POST", `/ausencias/${ausencia.id}/encerrar`, { como: t.supervisor, json: ASSINA });

      assert.deepEqual((await meus(t.representante)).equipes_representadas, []);
      const e = await lerEquipe(t.equipeId);
      assert.equal(e.representacaoDesde, null);
      assert.equal(e.representacaoMotivo, null);
      assert.equal(await alertasDe(t.representante.id, "representacao_encerrada"), 1);
      assert.equal(await alertasDe(t.supervisor.id, "representacao_encerrada"), 1);
    });

    it("a ausência vencida mantém o representante no comando até o retorno ser encerrado", async () => {
      const t = await montar();
      const { ausencia } = await ausentar(t.supervisor, { inicio: "2026-10-15", dias: 2 });
      relogio(dia(5));
      assert.equal((await meus(t.representante)).equipes_representadas.length, 1, "a data de retorno passou, mas a ausência não terminou sozinha");
      await amb.esperar(200, "POST", `/ausencias/${ausencia.id}/confirmar-retorno`, { como: t.supervisor, json: ASSINA });
      assert.equal((await meus(t.representante)).equipes_representadas.length, 0);
    });

    it("a ausência agendada só põe o representante no comando no dia do início", async () => {
      const t = await montar();
      await ausentar(t.supervisor, { inicio: "2026-10-20", dias: 5 });
      assert.equal((await meus(t.representante)).equipes_representadas.length, 0);
      assert.equal((await lerEquipe(t.equipeId)).representacaoDesde, null);
      relogio(dia(5));
      assert.equal((await meus(t.representante)).equipes_representadas.length, 1);
      // A tarefa de hora em hora grava a mudança e avisa.
      const r = await sincronizarRepresentacao(amb.db, amb.relogio.agora, [t.equipeId]);
      assert.equal(r.iniciadas, 1);
      assert.equal(await alertasDe(t.representante.id, "representacao_iniciada"), 1);
      assert.deepEqual(await sincronizarRepresentacao(amb.db, amb.relogio.agora, [t.equipeId]), { iniciadas: 0, encerradas: 0 }, "idempotente: não avisa de novo");
    });

    it("o representante não registra a própria ausência como supervisor: o pedido dele espera quem responde", async () => {
      const t = await montar();
      await ausentar(t.supervisor);
      const r = await amb.esperar(201, "POST", "/ausencias", { como: t.representante, json: { motivo: "Consulta", inicio: "2026-10-20", dias: 1 } });
      assert.equal(r.ausencia.origem, "pedido");
      assert.equal(r.ausencia.estado, "pedida");
      await amb.esperar(403, "POST", `/ausencias/${r.ausencia.id}/aprovar`, { como: t.representante, json: ASSINA });
    });

    it("o representante não mexe na ausência do supervisor nem a registra por ele", async () => {
      const t = await montar();
      const { ausencia } = await ausentar(t.supervisor);
      await amb.esperar(403, "POST", `/ausencias/${ausencia.id}/encerrar`, { como: t.representante, json: ASSINA });
      await amb.esperar(403, "POST", `/ausencias/${ausencia.id}/prorrogar`, { como: t.representante, json: { ...ASSINA, retorno: "2026-12-01" } });
      const outra = await montar();
      await amb.esperar(403, "POST", "/ausencias", {
        como: outra.representante,
        json: { motivo: "Férias", inicio: "2026-10-20", dias: 3, usuario_id: outra.supervisor.id, ...ASSINA },
      });
    });

    it("o representante também precisa estar ativo: desativado, não assume", async () => {
      const t = await montar();
      await amb.db.update(usuario).set({ ativo: false }).where(eq(usuario.id, t.representante.id));
      await ausentar(t.supervisor);
      assert.deepEqual(await representacoesEmVigor(amb.db, amb.relogio.agora, { equipeIds: [t.equipeId] }), []);
    });
  });

  describe("automático: o supervisor passa 3 dias sem usar o sistema", () => {
    it(`passados ${DIAS_SEM_ATIVIDADE} dias sem nenhuma atividade, o representante assume, sem o supervisor ter registrado ausência`, async () => {
      const t = await montar();
      relogio(dia(DIAS_SEM_ATIVIDADE - 1));
      assert.equal((await meus(t.representante)).equipes_representadas.length, 0, "dois dias parado ainda não basta");

      relogio(dia(DIAS_SEM_ATIVIDADE));
      const eu = await meus(t.representante);
      assert.equal(eu.equipes_representadas[0]!.motivo, "inatividade");

      const r = await sincronizarRepresentacao(amb.db, amb.relogio.agora);
      assert.ok(r.iniciadas >= 1);
      assert.equal((await lerEquipe(t.equipeId)).representacaoMotivo, "inatividade");
      assert.equal(await alertasDe(t.representante.id, "representacao_iniciada"), 1);
      assert.equal(await alertasDe(t.supervisor.id, "representacao_iniciada"), 1);
    });

    it("a atividade do supervisor antes do prazo zera a contagem", async () => {
      const t = await montar();
      relogio(dia(2));
      await amb.esperar(200, "GET", "/me", { como: t.supervisor });
      relogio(dia(4));
      assert.equal((await meus(t.representante)).equipes_representadas.length, 0, "ele voltou ao sistema no dia 2");
      relogio(dia(5));
      assert.equal((await meus(t.representante)).equipes_representadas.length, 1, "e parou de novo: 3 dias depois do dia 2");
    });

    it("quando o supervisor volta a usar o sistema, retoma a equipe na hora e os dois são avisados", async () => {
      const t = await montar();
      relogio(dia(DIAS_SEM_ATIVIDADE + 1));
      await sincronizarRepresentacao(amb.db, amb.relogio.agora, [t.equipeId]);
      assert.equal((await lerEquipe(t.equipeId)).representacaoMotivo, "inatividade");

      await amb.esperar(200, "GET", "/me", { como: t.supervisor });
      const e = await lerEquipe(t.equipeId);
      assert.equal(e.representacaoDesde, null);
      assert.equal(await alertasDe(t.representante.id, "representacao_encerrada"), 1);
      assert.equal(await alertasDe(t.supervisor.id, "representacao_encerrada"), 1);
      assert.equal((await meus(t.representante)).equipes_representadas.length, 0);
    });

    it("o supervisor que volta depois de dias parado só para registrar a ausência devolve a equipe e a leva de novo", async () => {
      const t = await montar();
      relogio(dia(DIAS_SEM_ATIVIDADE + 1));
      await sincronizarRepresentacao(amb.db, amb.relogio.agora, [t.equipeId]);
      // O primeiro acesso dele já retoma a equipe (volta a usar o sistema); a ausência registrada em seguida a entrega de novo.
      await amb.esperar(201, "POST", "/ausencias", { como: t.supervisor, json: { motivo: "Licença", inicio: "2026-10-19", dias: 7, ...ASSINA } });
      const e = await lerEquipe(t.equipeId);
      assert.equal(e.representacaoMotivo, "ausencia");
      assert.equal(await alertasDe(t.representante.id, "representacao_iniciada"), 2);
      assert.equal(await alertasDe(t.representante.id, "representacao_encerrada"), 1);
    });

    it("o representante no comando age como supervisor: devolve a OS reservada e vê a gestão da equipe", async () => {
      const t = await montar();
      relogio(dia(DIAS_SEM_ATIVIDADE));
      const eu = await meus(t.representante);
      assert.ok(eu.equipes_supervisionadas.some((e) => e.id === t.equipeId));
      // As telas de gestão da equipe (exigem ser supervisor dela) abrem para ele.
      await amb.esperar(200, "GET", "/ausencias", { como: t.representante, consulta: { equipe_id: t.equipeId } });
    });
  });
});
