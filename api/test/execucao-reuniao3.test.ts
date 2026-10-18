import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { itemModeloApr, localInstalacao, modeloApr, os, tarefa } from "../src/db/schema";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";
import { POSICAO, ajudaDeExecucao } from "./ajuda-execucao";

/**
 * As correções da Reunião 3 na `api`: a assinatura da APR na conta de cada um e o direito de recusa, o mínimo de 2 participantes,
 * o motivo obrigatório da pausa e da suspensão, a localização, o encerramento em dois passos e a assinatura final do supervisor.
 */
describe("Reunião 3: assinaturas, motivos, localização e o encerramento em dois passos", () => {
  let amb: Ambiente;
  let h: ReturnType<typeof ajudaDeExecucao>;
  let equipeId: string;
  let supervisor: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;
  let colega: UsuarioDeTeste;
  let terceiro: UsuarioDeTeste;
  let deFora: UsuarioDeTeste;
  let modeloId: string;
  let itens: (typeof itemModeloApr.$inferSelect)[];
  let localId: string;
  let contadorOs = 4300000;

  before(async () => {
    amb = await criarAmbiente({ comCarga: true, relogio: new Date("2026-10-16T15:00:00Z") });
    h = ajudaDeExecucao(amb);
    supervisor = await amb.criarUsuario({ perfil: "tecnico", nome: "Sônia Supervisora" });
    equipeId = (await amb.criarEquipe({ supervisorId: supervisor.id })).id;
    // O supervisor também é um técnico da equipe (pode participar da APR e executar).
    await amb.sql("update usuario set equipe_id = $1 where id = $2", [equipeId, supervisor.id]);
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Tiago Técnico" });
    colega = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Carla Colega" });
    terceiro = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Teresa Terceira" });
    const outraEquipe = (await amb.criarEquipe()).id;
    deFora = await amb.criarUsuario({ perfil: "tecnico", equipeId: outraEquipe });
    const [m] = await amb.db.select().from(modeloApr).where(eq(modeloApr.codigo, "APR 01"));
    modeloId = m!.id;
    itens = await amb.db.select().from(itemModeloApr).where(eq(itemModeloApr.modeloAprId, modeloId));
    [{ id: localId }] = (await amb.db.insert(localInstalacao).values({ codigo: "VILA VELHA/REDE" }).returning({ id: localInstalacao.id })) as [{ id: string }];
  });
  after(() => amb.fechar());

  async function novaOs() {
    const [o] = await amb.db
      .insert(os)
      .values({ numeroOrdem: String(++contadorOs), tipo: "corretiva", titulo: "DCV Desobstrução", localInstalacaoId: localId, equipeId, dataInicioProg: "2026-10-16", origem: "sap" })
      .returning();
    return o!;
  }
  const statusDa = async (id: string) => (await amb.db.select({ s: os.status }).from(os).where(eq(os.id, id)))[0]!.s;

  /** APR sem item reprovado; o primeiro participante é o responsável. `presencial` é o modo offline. */
  function payloadApr(quem: UsuarioDeTeste[], extra: Record<string, unknown> = {}) {
    return {
      id: randomUUID(),
      modelo_apr_id: modeloId,
      participantes: quem.map((u, i) => ({ usuario_id: u.id, funcao: i === 0 ? "responsavel" : "executor" })),
      riscos: [],
      respostas: itens.filter((i) => i.secao === "verificacao").map((i) => ({ item_id: i.id, resposta: i.respostaBloqueante === "sim" ? "nao" : "sim" })),
      evidencias: [],
      observacao_geral: null,
      concluida_em: h.agora(),
      ...extra,
    };
  }
  /** Registra a APR aprovada (sem assinaturas) e devolve o id. */
  async function registrarApr(osId: string, quem: UsuarioDeTeste[] = [tecnico, colega], extra: Record<string, unknown> = {}) {
    const p = payloadApr(quem, extra);
    const r = await h.enviar(quem[0]!, h.evento("apr_concluida", p, osId));
    assert.deepEqual(r.rejeitados, [], JSON.stringify(r.rejeitados));
    assert.deepEqual(r.aprs, [{ id: p.id, resultado: "aprovada" }]);
    return p.id;
  }
  const participantesDa = (aprId: string) =>
    amb.sql<{ usuario_id: string; assinatura_path: string | null; assinada_em: string | null; assinatura_presencial: boolean; recusou_em: string | null; recusa_motivo: string | null }>(
      "select usuario_id, assinatura_path, assinada_em, assinatura_presencial, recusou_em, recusa_motivo from apr_participante where apr_id = $1",
      [aprId],
    );
  const codigoDaRecusa = (r: { rejeitados: { codigo: string }[]; pendentes: { codigo: string }[] }) => (r.rejeitados[0] ?? r.pendentes[0])?.codigo;
  const alertasDaOs = (osId: string, tipo: string) => amb.sql<{ id: string; destinatario_id: string; detalhe: string }>("select id, destinatario_id, detalhe from alerta where os_id = $1 and tipo = $2", [osId, tipo]);

  /** OS com a APR assinada pelos dois e a execução iniciada pelo responsável (`tecnico`). */
  async function osEmExecucao() {
    const o = await novaOs();
    const aprId = await registrarApr(o.id);
    await h.assinarApr(aprId, o.id, [tecnico, colega]);
    const execId = await h.iniciar(tecnico, o.id, aprId, POSICAO);
    return { o, aprId, execId };
  }

  describe("a APR: mínimo de 2 participantes e a assinatura de cada um", () => {
    it("a APR com um só participante é recusada (ninguém executa sozinho), inclusive na validação", async () => {
      const o = await novaOs();
      const r = await h.enviar(tecnico, h.evento("apr_concluida", payloadApr([tecnico]), o.id));
      assert.equal(codigoDaRecusa(r), "participantes_insuficientes");
      assert.equal((await amb.sql("select 1 from apr where os_id = $1", [o.id])).length, 0);

      const { id: _id, evidencias: _e, ...corpo } = payloadApr([tecnico]);
      const v = await amb.req("POST", "/aprs/avaliar", { como: tecnico, json: { ...corpo, id: randomUUID(), os_id: o.id } });
      assert.equal(v.status, 422);
      assert.equal(v.corpo.erro.codigo, "participantes_insuficientes");
    });

    it("a APR de 3 participantes vale; não há máximo", async () => {
      const o = await novaOs();
      const aprId = await registrarApr(o.id, [tecnico, colega, terceiro]);
      assert.equal((await participantesDa(aprId)).length, 3);
    });

    it("a APR é registrada sem assinaturas, e os demais participantes recebem o aviso (só no sino, sem e-mail)", async () => {
      const o = await novaOs();
      const aprId = await registrarApr(o.id);
      for (const p of await participantesDa(aprId)) {
        assert.equal(p.assinatura_path, null);
        assert.equal(p.assinada_em, null);
        assert.equal(p.assinatura_presencial, false);
      }
      const avisos = await alertasDaOs(o.id, "apr_para_assinar");
      assert.deepEqual(avisos.map((a) => a.destinatario_id), [colega.id]);
      assert.equal((await amb.db.select().from(tarefa).where(and(eq(tarefa.tipo, "email_alerta"), eq(tarefa.referenciaId, avisos[0]!.id)))).length, 0);
      assert.equal(await statusDa(o.id), "liberada");
    });

    it("a execução só começa com a assinatura de todos; cada um assina na própria conta, com a assinatura do perfil", async () => {
      const o = await novaOs();
      const aprId = await registrarApr(o.id);
      const tentativa = (id = randomUUID()) => h.enviar(tecnico, h.evento("execucao_iniciada", { id, apr_id: aprId, inicio: h.agora() }, o.id));

      let r = await tentativa();
      assert.equal(codigoDaRecusa(r), "apr_sem_assinaturas");
      assert.match(r.rejeitados[0].mensagem, /Tiago Técnico/);
      assert.match(r.rejeitados[0].mensagem, /Carla Colega/);

      await h.enviar(tecnico, h.evento("apr_assinada", { apr_id: aprId }, o.id));
      r = await tentativa();
      assert.equal(codigoDaRecusa(r), "apr_sem_assinaturas");
      assert.doesNotMatch(r.rejeitados[0].mensagem, /Tiago Técnico/);
      assert.match(r.rejeitados[0].mensagem, /Carla Colega/);

      await h.enviar(colega, h.evento("apr_assinada", { apr_id: aprId }, o.id));
      const feitas = await participantesDa(aprId);
      assert.equal(feitas.find((p) => p.usuario_id === colega.id)!.assinatura_path, await amb.assinaturaDe(colega));
      assert.equal(feitas.find((p) => p.usuario_id === tecnico.id)!.assinatura_path, await amb.assinaturaDe(tecnico));
      assert.ok(feitas.every((p) => p.assinada_em && !p.assinatura_presencial));

      r = await tentativa();
      assert.deepEqual(r.rejeitados, []);
      assert.equal(await statusDa(o.id), "em_execucao");
    });

    it("assinar de novo não muda nada; quem não é da APR não assina; a APR de outro dia não se assina; o aviso some quando a pessoa assina", async () => {
      const o = await novaOs();
      const aprId = await registrarApr(o.id);
      const [antes] = await alertasDaOs(o.id, "apr_para_assinar");
      assert.equal((await amb.sql("select lido_em from alerta where id = $1", [antes!.id]))[0]!.lido_em, null);

      await h.enviar(colega, h.evento("apr_assinada", { apr_id: aprId }, o.id));
      const primeira = (await participantesDa(aprId)).find((p) => p.usuario_id === colega.id)!.assinada_em;
      assert.notEqual((await amb.sql("select lido_em from alerta where id = $1", [antes!.id]))[0]!.lido_em, null);
      await h.enviar(colega, h.evento("apr_assinada", { apr_id: aprId }, o.id));
      assert.deepEqual((await participantesDa(aprId)).find((p) => p.usuario_id === colega.id)!.assinada_em, primeira);

      assert.equal(codigoDaRecusa(await h.enviar(deFora, h.evento("apr_assinada", { apr_id: aprId }, o.id))), "fora_da_apr");
      assert.equal(codigoDaRecusa(await h.enviar(terceiro, h.evento("apr_assinada", { apr_id: aprId }, o.id))), "fora_da_apr");

      const amanha = new Date(amb.relogio.agora.getTime() + 24 * 3_600_000).toISOString();
      assert.equal(codigoDaRecusa(await h.enviar(tecnico, h.evento("apr_assinada", { apr_id: aprId }, o.id, amanha))), "apr_vencida");

      assert.equal(codigoDaRecusa(await h.enviar(tecnico, h.evento("apr_assinada", { apr_id: randomUUID() }, o.id))), "apr_ausente");
    });

    it("a APR bloqueada não é assinada", async () => {
      const o = await novaOs();
      const reprovado = itens.find((i) => i.secao === "verificacao" && i.tipo === "eliminatorio")!;
      const p = payloadApr([tecnico, colega]);
      p.respostas = p.respostas.map((r) => (r.item_id === reprovado.id ? { item_id: r.item_id, resposta: reprovado.respostaBloqueante!, observacao: "Vazamento" } : r));
      p.evidencias = [{ id: await h.foto(), item_id: reprovado.id, capturada_em: h.agora() }] as never;
      const r = await h.enviar(tecnico, h.evento("apr_concluida", p, o.id));
      assert.equal(r.aprs[0].resultado, "bloqueada");
      assert.equal(codigoDaRecusa(await h.enviar(tecnico, h.evento("apr_assinada", { apr_id: p.id }, o.id))), "apr_bloqueada");
      assert.equal((await alertasDaOs(o.id, "apr_para_assinar")).length, 0);
    });

    it("GET /me/aprs-para-assinar lista as APRs de hoje que esperam a assinatura de quem pergunta", async () => {
      const o = await novaOs();
      const aprId = await registrarApr(o.id, [tecnico, colega]);
      const doColega = await amb.esperar(200, "GET", "/me/aprs-para-assinar", { como: colega });
      const dela = doColega.aprs.find((a: { apr_id: string }) => a.apr_id === aprId);
      assert.equal(dela.os_id, o.id);
      assert.equal(dela.numero_ordem, o.numeroOrdem);
      assert.equal(dela.preenchida_por_nome, "Tiago Técnico");
      assert.equal(dela.funcao, "executor");
      assert.equal((await amb.esperar(200, "GET", "/me/aprs-para-assinar", { como: terceiro })).aprs.some((a: { apr_id: string }) => a.apr_id === aprId), false);

      await h.assinarApr(aprId, o.id, [colega]);
      assert.equal((await amb.esperar(200, "GET", "/me/aprs-para-assinar", { como: colega })).aprs.some((a: { apr_id: string }) => a.apr_id === aprId), false);
      // Quem registrou ainda não assinou: a APR segue na lista dele.
      assert.equal((await amb.esperar(200, "GET", "/me/aprs-para-assinar", { como: tecnico })).aprs.some((a: { apr_id: string }) => a.apr_id === aprId), true);
    });

    it("modo offline (contingência): as assinaturas vêm presenciais, copiadas do perfil, e a execução já pode começar", async () => {
      const o = await novaOs();
      const aprId = await registrarApr(o.id, [tecnico, colega], { assinatura_presencial: true });
      const feitas = await participantesDa(aprId);
      assert.ok(feitas.every((p) => p.assinatura_path && p.assinada_em && p.assinatura_presencial));
      assert.equal((await alertasDaOs(o.id, "apr_para_assinar")).length, 0);
      await h.iniciar(tecnico, o.id, aprId);
      assert.equal(await statusDa(o.id), "em_execucao");
    });
  });

  describe("o direito de recusa", () => {
    it("o participante recusa com motivo, sai da APR, e o supervisor é avisado (sino e e-mail obrigatório)", async () => {
      const o = await novaOs();
      const aprId = await registrarApr(o.id, [tecnico, colega, terceiro]);

      assert.equal(codigoDaRecusa(await h.enviar(terceiro, h.evento("apr_recusada", { apr_id: aprId }, o.id))), "motivo_obrigatorio");
      assert.equal(codigoDaRecusa(await h.enviar(terceiro, h.evento("apr_recusada", { apr_id: aprId, motivo: "  " }, o.id))), "motivo_obrigatorio");

      const r = await h.enviar(terceiro, h.evento("apr_recusada", { apr_id: aprId, motivo: "Não estou bem emocionalmente para o serviço" }, o.id));
      assert.deepEqual(r.rejeitados, []);
      const recusou = (await participantesDa(aprId)).find((p) => p.usuario_id === terceiro.id)!;
      assert.ok(recusou.recusou_em);
      assert.equal(recusou.recusa_motivo, "Não estou bem emocionalmente para o serviço");
      assert.equal(recusou.assinada_em, null);

      const avisos = await alertasDaOs(o.id, "direito_de_recusa");
      assert.deepEqual(avisos.map((a) => a.destinatario_id), [supervisor.id]);
      assert.match(avisos[0]!.detalhe, /Teresa Terceira/);
      assert.match(avisos[0]!.detalhe, /Não estou bem emocionalmente/);
      assert.equal((await amb.db.select().from(tarefa).where(and(eq(tarefa.tipo, "email_alerta"), eq(tarefa.referenciaId, avisos[0]!.id)))).length, 1);

      // Quem sobrou segue: com os dois restantes assinando, a execução começa, com 2 pessoas.
      await h.assinarApr(aprId, o.id, [tecnico, colega]);
      const execId = await h.iniciar(tecnico, o.id, aprId);
      assert.equal((await amb.sql<{ numero_pessoas: number }>("select numero_pessoas from execucao where id = $1", [execId]))[0]!.numero_pessoas, 2);
      // Quem recusou não assina depois.
      assert.equal(codigoDaRecusa(await h.enviar(terceiro, h.evento("apr_assinada", { apr_id: aprId }, o.id))), "apr_recusada_por_voce");
    });

    it("com menos de 2 participantes (ou se o responsável recusa) a APR não serve mais", async () => {
      const o = await novaOs();
      const aprId = await registrarApr(o.id, [tecnico, colega]);
      await h.enviar(colega, h.evento("apr_recusada", { apr_id: aprId, motivo: "Com dor nas costas" }, o.id));
      await h.enviar(tecnico, h.evento("apr_assinada", { apr_id: aprId }, o.id));
      const r = await h.enviar(tecnico, h.evento("execucao_iniciada", { id: randomUUID(), apr_id: aprId, inicio: h.agora() }, o.id));
      assert.equal(codigoDaRecusa(r), "apr_sem_participantes");

      const o2 = await novaOs();
      const apr2 = await registrarApr(o2.id, [tecnico, colega, terceiro]);
      await h.enviar(tecnico, h.evento("apr_recusada", { apr_id: apr2, motivo: "Não concordo com as condições" }, o2.id));
      await h.assinarApr(apr2, o2.id, [colega, terceiro]);
      const r2 = await h.enviar(colega, h.evento("execucao_iniciada", { id: randomUUID(), apr_id: apr2, inicio: h.agora() }, o2.id));
      assert.equal(codigoDaRecusa(r2), "apr_sem_participantes");
      assert.match((await alertasDaOs(o2.id, "direito_de_recusa"))[0]!.detalhe, /responsável recusou/);
    });

    it("quem já assinou não recusa (com a execução em andamento, todos já assinaram)", async () => {
      const { o, aprId } = await osEmExecucao();
      assert.equal(codigoDaRecusa(await h.enviar(colega, h.evento("apr_recusada", { apr_id: aprId, motivo: "Mudei de ideia" }, o.id))), "ja_assinou");
      assert.equal((await participantesDa(aprId)).every((p) => p.recusou_em === null), true);
    });
  });

  describe("pausa e suspensão com motivo", () => {
    it("a pausa exige o motivo; aguardando e outro exigem o complemento; a localização é gravada", async () => {
      const { o, execId } = await osEmExecucao();
      const pausa = (extra: Record<string, unknown>) => h.enviar(tecnico, h.evento("pausa_iniciada", { id: randomUUID(), execucao_id: execId, inicio: h.agora(), ...extra }, o.id));

      assert.equal(codigoDaRecusa(await pausa({})), "motivo_obrigatorio");
      assert.equal(codigoDaRecusa(await pausa({ motivo: null })), "motivo_obrigatorio");
      assert.equal(codigoDaRecusa(await pausa({ motivo: "aguardando" })), "complemento_obrigatorio");
      assert.equal(codigoDaRecusa(await pausa({ motivo: "outro", complemento: "   " })), "complemento_obrigatorio");
      assert.equal(codigoDaRecusa(await pausa({ motivo: "almoco", latitude: -20.3 })), "posicao_incompleta");
      assert.equal((await amb.sql("select 1 from execucao_pausa where execucao_id = $1", [execId])).length, 0);

      const id = randomUUID();
      const r = await h.enviar(tecnico, h.evento("pausa_iniciada", { id, execucao_id: execId, inicio: h.agora(), motivo: "aguardando", complemento: "peça do almoxarifado", ...POSICAO }, o.id));
      assert.deepEqual(r.rejeitados, []);
      const [p] = await amb.sql<{ motivo: string; complemento: string | null; latitude: string; longitude: string }>("select motivo, complemento, latitude, longitude from execucao_pausa where id = $1", [id]);
      assert.equal(p!.motivo, "aguardando");
      assert.equal(p!.complemento, "peça do almoxarifado");
      assert.equal(Number(p!.latitude), POSICAO.latitude);
      assert.equal(Number(p!.longitude), POSICAO.longitude);
      // Aguardando não é caso de saúde: nenhum aviso ao supervisor.
      assert.equal((await alertasDaOs(o.id, "lesao_ou_enfermidade")).length, 0);

      // Uma pausa sem coordenadas ("sem localização") e sem complemento (almoço) também vale.
      await h.enviar(tecnico, h.evento("pausa_encerrada", { pausa_id: id, fim: h.agora() }, o.id));
      const sem = randomUUID();
      assert.deepEqual((await h.enviar(tecnico, h.evento("pausa_iniciada", { id: sem, execucao_id: execId, inicio: h.agora(), motivo: "almoco" }, o.id))).rejeitados, []);
      const [s] = await amb.sql<{ latitude: string | null; complemento: string | null }>("select latitude, complemento from execucao_pausa where id = $1", [sem]);
      assert.equal(s!.latitude, null);
      assert.equal(s!.complemento, null);
    });

    it("lesão e enfermidade na pausa avisam o supervisor na hora (sino e e-mail obrigatório)", async () => {
      const { o, execId } = await osEmExecucao();
      const id = randomUUID();
      await h.enviar(tecnico, h.evento("pausa_iniciada", { id, execucao_id: execId, inicio: h.agora(), motivo: "lesao", ...POSICAO }, o.id));
      const avisos = await alertasDaOs(o.id, "lesao_ou_enfermidade");
      assert.deepEqual(avisos.map((a) => a.destinatario_id), [supervisor.id]);
      assert.match(avisos[0]!.detalhe, /Tiago Técnico pausou a execução por lesão/);
      assert.match(avisos[0]!.detalhe, /acidente de trabalho/);
      assert.equal((await amb.db.select().from(tarefa).where(and(eq(tarefa.tipo, "email_alerta"), eq(tarefa.referenciaId, avisos[0]!.id)))).length, 1);

      await h.enviar(tecnico, h.evento("pausa_encerrada", { pausa_id: id, fim: h.agora() }, o.id));
      await h.enviar(tecnico, h.evento("pausa_iniciada", { id: randomUUID(), execucao_id: execId, inicio: h.agora(), motivo: "enfermidade" }, o.id));
      assert.equal((await alertasDaOs(o.id, "lesao_ou_enfermidade")).length, 2);
    });

    it("a suspensão exige o motivo (outro pede a descrição), grava a localização e a OS fica pendente", async () => {
      const { o, execId } = await osEmExecucao();
      const suspender = (extra: Record<string, unknown>) => h.enviar(tecnico, h.evento("execucao_suspensa", { execucao_id: execId, fim: h.agora(), ...extra }, o.id));
      assert.equal(codigoDaRecusa(await suspender({})), "motivo_obrigatorio");
      assert.equal(codigoDaRecusa(await suspender({ motivo: "outro" })), "complemento_obrigatorio");
      assert.equal(codigoDaRecusa(await suspender({ motivo: "almoco" })), "payload_invalido");

      const r = await suspender({ motivo: "falta_material", ...POSICAO });
      assert.deepEqual(r.rejeitados, []);
      const [e] = await amb.sql<{ resultado: string; suspensao_motivo: string; suspensao_complemento: string | null; fim_latitude: string }>(
        "select resultado, suspensao_motivo, suspensao_complemento, fim_latitude from execucao where id = $1",
        [execId],
      );
      assert.equal(e!.resultado, "suspensa");
      assert.equal(e!.suspensao_motivo, "falta_material");
      assert.equal(e!.suspensao_complemento, null);
      assert.equal(Number(e!.fim_latitude), POSICAO.latitude);
      assert.equal(await statusDa(o.id), "pendente");
      assert.equal((await alertasDaOs(o.id, "lesao_ou_enfermidade")).length, 0);
    });

    it("suspender por lesão avisa o supervisor, e o motivo aparece no detalhe e na linha do tempo", async () => {
      const { o, execId } = await osEmExecucao();
      await h.enviar(tecnico, h.evento("execucao_suspensa", { execucao_id: execId, fim: h.agora(), motivo: "outro", complemento: "Chuva forte" }, o.id));
      const detalhe = await amb.esperar(200, "GET", `/os/${o.id}`, { como: supervisor });
      assert.equal(detalhe.execucoes[0].suspensao_motivo, "outro");
      assert.equal(detalhe.execucoes[0].suspensao_complemento, "Chuva forte");
      assert.match(detalhe.linha_do_tempo.map((i: { descricao: string }) => i.descricao).join("\n"), /suspensa.*Outro: Chuva forte/);

      const { o: o2, execId: exec2 } = await osEmExecucao();
      await h.enviar(tecnico, h.evento("execucao_suspensa", { execucao_id: exec2, fim: h.agora(), motivo: "lesao", complemento: "corte na mão" }, o2.id));
      const avisos = await alertasDaOs(o2.id, "lesao_ou_enfermidade");
      assert.equal(avisos.length, 1);
      assert.match(avisos[0]!.detalhe, /suspendeu a execução por lesão \(corte na mão\)/);
    });

    it("interromper por risco continua pedindo motivo e ao menos uma foto, e grava a localização", async () => {
      const { o, execId } = await osEmExecucao();
      const interromper = (extra: Record<string, unknown>) => h.enviar(tecnico, h.evento("execucao_interrompida", { execucao_id: execId, fim: h.agora(), ...extra }, o.id));
      assert.equal(codigoDaRecusa(await interromper({ motivo: "Vazamento de gás" })), "interrupcao_incompleta");
      assert.equal(codigoDaRecusa(await interromper({ motivo: "", evidencias: [{ id: await h.foto(), capturada_em: h.agora() }] })), "interrupcao_incompleta");
      const r = await interromper({ motivo: "Vazamento de gás", evidencias: [{ id: await h.foto(), capturada_em: h.agora() }], ...POSICAO });
      assert.deepEqual(r.rejeitados, []);
      const [e] = await amb.sql<{ fim_latitude: string; fim_longitude: string }>("select fim_latitude, fim_longitude from execucao where id = $1", [execId]);
      assert.equal(Number(e!.fim_latitude), POSICAO.latitude);
      assert.equal(await statusDa(o.id), "pendente");
    });
  });

  describe("localização e o encerramento em dois passos", () => {
    it("o início grava a localização; sem GPS fica sem localização", async () => {
      const { execId } = await osEmExecucao();
      const [e] = await amb.sql<{ inicio_latitude: string; inicio_longitude: string; fim_latitude: string | null }>("select inicio_latitude, inicio_longitude, fim_latitude from execucao where id = $1", [execId]);
      assert.equal(Number(e!.inicio_latitude), POSICAO.latitude);
      assert.equal(Number(e!.inicio_longitude), POSICAO.longitude);
      assert.equal(e!.fim_latitude, null);

      const o = await novaOs();
      const aprId = await registrarApr(o.id);
      await h.assinarApr(aprId, o.id, [tecnico, colega]);
      const sem = await h.iniciar(tecnico, o.id, aprId);
      const [s] = await amb.sql<{ inicio_latitude: string | null }>("select inicio_latitude from execucao where id = $1", [sem]);
      assert.equal(s!.inicio_latitude, null);
    });

    it("Encerrar OS: o tempo para na hora (encerrando), com a localização, e a pausa aberta é fechada", async () => {
      const { o, execId } = await osEmExecucao();
      const pausaId = randomUUID();
      await h.enviar(tecnico, h.evento("pausa_iniciada", { id: pausaId, execucao_id: execId, inicio: h.agora(), motivo: "descanso" }, o.id));

      const r = await h.clicarEncerrar(tecnico, o.id, execId);
      assert.deepEqual(r.rejeitados, []);
      assert.deepEqual(r.os, [{ id: o.id, status: "encerrando" }]);
      const [e] = await amb.sql<{ resultado: string; fim: string; descricao_atividade: string | null; encerramento_assinado_em: string | null; fim_latitude: string; fim_longitude: string }>(
        "select resultado, fim, descricao_atividade, encerramento_assinado_em, fim_latitude, fim_longitude from execucao where id = $1",
        [execId],
      );
      assert.equal(e!.resultado, "encerrada");
      assert.ok(e!.fim);
      assert.equal(e!.descricao_atividade, null);
      assert.equal(e!.encerramento_assinado_em, null);
      assert.equal(Number(e!.fim_latitude), POSICAO.latitude);
      assert.equal((await amb.sql<{ fim: string | null }>("select fim from execucao_pausa where id = $1", [pausaId]))[0]!.fim !== null, true);

      // O que ainda não aconteceu: nada de pontos, de aviso ao supervisor nem de PDF.
      assert.equal((await amb.sql("select 1 from lancamento_pontos where os_id = $1", [o.id])).length > 0, true, "a APR assinada já pontuou");
      assert.equal((await amb.sql("select 1 from lancamento_pontos where os_id = $1 and regra = 'execucao_concluida'", [o.id])).length, 0);
      assert.equal((await alertasDaOs(o.id, "os_para_assinar")).length, 0);
      assert.equal((await amb.db.select().from(tarefa).where(and(eq(tarefa.tipo, "pdf_os"), eq(tarefa.referenciaId, o.id)))).length, 0);

      // A execução parou: não dá mais para pausar, suspender nem encerrar de novo com outro fim.
      const pausa = await h.enviar(tecnico, h.evento("pausa_iniciada", { id: randomUUID(), execucao_id: execId, inicio: h.agora(), motivo: "almoco" }, o.id));
      assert.equal(codigoDaRecusa(pausa), "execucao_finalizada");
      const suspensa = await h.enviar(tecnico, h.evento("execucao_suspensa", { execucao_id: execId, fim: h.agora(), motivo: "fim_expediente" }, o.id));
      assert.equal(codigoDaRecusa(suspensa), "execucao_finalizada");
      assert.deepEqual((await h.clicarEncerrar(tecnico, o.id, execId)).rejeitados, []);
      assert.equal(await statusDa(o.id), "encerrando");
    });

    it("o encerramento assinado: só o responsável assina, descrição e fotos são opcionais, e a OS passa a aguardar o supervisor", async () => {
      const { o, execId } = await osEmExecucao();
      // Antes de encerrar não há o que assinar.
      assert.equal(codigoDaRecusa(await h.assinarEncerramento(tecnico, o.id, execId)), "execucao_nao_encerrada");
      await h.clicarEncerrar(tecnico, o.id, execId);
      // Só quem executou assina o encerramento.
      assert.equal(codigoDaRecusa(await h.assinarEncerramento(colega, o.id, execId)), "execucao_de_outro");

      const r = await h.enviar(tecnico, h.evento("encerramento_assinado", { execucao_id: execId }, o.id));
      assert.deepEqual(r.rejeitados, []);
      assert.deepEqual(r.os, [{ id: o.id, status: "aguardando_supervisor" }]);
      assert.ok(r.pontos_ganhos > 0, "a execução pontua aqui");

      const [e] = await amb.sql<{ descricao_atividade: string | null; encerramento_assinado_em: string | null }>("select descricao_atividade, encerramento_assinado_em from execucao where id = $1", [execId]);
      assert.equal(e!.descricao_atividade, null);
      assert.ok(e!.encerramento_assinado_em);
      assert.equal((await amb.sql("select 1 from evidencia where execucao_id = $1", [execId])).length, 0);
      // Só uma assinatura no encerramento: a do responsável, com a do perfil.
      const assinaturas = await amb.sql<{ usuario_id: string; assinatura_path: string }>("select usuario_id, assinatura_path from execucao_assinatura where execucao_id = $1", [execId]);
      assert.deepEqual(assinaturas, [{ usuario_id: tecnico.id, assinatura_path: await amb.assinaturaDe(tecnico) }]);
      assert.equal((await amb.sql("select 1 from lancamento_pontos where os_id = $1 and regra = 'execucao_concluida'", [o.id])).length, 2, "o responsável e o colega pontuam");

      // O supervisor é avisado (sino e e-mail) e o PDF ainda não sai.
      const avisos = await alertasDaOs(o.id, "os_para_assinar");
      assert.deepEqual(avisos.map((a) => a.destinatario_id), [supervisor.id]);
      assert.equal((await amb.db.select().from(tarefa).where(and(eq(tarefa.tipo, "pdf_os"), eq(tarefa.referenciaId, o.id)))).length, 0);

      // Reenviar não muda nada.
      assert.deepEqual((await h.enviar(tecnico, h.evento("encerramento_assinado", { execucao_id: execId, descricao_atividade: "Outra descrição" }, o.id))).rejeitados, []);
      assert.equal((await amb.sql<{ descricao_atividade: string | null }>("select descricao_atividade from execucao where id = $1", [execId]))[0]!.descricao_atividade, null);
    });

    it("descrição e fotos são gravadas quando vêm; mais de 10 fotos continua sendo recusado", async () => {
      const { o, execId } = await osEmExecucao();
      await h.clicarEncerrar(tecnico, o.id, execId);
      const muitas = [];
      for (let i = 0; i < 11; i++) muitas.push({ id: await h.foto(), capturada_em: h.agora() });
      assert.equal(codigoDaRecusa(await h.assinarEncerramento(tecnico, o.id, execId, { evidencias: muitas })), "fotos_demais");
      const r = await h.assinarEncerramento(tecnico, o.id, execId, { descricao_atividade: "  Troca de válvula  ", evidencias: [{ id: await h.foto(), capturada_em: h.agora(), ...POSICAO }] });
      assert.deepEqual(r.rejeitados, []);
      const [e] = await amb.sql<{ descricao_atividade: string }>("select descricao_atividade from execucao where id = $1", [execId]);
      assert.equal(e!.descricao_atividade, "Troca de válvula");
      assert.equal((await amb.sql("select 1 from evidencia where execucao_id = $1", [execId])).length, 1);
    });
  });

  describe("a assinatura final do supervisor", () => {
    async function osAguardandoSupervisor() {
      const x = await osEmExecucao();
      await h.encerrar(tecnico, x.o.id, x.execId);
      assert.equal(await statusDa(x.o.id), "aguardando_supervisor");
      return x;
    }

    it("o supervisor assina por último: a OS fica encerrada (concluída), o PDF é enfileirado e o executor é avisado", async () => {
      const { o } = await osAguardandoSupervisor();
      const r = await h.concluir(supervisor, o.id);
      assert.equal(r.status, 200, JSON.stringify(r.corpo));
      assert.equal(r.corpo.status, "encerrada");
      assert.ok(r.corpo.ciencia_em);
      assert.equal(await statusDa(o.id), "encerrada");
      const [linha] = await amb.sql<{ ciencia_por: string; ciencia_assinatura_path: string }>("select ciencia_por, ciencia_assinatura_path from os where id = $1", [o.id]);
      assert.equal(linha!.ciencia_por, supervisor.id);
      assert.equal(linha!.ciencia_assinatura_path, await amb.assinaturaDe(supervisor));
      assert.equal((await amb.db.select().from(tarefa).where(and(eq(tarefa.tipo, "pdf_os"), eq(tarefa.referenciaId, o.id)))).length, 1);
      assert.deepEqual((await alertasDaOs(o.id, "os_ciencia")).map((a) => a.destinatario_id), [tecnico.id]);

      assert.equal((await h.concluir(supervisor, o.id)).corpo.erro.codigo, "ciencia_ja_dada");
    });

    it("só com a OS aguardando o supervisor; quem não supervisiona a equipe não assina", async () => {
      const { o, execId } = await osEmExecucao();
      const emExecucao = await h.concluir(supervisor, o.id);
      assert.equal(emExecucao.status, 409);
      assert.equal(emExecucao.corpo.erro.codigo, "os_nao_aguardando_supervisor");

      await h.clicarEncerrar(tecnico, o.id, execId);
      const encerrando = await h.concluir(supervisor, o.id);
      assert.equal(encerrando.corpo.erro.codigo, "os_nao_aguardando_supervisor");
      assert.match(encerrando.corpo.erro.mensagem, /responsável ainda não assinou/);

      await h.assinarEncerramento(tecnico, o.id, execId);
      assert.equal((await h.concluir(colega, o.id)).status, 403);
      assert.equal((await h.concluir(deFora, o.id)).status, 403);
      assert.equal((await h.concluir(supervisor, o.id)).status, 200);
    });

    it("o supervisor que participou do serviço também assina por último", async () => {
      // O supervisor da equipe é um dos participantes da APR e quem executa.
      const o = await novaOs();
      const aprId = await registrarApr(o.id, [supervisor, tecnico]);
      await h.assinarApr(aprId, o.id, [supervisor, tecnico]);
      const execId = await h.iniciar(supervisor, o.id, aprId);
      await h.encerrar(supervisor, o.id, execId);
      assert.equal(await statusDa(o.id), "aguardando_supervisor");
      const r = await h.concluir(supervisor, o.id);
      assert.equal(r.status, 200, JSON.stringify(r.corpo));
      assert.equal(await statusDa(o.id), "encerrada");
    });

    it("a OS depois da execução não aceita APR nova nem execução nova", async () => {
      const { o } = await osAguardandoSupervisor();
      const nova = await h.enviar(tecnico, h.evento("apr_concluida", payloadApr([tecnico, colega]), o.id));
      assert.equal(codigoDaRecusa(nova), "os_encerrada");
      await h.concluir(supervisor, o.id);
      const depois = await h.enviar(tecnico, h.evento("apr_concluida", payloadApr([tecnico, colega]), o.id));
      assert.equal(codigoDaRecusa(depois), "os_encerrada");
    });

    it("o detalhe da OS traz a localização, o motivo da pausa e o estado das assinaturas da APR", async () => {
      const { o, aprId, execId } = await osEmExecucao();
      const pausaId = randomUUID();
      await h.enviar(tecnico, h.evento("pausa_iniciada", { id: pausaId, execucao_id: execId, inicio: h.agora(), motivo: "outro", complemento: "Trânsito", ...POSICAO }, o.id));
      await h.enviar(tecnico, h.evento("pausa_encerrada", { pausa_id: pausaId, fim: h.agora() }, o.id));
      await h.encerrar(tecnico, o.id, execId);

      const d = await amb.esperar(200, "GET", `/os/${o.id}`, { como: supervisor });
      assert.equal(d.os.status, "aguardando_supervisor");
      const e = d.execucoes[0];
      assert.deepEqual(e.localizacao_inicio, POSICAO);
      assert.deepEqual(e.localizacao_fim, POSICAO);
      assert.ok(e.encerramento_assinado_em);
      assert.equal(e.pausas[0].motivo, "outro");
      assert.equal(e.pausas[0].complemento, "Trânsito");
      assert.deepEqual(e.pausas[0].localizacao, POSICAO);
      const participantes = d.aprs.find((a: { id: string }) => a.id === aprId).participantes;
      assert.ok(participantes.every((p: { assinada_em: string | null; assinatura_presencial: boolean; recusou_em: string | null }) => p.assinada_em && !p.assinatura_presencial && p.recusou_em === null));
      const linha = d.linha_do_tempo.map((i: { tipo: string; descricao: string }) => `${i.tipo}: ${i.descricao}`).join("\n");
      assert.match(linha, /apr_assinada: Carla Colega assinou a APR/);
      assert.match(linha, /pausa_iniciada: Pausa iniciada \(Outro: Trânsito\)/);
      assert.match(linha, /encerramento_assinado: Encerramento assinado por Tiago Técnico/);

      const quadro = await amb.esperar(200, "GET", "/os", { como: supervisor, consulta: { status: "aguardando_supervisor" } });
      assert.ok(quadro.os.map((x: { id: string }) => x.id).includes(o.id));
      assert.ok(quadro.os.every((x: { status: string }) => x.status === "aguardando_supervisor"));
      assert.ok(quadro.contagem_por_status.aguardando_supervisor >= 1);
      assert.equal(quadro.contagem_por_status.encerrando >= 0, true);
    });
  });
});
