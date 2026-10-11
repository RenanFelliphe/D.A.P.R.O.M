import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { itemModeloApr, localInstalacao, modeloApr, os, riscoModeloApr, tarefa } from "../src/db/schema";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

describe("Eventos de campo: APR, execução e sync", () => {
  let amb: Ambiente;
  let equipeId: string;
  let supervisor: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;
  let colega: UsuarioDeTeste;
  let analista: UsuarioDeTeste;
  let modelo: { id: string; itens: (typeof itemModeloApr.$inferSelect)[]; riscos: (typeof riscoModeloApr.$inferSelect)[] };
  let localId: string;
  let contadorOs = 4000000;

  before(async () => {
    amb = await criarAmbiente({ comCarga: true });
    supervisor = await amb.criarUsuario({ perfil: "supervisor" });
    equipeId = (await amb.criarEquipe({ supervisorId: supervisor.id })).id;
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    colega = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    analista = await amb.criarUsuario({ perfil: "analista" });
    const [m] = await amb.db.select().from(modeloApr).where(eq(modeloApr.codigo, "APR 01"));
    modelo = {
      id: m!.id,
      itens: await amb.db.select().from(itemModeloApr).where(eq(itemModeloApr.modeloAprId, m!.id)),
      riscos: await amb.db.select().from(riscoModeloApr).where(eq(riscoModeloApr.modeloAprId, m!.id)),
    };
    [{ id: localId }] = (await amb.db.insert(localInstalacao).values({ codigo: "VILA VELHA/REDE" }).returning({ id: localInstalacao.id })) as [{ id: string }];
  });
  after(() => amb.fechar());

  async function novaOs(dados: Partial<typeof os.$inferInsert> = {}) {
    const [o] = await amb.db
      .insert(os)
      .values({ numeroOrdem: String(++contadorOs), tipo: "corretiva", titulo: "DCV Desobstrução", localInstalacaoId: localId, equipeId, dataInicioProg: "2026-10-11", origem: "sap", ...dados })
      .returning();
    return o!;
  }
  const statusDa = async (id: string) => (await amb.db.select({ s: os.status }).from(os).where(eq(os.id, id)))[0]!.s;
  const agora = () => amb.relogio.agora.toISOString();
  const evento = (tipo: string, payload: object, osId?: string, ocorrido = agora()) => ({ id: randomUUID(), tipo, os_id: osId ?? null, payload, ocorrido_em: ocorrido });
  const enviar = (como: UsuarioDeTeste, ...eventos: unknown[]) => amb.esperar(200, "POST", "/eventos", { como, json: { eventos } });
  const foto = async () => {
    const id = randomUUID();
    await amb.armazenamento.gravar("fotos", id, new Uint8Array([1]), "image/png");
    return id;
  };

  /** Respostas que não bloqueiam; com `bloquear`, o primeiro item eliminatório de verificação fica reprovado. */
  async function payloadApr(osId: string, opcoes: { bloquear?: boolean; comFoto?: boolean; semObservacao?: boolean; incompleta?: boolean; participantes?: UsuarioDeTeste[]; concluidaEm?: string } = {}) {
    const verificacao = modelo.itens.filter((i) => i.secao === "verificacao");
    const reprovado = opcoes.bloquear ? verificacao.find((i) => i.tipo === "eliminatorio")! : null;
    const respostas = verificacao.map((i) => {
      if (i.id === reprovado?.id) return { item_id: i.id, resposta: i.respostaBloqueante!, observacao: opcoes.semObservacao ? null : "Vazamento de gás" };
      return { item_id: i.id, resposta: i.respostaBloqueante === "sim" ? "nao" : "sim" };
    });
    const evidencias = reprovado && opcoes.comFoto !== false ? [{ id: await foto(), item_id: reprovado.id, capturada_em: agora(), latitude: -20.3, longitude: -40.3 }] : [];
    const quem = opcoes.participantes ?? [tecnico, colega];
    return {
      id: randomUUID(),
      modelo_apr_id: modelo.id,
      participantes: quem.map((u, i) => ({ usuario_id: u.id, funcao: i === 0 ? "responsavel" : "executor" })),
      riscos: [],
      respostas: opcoes.incompleta ? respostas.slice(1) : respostas,
      evidencias,
      observacao_geral: "Sem observações",
      concluida_em: opcoes.concluidaEm ?? agora(),
    };
  }
  async function aprAprovada(osId: string) {
    const p = await payloadApr(osId);
    const r = await enviar(tecnico, evento("apr_concluida", p, osId));
    assert.deepEqual(r.aprs, [{ id: p.id, resultado: "aprovada" }]);
    return p;
  }
  const iniciar = (osId: string, aprId: string, extra: Record<string, unknown> = {}) => {
    const id = randomUUID();
    return { id, ev: evento("execucao_iniciada", { id, apr_id: aprId, inicio: agora(), ...extra }, osId) };
  };
  async function encerrar(execucaoId: string, opcoes: { semFoto?: boolean; semAssinatura?: boolean } = {}) {
    return evento("execucao_encerrada", {
      execucao_id: execucaoId,
      fim: agora(),
      descricao_atividade: "Caixa de válvula desobstruída",
      evidencias: opcoes.semFoto ? [] : [{ id: await foto(), capturada_em: agora() }],
      assinaturas: [tecnico, colega].slice(0, opcoes.semAssinatura ? 1 : 2).map((u) => ({ usuario_id: u.id })),
    });
  }

  it("fluxo completo: APR aprovada → execução → pausa → encerramento, com tarefa de PDF e status derivado", async () => {
    const o = await novaOs();
    const apr = await aprAprovada(o.id);
    assert.equal(await statusDa(o.id), "liberada");

    const { id: execId, ev: iniciada } = iniciar(o.id, apr.id);
    const r1 = await enviar(tecnico, iniciada);
    assert.deepEqual(r1.os, [{ id: o.id, status: "em_execucao" }]);

    const pausaId = randomUUID();
    await enviar(tecnico, evento("pausa_iniciada", { id: pausaId, execucao_id: execId, inicio: agora(), motivo: "almoco" }));
    const pausa = await amb.sql<{ fim: string | null }>("select fim from execucao_pausa where id = $1", [pausaId]);
    assert.equal(pausa[0]!.fim, null);
    await enviar(tecnico, evento("pausa_encerrada", { pausa_id: pausaId, fim: agora() }));

    const r2 = await enviar(tecnico, await encerrar(execId));
    assert.deepEqual(r2.os, [{ id: o.id, status: "encerrada" }]);
    assert.equal(r2.rejeitados.length, 0);
    const tarefas = await amb.db.select().from(tarefa).where(and(eq(tarefa.tipo, "pdf_os"), eq(tarefa.referenciaId, o.id)));
    assert.equal(tarefas.length, 1);
    const assinaturas = await amb.sql("select * from execucao_assinatura where execucao_id = $1", [execId]);
    assert.equal(assinaturas.length, 2);
    // os eventos sem os_id no envelope ganham a OS depois
    const eventosDaOs = await amb.sql("select tipo from evento_campo where os_id = $1", [o.id]);
    assert.equal(eventosDaOs.length, 5);
  });

  it("reenviar o mesmo evento não tem efeito e é confirmado de novo", async () => {
    const o = await novaOs();
    const p = await payloadApr(o.id);
    const e = evento("apr_concluida", p, o.id);
    const a = await enviar(tecnico, e);
    const b = await enviar(tecnico, e);
    assert.deepEqual(b.confirmados, [e.id]);
    assert.deepEqual(b.aprs, a.aprs);
    assert.equal((await amb.sql("select 1 from apr where os_id = $1", [o.id])).length, 1);
    assert.equal((await amb.sql("select 1 from evento_campo where id = $1", [e.id])).length, 1);
  });

  it("APR com item reprovado: bloqueada, OS pendente, alerta ao supervisor e tarefa de e-mail", async () => {
    const o = await novaOs();
    const p = await payloadApr(o.id, { bloquear: true });
    const r = await enviar(tecnico, evento("apr_concluida", p, o.id));
    assert.deepEqual(r.aprs, [{ id: p.id, resultado: "bloqueada" }]);
    assert.deepEqual(r.os, [{ id: o.id, status: "pendente" }]);
    assert.equal(r.alertas.length, 1);

    const alertas = await amb.sql<{ tipo: string; destinatario_id: string }>("select tipo, destinatario_id from alerta where os_id = $1", [o.id]);
    assert.deepEqual(alertas.map((a) => [a.tipo, a.destinatario_id]), [["bloqueio", supervisor.id]]);
    const emails = await amb.db.select().from(tarefa).where(and(eq(tarefa.tipo, "email_alerta"), eq(tarefa.referenciaId, r.alertas[0])));
    assert.equal(emails.length, 1);

    // O resultado enviado pelo aparelho é só conferido: o servidor recalcula.
    const o2 = await novaOs();
    const mentira = await payloadApr(o2.id, { bloquear: true });
    const r2 = await enviar(tecnico, evento("apr_concluida", { ...mentira, resultado: "aprovada" }, o2.id));
    assert.equal(r2.aprs[0].resultado, "bloqueada");

    // Uma APR bloqueada não impede nova tentativa; com a nova aprovada e a execução encerrada, a OS encerra.
    const nova = await aprAprovada(o.id);
    assert.equal(await statusDa(o.id), "pendente");
    const { id, ev } = iniciar(o.id, nova.id);
    await enviar(tecnico, ev);
    assert.equal(await statusDa(o.id), "em_execucao");
    await enviar(tecnico, await encerrar(id));
    assert.equal(await statusDa(o.id), "encerrada");
  });

  it("recusa APR incompleta, sem observação ou sem foto no item reprovado, e fora das regras de participantes", async () => {
    const o = await novaOs();
    const rejeitado = async (p: object, codigo: string) => {
      const r = await enviar(tecnico, evento("apr_concluida", p, o.id));
      assert.deepEqual(r.confirmados, [], codigo);
      assert.equal(r.rejeitados[0].codigo, codigo);
      return r.rejeitados[0];
    };
    const faltam = await rejeitado(await payloadApr(o.id, { incompleta: true }), "respostas_incompletas");
    assert.match(faltam.mensagem, /Faltam respostas em 1 item/);
    const semFoto = await rejeitado(await payloadApr(o.id, { bloquear: true, comFoto: false }), "evidencia_faltando");
    assert.equal(semFoto.mensagem, "Falta evidência em 1 item(ns)");
    await rejeitado(await payloadApr(o.id, { bloquear: true, semObservacao: true }), "evidencia_faltando");
    await rejeitado({ ...(await payloadApr(o.id)), participantes: [{ usuario_id: colega.id, funcao: "responsavel" }] }, "participante_obrigatorio");
    await rejeitado({ ...(await payloadApr(o.id)), participantes: [{ usuario_id: tecnico.id, funcao: "executor" }] }, "responsavel_obrigatorio");
    await rejeitado({ ...(await payloadApr(o.id)), modelo_apr_id: randomUUID() }, "modelo_invalido");
    await rejeitado({ ...(await payloadApr(o.id)), riscos: [randomUUID()] }, "risco_invalido");
    await rejeitado({ ...(await payloadApr(o.id)), id: "nao-e-uuid" }, "payload_invalido");
    assert.equal((await amb.sql("select 1 from apr where os_id = $1", [o.id])).length, 0);
    assert.equal((await amb.sql("select 1 from evento_campo where os_id = $1", [o.id])).length, 0);
  });

  it("foto que ainda não subiu deixa o evento pendente; depois do envio ele passa", async () => {
    const o = await novaOs();
    const p = await payloadApr(o.id, { bloquear: true });
    const fotoId = p.evidencias[0]!.id;
    amb.armazenamento.arquivos.delete(`fotos/${fotoId}`);
    const e = evento("apr_concluida", p, o.id);
    const r = await enviar(tecnico, e);
    assert.equal(r.pendentes[0].codigo, "arquivo_ausente");
    assert.deepEqual(r.confirmados, []);
    await amb.armazenamento.gravar("fotos", fotoId, new Uint8Array([1]), "image/png");
    const r2 = await enviar(tecnico, e);
    assert.deepEqual(r2.confirmados, [e.id]);
  });

  it("só marca respostas das medidas dos riscos marcados", async () => {
    const o = await novaOs();
    const risco = modelo.riscos[0]!;
    const medidas = modelo.itens.filter((i) => i.riscoId === risco.id);
    assert.ok(medidas.length > 0);
    const base = await payloadApr(o.id);

    const semMedidas = await enviar(tecnico, evento("apr_concluida", { ...base, riscos: [risco.id] }, o.id));
    assert.equal(semMedidas.rejeitados[0].codigo, "respostas_incompletas");
    const foraDosRiscos = await enviar(tecnico, evento("apr_concluida", { ...base, respostas: [...base.respostas, { item_id: medidas[0]!.id, resposta: "sim" }] }, o.id));
    assert.equal(foraDosRiscos.rejeitados[0].codigo, "resposta_fora_dos_riscos");
    const ok = await enviar(tecnico, evento("apr_concluida", { ...base, riscos: [risco.id], respostas: [...base.respostas, ...medidas.map((m) => ({ item_id: m.id, resposta: "sim" }))] }, o.id));
    assert.equal(ok.aprs[0].resultado, "aprovada");
  });

  it('"NA" só onde o item permite, com observação', async () => {
    const o = await novaOs();
    const base = await payloadApr(o.id);
    const [primeiro, ...resto] = base.respostas;
    const r = await enviar(tecnico, evento("apr_concluida", { ...base, respostas: [{ item_id: primeiro!.item_id, resposta: "na", observacao: "x" }, ...resto] }, o.id));
    assert.equal(r.rejeitados[0].codigo, "na_nao_permitido");
  });

  it("recusa iniciar sem APR aprovada, APR de outra OS, de outro dia e já usada", async () => {
    const o = await novaOs();
    const bloqueada = await payloadApr(o.id, { bloquear: true });
    await enviar(tecnico, evento("apr_concluida", bloqueada, o.id));
    const a = iniciar(o.id, bloqueada.id);
    const r = await enviar(tecnico, a.ev);
    assert.equal(r.rejeitados[0].codigo, "apr_invalida");
    assert.equal(r.rejeitados[0].mensagem, "Preencha a APR antes de iniciar");

    const semApr = await enviar(tecnico, iniciar(o.id, randomUUID()).ev);
    assert.equal(semApr.pendentes[0].codigo, "apr_ausente");

    const outraOs = await novaOs();
    const aprOutra = await aprAprovada(outraOs.id);
    assert.equal((await enviar(tecnico, iniciar(o.id, aprOutra.id).ev)).rejeitados[0].codigo, "apr_invalida");

    const ontem = new Date(amb.relogio.agora.getTime() - 36 * 3600_000).toISOString();
    const o3 = await novaOs();
    const velha = await payloadApr(o3.id, { concluidaEm: ontem });
    await enviar(tecnico, evento("apr_concluida", velha, o3.id));
    assert.equal((await enviar(tecnico, iniciar(o3.id, velha.id).ev)).rejeitados[0].codigo, "apr_vencida");

    const o4 = await novaOs();
    const usada = await aprAprovada(o4.id);
    await enviar(tecnico, iniciar(o4.id, usada.id).ev);
    assert.equal((await enviar(tecnico, iniciar(o4.id, usada.id).ev)).rejeitados[0].codigo, "apr_ja_usada");
  });

  it("cancelar por engano devolve a APR; só até 10 minutos e sem pausa", async () => {
    const o = await novaOs();
    const apr = await aprAprovada(o.id);
    const { id, ev } = iniciar(o.id, apr.id);
    await enviar(tecnico, ev);
    assert.equal(await statusDa(o.id), "em_execucao");

    const r = await enviar(tecnico, evento("execucao_cancelada", { execucao_id: id }));
    assert.equal(r.os[0].status, "liberada");
    const de_novo = iniciar(o.id, apr.id);
    assert.deepEqual((await enviar(tecnico, de_novo.ev)).confirmados, [de_novo.ev.id]);

    const tarde = await enviar(tecnico, evento("execucao_cancelada", { execucao_id: de_novo.id }, undefined, new Date(amb.relogio.agora.getTime() + 11 * 60_000).toISOString()));
    assert.equal(tarde.rejeitados[0].codigo, "cancelamento_fora_do_prazo");

    const o2 = await novaOs();
    const apr2 = await aprAprovada(o2.id);
    const e2 = iniciar(o2.id, apr2.id);
    await enviar(tecnico, e2.ev);
    await enviar(tecnico, evento("pausa_iniciada", { id: randomUUID(), execucao_id: e2.id, inicio: agora() }));
    assert.equal((await enviar(tecnico, evento("execucao_cancelada", { execucao_id: e2.id }))).rejeitados[0].codigo, "cancelamento_invalido");
  });

  it("suspender deixa a OS pendente sem alerta; interromper exige motivo e foto e gera alerta de bloqueio", async () => {
    const o = await novaOs();
    const apr = await aprAprovada(o.id);
    const e = iniciar(o.id, apr.id);
    await enviar(tecnico, e.ev);
    await enviar(tecnico, evento("pausa_iniciada", { id: randomUUID(), execucao_id: e.id, inicio: agora() }));
    const r = await enviar(tecnico, evento("execucao_suspensa", { execucao_id: e.id, fim: agora() }));
    assert.deepEqual(r.os, [{ id: o.id, status: "pendente" }]);
    assert.equal(r.alertas.length, 0);
    assert.equal((await amb.sql("select 1 from execucao_pausa where execucao_id = $1 and fim is null", [e.id])).length, 0, "a pausa aberta é fechada");

    // Retomada: APR nova, qualquer pessoa da equipe.
    const o2 = await novaOs();
    const apr2 = await aprAprovada(o2.id);
    const e2 = iniciar(o2.id, apr2.id);
    await enviar(tecnico, e2.ev);
    const semFoto = await enviar(tecnico, evento("execucao_interrompida", { execucao_id: e2.id, fim: agora(), motivo: "Vazamento", evidencias: [] }));
    assert.equal(semFoto.rejeitados[0].codigo, "interrupcao_incompleta");
    const ok = await enviar(tecnico, evento("execucao_interrompida", { execucao_id: e2.id, fim: agora(), motivo: "Vazamento", evidencias: [{ id: await foto(), capturada_em: agora() }] }));
    assert.deepEqual(ok.os, [{ id: o2.id, status: "pendente" }]);
    assert.equal(ok.alertas.length, 1);
    assert.equal((await amb.sql<{ tipo: string }>("select tipo from alerta where id = $1", [ok.alertas[0]]))[0]!.tipo, "bloqueio");
  });

  it("encerramento exige descrição, foto e a assinatura de todos; encerrar de novo não duplica", async () => {
    const o = await novaOs();
    const apr = await aprAprovada(o.id);
    const e = iniciar(o.id, apr.id);
    await enviar(tecnico, e.ev);
    for (const opc of [{ semFoto: true }, { semAssinatura: true }]) {
      const r = await enviar(tecnico, await encerrar(e.id, opc));
      assert.equal(r.rejeitados[0].codigo, "encerramento_incompleto");
      assert.equal(r.rejeitados[0].mensagem, "Descrição, foto e assinaturas de todos são obrigatórias");
    }
    // Ninguém encerra a execução de outro.
    const doColega = await enviar(colega, await encerrar(e.id));
    assert.equal(doColega.rejeitados[0].codigo, "execucao_de_outro");
    await enviar(tecnico, await encerrar(e.id));
    const repetido = await enviar(tecnico, await encerrar(e.id));
    assert.equal(repetido.confirmados.length, 1);
    assert.equal((await amb.db.select().from(tarefa).where(and(eq(tarefa.tipo, "pdf_os"), eq(tarefa.referenciaId, o.id)))).length, 1);
  });

  it("conflitos: online recusa OS já em execução; da fila offline aplica e gera alerta execucao_duplicada", async () => {
    const o = await novaOs();
    const apr1 = await aprAprovada(o.id);
    await enviar(tecnico, iniciar(o.id, apr1.id).ev);

    const aprColega = await payloadApr(o.id, { participantes: [colega, tecnico] });
    const online = await enviar(colega, evento("apr_concluida", aprColega, o.id));
    assert.equal(online.rejeitados[0].codigo, "os_em_execucao");
    assert.equal(online.rejeitados[0].mensagem, "Esta OS já está em execução");

    const duasHorasAtras = new Date(amb.relogio.agora.getTime() - 2 * 3600_000).toISOString();
    const offline = await enviar(colega, evento("apr_concluida", { ...aprColega, concluida_em: duasHorasAtras }, o.id, duasHorasAtras));
    assert.equal(offline.aprs[0].resultado, "aprovada");
    assert.equal(offline.alertas.length, 1);
    assert.equal((await amb.sql<{ tipo: string }>("select tipo from alerta where id = $1", [offline.alertas[0]]))[0]!.tipo, "execucao_duplicada");
  });

  it("OS reatribuída enquanto o técnico estava offline: aplica o evento e alerta conflito_planejamento; outra equipe é recusada", async () => {
    const outraEquipe = await amb.criarEquipe();
    const o = await novaOs();
    const p = await payloadApr(o.id);
    const antes = new Date(amb.relogio.agora.getTime() - 3600_000).toISOString();
    await amb.sql("insert into reprogramacao (os_id, usuario_id, data_anterior, data_nova, equipe_anterior_id, equipe_nova_id, justificativa) values ($1,$2,'2026-10-11','2026-10-12',$3,$4,'troca')", [o.id, analista.id, equipeId, outraEquipe.id]);
    await amb.db.update(os).set({ equipeId: outraEquipe.id }).where(eq(os.id, o.id));
    const r = await enviar(tecnico, evento("apr_concluida", { ...p, concluida_em: antes }, o.id, antes));
    assert.equal(r.aprs[0].resultado, "aprovada");
    assert.equal(r.alertas.length, 1);
    assert.equal((await amb.sql<{ tipo: string }>("select tipo from alerta where id = $1", [r.alertas[0]]))[0]!.tipo, "conflito_planejamento");

    const intruso = await amb.criarUsuario({ perfil: "tecnico", equipeId: (await amb.criarEquipe()).id });
    const o2 = await novaOs();
    const fora = await enviar(intruso, evento("apr_concluida", await payloadApr(o2.id, { participantes: [intruso] }), o2.id));
    assert.equal(fora.rejeitados[0].codigo, "fora_da_equipe");
  });

  it("OS de apoio encerrada avisa o supervisor da original, que continua pendente", async () => {
    const original = await novaOs();
    await enviar(tecnico, evento("apr_concluida", await payloadApr(original.id, { bloquear: true }), original.id));
    const outraEquipe = await amb.criarEquipe({ supervisorId: (await amb.criarUsuario({ perfil: "supervisor" })).id });
    const apoio = await novaOs({ osOrigemId: original.id, origem: "manual", numeroOrdem: null });
    assert.ok(outraEquipe.id);
    const apr = await aprAprovada(apoio.id);
    const e = iniciar(apoio.id, apr.id);
    await enviar(tecnico, e.ev);
    const r = await enviar(tecnico, await encerrar(e.id));
    assert.equal(r.alertas.length, 1);
    const [a] = await amb.sql<{ tipo: string; os_id: string }>("select tipo, os_id from alerta where id = $1", [r.alertas[0]]);
    assert.deepEqual([a!.tipo, a!.os_id], ["apoio_encerrado", original.id]);
    assert.equal(await statusDa(original.id), "pendente");
  });

  it("perfis: só o técnico envia eventos; sem token é 401; envio vazio é 422", async () => {
    assert.equal((await amb.req("POST", "/eventos", { como: supervisor, json: { eventos: [evento("execucao_suspensa", {})] } })).status, 403);
    assert.equal((await amb.req("POST", "/eventos", { json: { eventos: [] } })).status, 401);
    assert.equal((await amb.req("POST", "/eventos", { como: tecnico, json: { eventos: [] } })).status, 422);
  });

  it("usuário desativado ainda envia a fila pendente e depois tem a sessão revogada", async () => {
    const saindo = await amb.criarUsuario({ perfil: "tecnico", equipeId, ativo: true });
    const o = await novaOs();
    await amb.sql("update usuario set ativo = false where id = $1", [saindo.id]);
    assert.equal((await amb.req("GET", "/equipes", { como: saindo })).status, 401);
    const p = await payloadApr(o.id, { participantes: [saindo, colega] });
    const r = await amb.esperar(200, "POST", "/eventos", { como: saindo, json: { eventos: [evento("apr_concluida", p, o.id)] } });
    assert.equal(r.aprs[0].resultado, "aprovada");
    assert.equal(r.acesso_revogado, true);
    assert.equal(await amb.auth.entrar(`${saindo.matricula.toLowerCase()}@daprom.local`, saindo.senha), null, "conta revogada");
  });

  it("POST /sync/pull entrega o snapshot da equipe: OS abertas, APRs, execuções, modelos, atividades, locais e usuários", async () => {
    const o = await novaOs();
    const apr = await aprAprovada(o.id);
    const e = iniciar(o.id, apr.id);
    await enviar(tecnico, e.ev);
    const encerradaOutra = await novaOs();
    await amb.db.update(os).set({ status: "encerrada" }).where(eq(os.id, encerradaOutra.id));
    const outraEquipe = await novaOs({ equipeId: (await amb.criarEquipe()).id });

    const snap = await amb.esperar(200, "POST", "/sync/pull", { como: tecnico });
    const ids = snap.os.map((x: any) => x.id);
    assert.ok(ids.includes(o.id));
    assert.ok(!ids.includes(encerradaOutra.id), "encerrada que não é do técnico fica de fora");
    assert.ok(!ids.includes(outraEquipe.id));
    assert.equal(snap.aprs.find((a: any) => a.id === apr.id).participantes.length, 2);
    assert.equal(snap.execucoes.find((x: any) => x.id === e.id).resultado, null);
    assert.ok(snap.modelos_apr.length >= 8 && snap.modelos_apr[0].itens.length > 0 && snap.modelos_apr[0].riscos.length > 0);
    assert.ok(snap.atividades.length > 100);
    assert.ok(snap.locais.some((l: any) => l.id === localId));
    assert.ok(snap.usuarios.some((u: any) => u.id === colega.id) && snap.usuarios.every((u: any) => !("email" in u)));
    assert.ok(snap.cursor);

    assert.equal((await amb.req("POST", "/sync/pull", { como: analista })).status, 403);
    assert.equal((await amb.req("POST", "/sync/pull")).status, 401);
  });
});
