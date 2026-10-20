import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { itemModeloApr, localInstalacao, modeloApr, os, riscoModeloApr, tarefa } from "../src/db/schema";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";
import { POSICAO, ajudaDeExecucao } from "./ajuda-execucao";

describe("Eventos de campo: APR, execução e sync", () => {
  let amb: Ambiente;
  let h: ReturnType<typeof ajudaDeExecucao>;
  let equipeId: string;
  let supervisor: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;
  let colega: UsuarioDeTeste;
  let terceiro: UsuarioDeTeste;
  let admin: UsuarioDeTeste;
  let modelo: { id: string; itens: (typeof itemModeloApr.$inferSelect)[]; riscos: (typeof riscoModeloApr.$inferSelect)[] };
  let localId: string;
  let contadorOs = 4000000;

  before(async () => {
    amb = await criarAmbiente({ comCarga: true });
    h = ajudaDeExecucao(amb);
    supervisor = await amb.criarUsuario({ perfil: "tecnico" });
    equipeId = (await amb.criarEquipe({ supervisorId: supervisor.id })).id;
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    colega = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    terceiro = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    admin = await amb.criarUsuario({ perfil: "admin" });
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
  /** Registra a APR aprovada do técnico (a APR sai sem assinaturas); com `assinar` (o padrão), cada participante assina na própria conta. */
  async function aprAprovada(osId: string, assinar = true) {
    const p = await payloadApr(osId);
    const r = await enviar(tecnico, evento("apr_concluida", p, osId));
    assert.deepEqual(r.aprs, [{ id: p.id, resultado: "aprovada" }]);
    if (assinar) await h.assinarApr(p.id, osId, [tecnico, colega]);
    return p;
  }
  const iniciar = (osId: string, aprId: string, extra: Record<string, unknown> = {}) => {
    const id = randomUUID();
    return { id, ev: evento("execucao_iniciada", { id, apr_id: aprId, inicio: agora(), ...extra }, osId) };
  };
  /** O clique em "Encerrar OS" (o tempo para e a OS fica `encerrando`) e o preenchimento assinado pelo responsável (`aguardando_supervisor`). */
  const clicarEncerrar = (execucaoId: string) => evento("execucao_encerrada", { execucao_id: execucaoId, fim: agora(), ...POSICAO });
  const assinarEncerramento = (execucaoId: string, extra: Record<string, unknown> = {}) =>
    evento("encerramento_assinado", { execucao_id: execucaoId, descricao_atividade: "Caixa de válvula desobstruída", ...extra });
  const tarefasDePdf = (osId: string) => amb.db.select().from(tarefa).where(and(eq(tarefa.tipo, "pdf_os"), eq(tarefa.referenciaId, osId)));

  it("fluxo completo: APR aprovada → assinaturas → execução → pausa → encerramento em dois passos → assinatura do supervisor, com tarefa de PDF e status derivado", async () => {
    const o = await novaOs();
    const apr = await aprAprovada(o.id, false);
    assert.equal(await statusDa(o.id), "liberada");

    // A execução só começa quando todos assinaram a APR, cada um na própria conta.
    const { id: execId, ev: iniciada } = iniciar(o.id, apr.id);
    assert.equal((await enviar(tecnico, iniciada)).rejeitados[0].codigo, "apr_sem_assinaturas");
    await h.assinarApr(apr.id, o.id, [tecnico, colega]);
    const r1 = await enviar(tecnico, iniciada);
    assert.deepEqual(r1.os, [{ id: o.id, status: "em_execucao" }]);

    const pausaId = randomUUID();
    await enviar(tecnico, evento("pausa_iniciada", { id: pausaId, execucao_id: execId, inicio: agora(), motivo: "almoco" }));
    const pausa = await amb.sql<{ fim: string | null }>("select fim from execucao_pausa where id = $1", [pausaId]);
    assert.equal(pausa[0]!.fim, null);
    await enviar(tecnico, evento("pausa_encerrada", { pausa_id: pausaId, fim: agora() }));

    // Primeiro passo: o tempo para, a OS fica `encerrando` e nada é gerado ainda.
    const r2 = await enviar(tecnico, clicarEncerrar(execId));
    assert.deepEqual(r2.os, [{ id: o.id, status: "encerrando" }]);
    assert.equal(r2.rejeitados.length, 0);
    assert.equal((await tarefasDePdf(o.id)).length, 0);
    assert.equal((await amb.sql("select * from execucao_assinatura where execucao_id = $1", [execId])).length, 0);

    // Segundo passo: o responsável assina o encerramento e a OS passa a esperar o supervisor; o PDF continua sem sair.
    const r3 = await enviar(tecnico, assinarEncerramento(execId));
    assert.deepEqual(r3.os, [{ id: o.id, status: "aguardando_supervisor" }]);
    assert.equal(r3.rejeitados.length, 0);
    assert.equal((await tarefasDePdf(o.id)).length, 0);
    const assinaturas = await amb.sql<{ usuario_id: string }>("select usuario_id from execucao_assinatura where execucao_id = $1", [execId]);
    assert.deepEqual(assinaturas.map((a) => a.usuario_id), [tecnico.id], "só o responsável assina o encerramento");

    // O supervisor assina por último: a OS fica encerrada (concluída) e só então o PDF é enfileirado.
    const r4 = await h.concluir(supervisor, o.id);
    assert.equal(r4.status, 200, JSON.stringify(r4.corpo));
    assert.equal(await statusDa(o.id), "encerrada");
    assert.equal((await tarefasDePdf(o.id)).length, 1);
    // os eventos sem os_id no envelope ganham a OS depois (a APR, as duas assinaturas, o início, a pausa e os dois passos do encerramento)
    const eventosDaOs = await amb.sql<{ tipo: string }>("select tipo from evento_campo where os_id = $1", [o.id]);
    assert.equal(eventosDaOs.length, 8, "o início recusado (sem assinaturas) não fica registrado");
    assert.equal(eventosDaOs.filter((e) => e.tipo === "apr_assinada").length, 2);
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

    // Uma APR bloqueada não impede nova tentativa; com a nova aprovada e assinada e a execução encerrada, a OS passa pelas assinaturas
    // do responsável e do supervisor até encerrar.
    const nova = await aprAprovada(o.id);
    assert.equal(await statusDa(o.id), "pendente");
    const { id, ev } = iniciar(o.id, nova.id);
    await enviar(tecnico, ev);
    assert.equal(await statusDa(o.id), "em_execucao");
    await enviar(tecnico, clicarEncerrar(id));
    assert.equal(await statusDa(o.id), "encerrando");
    await enviar(tecnico, assinarEncerramento(id));
    assert.equal(await statusDa(o.id), "aguardando_supervisor");
    assert.equal((await h.concluir(supervisor, o.id)).status, 200);
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
    // A APR exige ao menos 2 participantes (ninguém executa sozinho), e o técnico logado é um deles.
    await rejeitado({ ...(await payloadApr(o.id)), participantes: [{ usuario_id: tecnico.id, funcao: "responsavel" }] }, "participantes_insuficientes");
    await rejeitado({ ...(await payloadApr(o.id)), participantes: [{ usuario_id: colega.id, funcao: "responsavel" }, { usuario_id: terceiro.id, funcao: "executor" }] }, "participante_obrigatorio");
    await rejeitado({ ...(await payloadApr(o.id)), participantes: [{ usuario_id: tecnico.id, funcao: "executor" }, { usuario_id: colega.id, funcao: "executor" }] }, "responsavel_obrigatorio");
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
    // A APR de ontem não pode mais ser assinada (`apr_vencida`); o modo offline já traz as assinaturas, então vale como "assinada".
    const velha = { ...(await payloadApr(o3.id, { concluidaEm: ontem })), assinatura_presencial: true };
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
    // O cancelamento por engano é assinado: a execução guarda a imagem do perfil de quem cancelou.
    assert.equal((await amb.sql<{ p: string | null }>("select assinatura_do_resultado_path as p from execucao where id = $1", [id]))[0]!.p, await amb.assinaturaDe(tecnico));
    const de_novo = iniciar(o.id, apr.id);
    assert.deepEqual((await enviar(tecnico, de_novo.ev)).confirmados, [de_novo.ev.id]);

    const tarde = await enviar(tecnico, evento("execucao_cancelada", { execucao_id: de_novo.id }, undefined, new Date(amb.relogio.agora.getTime() + 11 * 60_000).toISOString()));
    assert.equal(tarde.rejeitados[0].codigo, "cancelamento_fora_do_prazo");

    const o2 = await novaOs();
    const apr2 = await aprAprovada(o2.id);
    const e2 = iniciar(o2.id, apr2.id);
    await enviar(tecnico, e2.ev);
    await enviar(tecnico, evento("pausa_iniciada", { id: randomUUID(), execucao_id: e2.id, inicio: agora(), motivo: "almoco" }));
    assert.equal((await enviar(tecnico, evento("execucao_cancelada", { execucao_id: e2.id }))).rejeitados[0].codigo, "cancelamento_invalido");
  });

  it("suspender deixa a OS pendente sem alerta; interromper exige motivo e foto e gera alerta de bloqueio", async () => {
    const o = await novaOs();
    const apr = await aprAprovada(o.id);
    const e = iniciar(o.id, apr.id);
    await enviar(tecnico, e.ev);
    await enviar(tecnico, evento("pausa_iniciada", { id: randomUUID(), execucao_id: e.id, inicio: agora(), motivo: "almoco" }));
    // Suspender pede o motivo (e o complemento, no "outro"); sem ele nada acontece.
    assert.equal((await enviar(tecnico, evento("execucao_suspensa", { execucao_id: e.id, fim: agora() }))).rejeitados[0].codigo, "motivo_obrigatorio");
    assert.equal((await enviar(tecnico, evento("execucao_suspensa", { execucao_id: e.id, fim: agora(), motivo: "outro" }))).rejeitados[0].codigo, "complemento_obrigatorio");
    assert.equal(await statusDa(o.id), "em_execucao");
    const r = await enviar(tecnico, evento("execucao_suspensa", { execucao_id: e.id, fim: agora(), motivo: "fim_expediente", ...POSICAO }));
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
    // A interrupção por risco é assinada: a execução guarda a imagem do perfil de quem interrompeu.
    assert.equal((await amb.sql<{ p: string | null }>("select assinatura_do_resultado_path as p from execucao where id = $1", [e2.id]))[0]!.p, await amb.assinaturaDe(tecnico));
    assert.equal((await amb.sql<{ tipo: string }>("select tipo from alerta where id = $1", [ok.alertas[0]]))[0]!.tipo, "bloqueio");
  });

  it("encerramento em dois passos: só quem executou, descrição e fotos opcionais; encerrar de novo não duplica e o PDF só sai com o supervisor", async () => {
    const o = await novaOs();
    const apr = await aprAprovada(o.id);
    const e = iniciar(o.id, apr.id);
    await enviar(tecnico, e.ev);
    // Antes do clique em "Encerrar OS" não há o que assinar.
    assert.equal((await enviar(tecnico, assinarEncerramento(e.id))).rejeitados[0].codigo, "execucao_nao_encerrada");
    // O colega que participa da APR, com sinal, não encerra na hora: pede ao responsável (execução compartilhada). Nem assina o encerramento de quem encerrou.
    assert.equal((await enviar(colega, clicarEncerrar(e.id))).rejeitados[0].codigo, "pedido_necessario");
    await enviar(tecnico, clicarEncerrar(e.id));
    assert.equal(await statusDa(o.id), "encerrando");
    assert.equal((await enviar(colega, assinarEncerramento(e.id))).rejeitados[0].codigo, "encerramento_de_outro");
    const repetido = await enviar(tecnico, clicarEncerrar(e.id));
    assert.equal(repetido.confirmados.length, 1);
    assert.equal(await statusDa(o.id), "encerrando");

    // A descrição e as fotos são opcionais: só o `execucao_id` já basta.
    const assinado = await enviar(tecnico, evento("encerramento_assinado", { execucao_id: e.id }));
    assert.deepEqual(assinado.rejeitados, []);
    assert.deepEqual(assinado.os, [{ id: o.id, status: "aguardando_supervisor" }]);
    const [exec] = await amb.sql<{ descricao_atividade: string | null; encerramento_assinado_em: string | null }>("select descricao_atividade, encerramento_assinado_em from execucao where id = $1", [e.id]);
    assert.equal(exec!.descricao_atividade, null);
    assert.ok(exec!.encerramento_assinado_em);
    assert.equal((await amb.sql("select 1 from evidencia where execucao_id = $1", [e.id])).length, 0);
    // Assinar de novo não duplica nada.
    assert.equal((await enviar(tecnico, assinarEncerramento(e.id))).rejeitados.length, 0);
    assert.equal((await amb.sql("select 1 from execucao_assinatura where execucao_id = $1", [e.id])).length, 1);
    assert.equal((await tarefasDePdf(o.id)).length, 0, "o PDF só é enfileirado quando o supervisor assina");
    assert.equal((await h.concluir(supervisor, o.id)).status, 200);
    assert.equal((await tarefasDePdf(o.id)).length, 1);
    assert.equal((await h.concluir(supervisor, o.id)).corpo.erro.codigo, "ciencia_ja_dada");
    assert.equal((await tarefasDePdf(o.id)).length, 1);
  });

  it("o encerramento grava a descrição e as fotos quando vêm; a foto só é obrigatória na interrupção por risco", async () => {
    const o = await novaOs();
    const apr = await aprAprovada(o.id);
    const e = iniciar(o.id, apr.id);
    await enviar(tecnico, e.ev);
    await enviar(tecnico, clicarEncerrar(e.id));
    const r = await enviar(tecnico, assinarEncerramento(e.id, { evidencias: [{ id: await foto(), capturada_em: agora(), ...POSICAO }] }));
    assert.deepEqual(r.rejeitados, []);
    assert.equal((await amb.sql<{ descricao_atividade: string }>("select descricao_atividade from execucao where id = $1", [e.id]))[0]!.descricao_atividade, "Caixa de válvula desobstruída");
    assert.equal((await amb.sql("select 1 from evidencia where execucao_id = $1", [e.id])).length, 1);

    // A interrupção por risco continua pedindo ao menos uma foto.
    const o2 = await novaOs();
    const apr2 = await aprAprovada(o2.id);
    const e2 = iniciar(o2.id, apr2.id);
    await enviar(tecnico, e2.ev);
    const semFoto = await enviar(tecnico, evento("execucao_interrompida", { execucao_id: e2.id, fim: agora(), motivo: "Vazamento", evidencias: [] }));
    assert.equal(semFoto.rejeitados[0].codigo, "interrupcao_incompleta");
  });

  it("sem sinal, a execução amparada por uma APR que o servidor bloqueou é aplicada e vira alerta; online continua recusada (D1)", async () => {
    const duasHorasAtras = new Date(amb.relogio.agora.getTime() - 2 * 3600_000).toISOString();
    const o = await novaOs();
    // O aparelho sem sinal não validou a APR: manda "presencial", e o servidor a bloqueia (não há assinatura a copiar).
    const p = { ...(await payloadApr(o.id, { bloquear: true, semObservacao: true, comFoto: false, concluidaEm: duasHorasAtras })), assinatura_presencial: true };
    const aprRegistrada = await enviar(tecnico, evento("apr_concluida", p, o.id, duasHorasAtras));
    assert.deepEqual(aprRegistrada.aprs, [{ id: p.id, resultado: "bloqueada" }]);
    assert.equal(await statusDa(o.id), "pendente");

    const execId = randomUUID();
    const iniciada = evento("execucao_iniciada", { id: execId, apr_id: p.id, inicio: duasHorasAtras }, o.id, duasHorasAtras);
    const r = await enviar(tecnico, iniciada);
    assert.deepEqual(r.rejeitados, []);
    assert.deepEqual(r.pendentes, []);
    assert.deepEqual(r.confirmados, [iniciada.id]);
    assert.equal(r.alertas.length, 1);
    const [alerta] = await amb.sql<{ tipo: string; detalhe: string }>("select tipo, detalhe from alerta where id = $1", [r.alertas[0]]);
    assert.equal(alerta!.tipo, "bloqueio");
    assert.match(alerta!.detalhe, /sem sinal/);
    assert.equal(await statusDa(o.id), "em_execucao");

    // Reenviar não repete nada; e a mesma APR bloqueada não ampara uma segunda execução.
    assert.deepEqual((await enviar(tecnico, iniciada)).confirmados, [iniciada.id]);
    const segunda = await enviar(tecnico, evento("execucao_iniciada", { id: randomUUID(), apr_id: p.id, inicio: duasHorasAtras }, o.id, duasHorasAtras));
    assert.equal(segunda.rejeitados[0].codigo, "apr_ja_usada");

    // Online (sem atraso) a APR bloqueada continua sem amparar a execução, e outra pessoa não executa com a APR bloqueada de alguém.
    const o2 = await novaOs();
    const bloqueadaOnline = await payloadApr(o2.id, { bloquear: true });
    await enviar(tecnico, evento("apr_concluida", bloqueadaOnline, o2.id));
    assert.equal((await enviar(tecnico, iniciar(o2.id, bloqueadaOnline.id).ev)).rejeitados[0].codigo, "apr_invalida");
    const o3 = await novaOs();
    const deOutro = { ...(await payloadApr(o3.id, { bloquear: true, semObservacao: true, comFoto: false, concluidaEm: duasHorasAtras })), assinatura_presencial: true };
    await enviar(tecnico, evento("apr_concluida", deOutro, o3.id, duasHorasAtras));
    const intruso = await enviar(colega, evento("execucao_iniciada", { id: randomUUID(), apr_id: deOutro.id, inicio: duasHorasAtras }, o3.id, duasHorasAtras));
    assert.equal(intruso.rejeitados[0].codigo, "apr_invalida");
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
    await amb.sql("insert into reprogramacao (os_id, usuario_id, data_anterior, data_nova, equipe_anterior_id, equipe_nova_id, justificativa) values ($1,$2,'2026-10-11','2026-10-12',$3,$4,'troca')", [o.id, admin.id, equipeId, outraEquipe.id]);
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
    const outraEquipe = await amb.criarEquipe({ supervisorId: (await amb.criarUsuario({ perfil: "tecnico" })).id });
    const apoio = await novaOs({ osOrigemId: original.id, origem: "apoio", numeroOrdem: null });
    assert.ok(outraEquipe.id);
    const apr = await aprAprovada(apoio.id);
    const e = iniciar(apoio.id, apr.id);
    await enviar(tecnico, e.ev);
    // O aviso ao supervisor da original sai na assinatura do encerramento, não no clique em "Encerrar OS".
    const clique = await enviar(tecnico, clicarEncerrar(e.id));
    assert.equal(clique.alertas.length, 0);
    const r = await enviar(tecnico, assinarEncerramento(e.id));
    // Dois avisos: o `os_para_assinar` ao supervisor da OS de apoio e o `apoio_encerrado` ao supervisor da original.
    assert.equal(r.alertas.length, 2);
    const avisos = await amb.sql<{ tipo: string; os_id: string }>("select tipo, os_id from alerta where id = any($1::uuid[]) order by tipo", [r.alertas]);
    assert.deepEqual(avisos.map((a) => [a.tipo, a.os_id]), [["apoio_encerrado", original.id], ["os_para_assinar", apoio.id]]);
    assert.equal(await statusDa(original.id), "pendente");
  });

  it("perfis: só o técnico envia eventos; o admin só gerencia (403); sem token é 401; envio vazio é 422", async () => {
    assert.equal((await amb.req("POST", "/eventos", { como: admin, json: { eventos: [evento("execucao_suspensa", {})] } })).status, 403);
    assert.equal((await amb.req("POST", "/eventos", { json: { eventos: [] } })).status, 401);
    assert.equal((await amb.req("POST", "/eventos", { como: tecnico, json: { eventos: [] } })).status, 422);
  });

  it("supervisor é um técnico: aplica APR, executa OS e baixa a cópia offline da equipe que supervisiona", async () => {
    const equipeSup = await amb.criarEquipe();
    const sup = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeSup.id, supervisor: true });
    assert.equal(sup.perfil, "tecnico");
    const parDoSup = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeSup.id });
    const o = await novaOs({ equipeId: equipeSup.id });
    const p = await payloadApr(o.id, { participantes: [sup, parDoSup] });
    const r = await enviar(sup, evento("apr_concluida", p, o.id));
    assert.deepEqual(r.aprs, [{ id: p.id, resultado: "aprovada" }]);
    await h.assinarApr(p.id, o.id, [sup, parDoSup]);
    const { id: execId, ev } = iniciar(o.id, p.id);
    const r2 = await enviar(sup, ev);
    assert.deepEqual(r2.os, [{ id: o.id, status: "em_execucao" }]);
    // O supervisor que executou também assina por último, depois do encerramento em dois passos.
    await enviar(sup, clicarEncerrar(execId));
    await enviar(sup, assinarEncerramento(execId));
    assert.equal(await statusDa(o.id), "aguardando_supervisor");
    assert.equal((await h.concluir(sup, o.id)).status, 200);
    assert.equal(await statusDa(o.id), "encerrada");
    await amb.esperar(200, "POST", "/sync/pull", { como: sup });
  });

  it("usuário desativado ainda envia a fila pendente e depois tem a sessão revogada; desativado não entra em APR nova", async () => {
    const saindo = await amb.criarUsuario({ perfil: "tecnico", equipeId, ativo: true });
    const o = await novaOs();
    // Enquanto estava ativo, o técnico fez a APR (com a colega) e iniciou a execução; o fim do serviço ficou na fila do aparelho.
    const p = await payloadApr(o.id, { participantes: [saindo, colega] });
    assert.deepEqual((await enviar(saindo, evento("apr_concluida", p, o.id))).rejeitados, []);
    await h.assinarApr(p.id, o.id, [saindo, colega]);
    const { id: execId, ev } = iniciar(o.id, p.id);
    assert.deepEqual((await enviar(saindo, ev)).rejeitados, []);

    await amb.sql("update usuario set ativo = false where id = $1", [saindo.id]);
    assert.equal((await amb.req("GET", "/equipes", { como: saindo })).status, 401);
    const fila = await amb.esperar(200, "POST", "/eventos", { como: saindo, json: { eventos: [clicarEncerrar(execId), assinarEncerramento(execId)] } });
    assert.deepEqual(fila.rejeitados, []);
    assert.deepEqual(fila.os.at(-1), { id: o.id, status: "aguardando_supervisor" });
    assert.equal(fila.acesso_revogado, true);
    assert.equal(await amb.auth.entrar(saindo.email, saindo.senha), null, "conta revogada");

    // Quem foi desligado não pode mais entrar numa APR nova.
    const o2 = await novaOs();
    const recusada = await enviar(colega, evento("apr_concluida", await payloadApr(o2.id, { participantes: [colega, saindo] }), o2.id));
    assert.equal(recusada.rejeitados[0].codigo, "participante_inativo");
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
    for (const m of snap.modelos_apr) {
      for (const i of m.itens) assert.deepEqual(["tipo", "resposta_bloqueante", "evidencia"].filter((c) => c in i), [], "a cópia offline não diz o que é eliminatório");
    }
    // A escolha do modelo offline: a orientação de cada modelo e, em cada OS, o recomendado (o técnico escolhe).
    assert.ok(snap.modelos_apr.every((m: any) => typeof m.orientacao.descricao === "string" && Array.isArray(m.orientacao.exemplos) && !("palavras_chave" in m.orientacao)));
    assert.ok(snap.os.every((x: any) => "recomendado" in x.escolha_do_modelo && Array.isArray(x.escolha_do_modelo.encontradas)));
    assert.ok(snap.atividades.length > 100);
    assert.ok(snap.locais.some((l: any) => l.id === localId));
    assert.equal(snap.equipe.id, equipeId);
    assert.equal(snap.equipe.supervisor_id, supervisor.id);
    assert.ok(snap.equipe.nome && snap.equipe.centro_trabalho);
    assert.ok(snap.usuarios.some((u: any) => u.id === colega.id) && snap.usuarios.every((u: any) => !("email" in u)));
    assert.ok(snap.cursor);

    assert.equal((await amb.req("POST", "/sync/pull", { como: admin })).status, 403);
    assert.equal((await amb.req("POST", "/sync/pull")).status, 401);
  });

  it("o técnico não sabe o que é eliminatório: o modelo dele vem sem tipo, resposta bloqueante e evidência; o admin vê tudo", async () => {
    for (const como of [tecnico, supervisor]) {
      const m = await amb.esperar(200, "GET", "/modelos-apr/APR%2001/versoes/publicada", { como });
      assert.ok(m.itens.length > 0);
      for (const i of m.itens) {
        assert.deepEqual(["tipo", "resposta_bloqueante", "evidencia"].filter((c) => c in i), [], `${como.matricula} recebeu a classificação do item`);
        assert.ok(i.id && i.texto && "permite_na" in i);
      }
    }
    const doAdmin = await amb.esperar(200, "GET", "/modelos-apr/APR%2001/versoes/publicada", { como: admin });
    assert.ok(doAdmin.itens.every((i: any) => i.tipo && "resposta_bloqueante" in i && i.evidencia));
    assert.ok(doAdmin.itens.some((i: any) => i.tipo === "eliminatorio"));
  });

  /** Corpo de `POST /aprs/avaliar`: a APR sem as fotos e sem a observação dos reprovados (o técnico ainda não sabe quais são). */
  const corpoDaAvaliacao = (osId: string, p: Awaited<ReturnType<typeof payloadApr>>) => {
    const { evidencias: _fotos, ...resto } = p;
    return { ...resto, os_id: osId, respostas: p.respostas.map(({ item_id, resposta }) => ({ item_id, resposta })) };
  };

  it("POST /aprs/avaliar: a aprovada não é gravada; a bloqueada é registrada na hora, sem a evidência", async () => {
    const o = await novaOs();
    const aprsDaOs = async () => (await amb.sql<{ id: string; resultado: string }>("select id, resultado from apr where os_id = $1", [o.id]));
    const alertasDaOs = async () => (await amb.sql<{ n: number }>("select count(*)::int as n from alerta where os_id = $1 and tipo = 'bloqueio'", [o.id]))[0]!.n;

    const boa = await amb.esperar(200, "POST", "/aprs/avaliar", { como: tecnico, json: corpoDaAvaliacao(o.id, await payloadApr(o.id)) });
    assert.deepEqual(boa, { resultado: "aprovada", reprovados: [] });
    // A conferência de materiais saiu: o aparelho antigo que ainda manda `materiais` não é recusado nem bloqueado.
    const antigo = { ...corpoDaAvaliacao(o.id, await payloadApr(o.id)), materiais: [{ material_id: randomUUID(), levou: false }] };
    assert.deepEqual(await amb.esperar(200, "POST", "/aprs/avaliar", { como: tecnico, json: antigo }), { resultado: "aprovada", reprovados: [] });
    assert.deepEqual(await aprsDaOs(), [], "a aprovada só é registrada pelo apr_concluida");

    const ruim = await payloadApr(o.id, { bloquear: true });
    const reprovadoId = ruim.evidencias[0]!.item_id;
    const item = modelo.itens.find((i) => i.id === reprovadoId)!;
    const mau = await amb.esperar(200, "POST", "/aprs/avaliar", { como: tecnico, json: corpoDaAvaliacao(o.id, ruim) });
    assert.equal(mau.resultado, "bloqueada");
    assert.deepEqual(mau.reprovados, [{ item_id: item.id, texto: item.texto, evidencia: item.evidencia }]);
    assert.deepEqual(await aprsDaOs(), [{ id: ruim.id, resultado: "bloqueada" }], "a bloqueada vale na hora");
    assert.equal(await statusDa(o.id), "pendente");
    assert.equal(await alertasDaOs(), 1);
    assert.equal((await amb.sql("select 1 from evento_campo where os_id = $1 and tipo = 'apr_concluida'", [o.id])).length, 1);

    // Validar de novo a mesma APR (a resposta se perdeu) devolve o que ficou gravado, sem duplicar nada.
    const deNovo = await amb.esperar(200, "POST", "/aprs/avaliar", { como: tecnico, json: corpoDaAvaliacao(o.id, ruim) });
    assert.deepEqual(deNovo, mau);
    assert.equal((await aprsDaOs()).length, 1);
    assert.equal(await alertasDaOs(), 1);
    // A mesma APR com outras respostas não revela nada: vale o que foi gravado; outra pessoa ou outra OS é conflito.
    const trocada = await amb.esperar(200, "POST", "/aprs/avaliar", { como: tecnico, json: corpoDaAvaliacao(o.id, { ...(await payloadApr(o.id)), id: ruim.id }) });
    assert.deepEqual(trocada, mau);
    assert.equal((await amb.req("POST", "/aprs/avaliar", { como: colega, json: corpoDaAvaliacao(o.id, ruim) })).status, 409);

    // Descartar o rascunho e refazer a APR não apaga a bloqueada: a nova é outra APR.
    const refeita = await amb.esperar(200, "POST", "/aprs/avaliar", { como: tecnico, json: corpoDaAvaliacao(o.id, await payloadApr(o.id)) });
    assert.equal(refeita.resultado, "aprovada");
    assert.deepEqual(await aprsDaOs(), [{ id: ruim.id, resultado: "bloqueada" }]);

    // A evidência chega depois, no apr_concluida da mesma APR; online, precisa vir inteira.
    const semFoto = await enviar(tecnico, evento("apr_concluida", { ...ruim, evidencias: [] }, o.id));
    assert.equal(semFoto.rejeitados[0].codigo, "evidencia_faltando");
    const completa = await enviar(tecnico, evento("apr_concluida", ruim, o.id));
    assert.deepEqual(completa.aprs, [{ id: ruim.id, resultado: "bloqueada" }]);
    assert.equal(completa.rejeitados.length, 0);
    const [resposta] = await amb.sql<{ observacao: string }>("select observacao from apr_resposta where apr_id = $1 and item_id = $2", [ruim.id, item.id]);
    assert.equal(resposta!.observacao, "Vazamento de gás");
    assert.equal((await amb.sql("select 1 from evidencia where apr_id = $1", [ruim.id])).length, 1);
    // Completa, não aceita mais nada.
    await enviar(tecnico, evento("apr_concluida", { ...ruim, evidencias: [{ id: await foto(), item_id: item.id, capturada_em: agora() }] }, o.id));
    assert.equal((await amb.sql("select 1 from evidencia where apr_id = $1", [ruim.id])).length, 1);
    assert.equal((await aprsDaOs()).length, 1);
    assert.equal(await alertasDaOs(), 1);
  });

  it("POST /aprs/avaliar recusa pelas regras do registro, antes do resultado (a recusa não revela o que reprova)", async () => {
    const o = await novaOs();
    const semAssinatura = await amb.criarUsuario({ perfil: "tecnico", equipeId, comAssinatura: false });
    const ruim = await payloadApr(o.id, { bloquear: true });
    const recusa = async (json: object, status: number, codigo?: string) => {
      const r = await amb.req("POST", "/aprs/avaliar", { como: tecnico, json });
      assert.equal(r.status, status, JSON.stringify(r.corpo));
      if (codigo) assert.equal(r.corpo.erro.codigo, codigo);
    };
    // Participante sem assinatura: recusada igual, aprovando ou bloqueando.
    for (const p of [await payloadApr(o.id, { participantes: [tecnico, semAssinatura] }), await payloadApr(o.id, { bloquear: true, participantes: [tecnico, semAssinatura] })]) {
      await recusa(corpoDaAvaliacao(o.id, p), 422, "assinatura_ausente");
    }
    await recusa(corpoDaAvaliacao(o.id, await payloadApr(o.id, { incompleta: true })), 422, "respostas_incompletas");
    await recusa({ ...corpoDaAvaliacao(o.id, ruim), respostas: [{ item_id: randomUUID(), resposta: "sim" }] }, 422, "item_invalido");
    await recusa({ ...corpoDaAvaliacao(o.id, ruim), os_id: undefined }, 422, "validacao");
    // OS de outra equipe não existe para o técnico.
    const outraEquipe = await amb.criarEquipe({});
    const deOutra = await novaOs({ equipeId: outraEquipe.id });
    await recusa(corpoDaAvaliacao(deOutra.id, ruim), 404);
    assert.equal((await amb.sql("select 1 from apr where os_id = $1", [o.id])).length, 0);
    assert.equal((await amb.sql("select 1 from alerta where os_id = $1", [o.id])).length, 0);

    assert.equal((await amb.req("POST", "/aprs/avaliar", { como: admin, json: corpoDaAvaliacao(o.id, ruim) })).status, 403);
    assert.equal((await amb.req("POST", "/aprs/avaliar", { json: corpoDaAvaliacao(o.id, ruim) })).status, 401);
  });

  it("evento que veio da fila offline sem a evidência dos reprovados é aceito: o aparelho não pôde perguntar", async () => {
    const o = await novaOs();
    const duasHorasAtras = new Date(amb.relogio.agora.getTime() - 2 * 3600_000).toISOString();
    const p = await payloadApr(o.id, { bloquear: true, semObservacao: true, comFoto: false, concluidaEm: duasHorasAtras });
    const r = await enviar(tecnico, evento("apr_concluida", p, o.id, duasHorasAtras));
    assert.deepEqual(r.aprs, [{ id: p.id, resultado: "bloqueada" }]);
    assert.equal(await statusDa(o.id), "pendente");
    // O mesmo envio online continua exigindo a evidência.
    const online = await novaOs();
    const semProva = await enviar(tecnico, evento("apr_concluida", await payloadApr(online.id, { bloquear: true, semObservacao: true, comFoto: false }), online.id));
    assert.equal(semProva.rejeitados[0].codigo, "evidencia_faltando");
  });

  it("modelo excluído (arquivado): sai da cópia offline de quem não o usou, mas a APR respondida nele ainda é aceita", async () => {
    await amb.db.update(modeloApr).set({ arquivadoEm: amb.relogio.agora }).where(eq(modeloApr.codigo, "APR 01"));
    try {
      const novato = await amb.criarUsuario({ perfil: "tecnico", equipeId: (await amb.criarEquipe()).id });
      const snap = await amb.esperar(200, "POST", "/sync/pull", { como: novato });
      assert.ok(snap.modelos_apr.length > 0);
      assert.ok(!snap.modelos_apr.some((m: any) => m.codigo === "APR 01"));

      const o = await novaOs();
      await aprAprovada(o.id);
    } finally {
      await amb.db.update(modeloApr).set({ arquivadoEm: null }).where(eq(modeloApr.codigo, "APR 01"));
    }
  });
});
