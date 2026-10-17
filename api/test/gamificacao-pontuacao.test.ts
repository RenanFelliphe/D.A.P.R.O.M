import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { lancamentoEquipe, lancamentoPontos, planoPreventiva, reprogramacao, temporada, usuario } from "../src/db/schema";
import { temporadaParaLancar } from "../src/dominio/temporadas";
import { AGORA, prepararCampo, type Campo } from "./gamificacao-ajuda";

const DIA = 86_400_000;

describe("Gamificação: pontuação (seção 2)", () => {
  let c: Campo;
  before(async () => {
    c = await prepararCampo();
  });
  after(() => c.amb.fechar());
  const voltarAoRelogio = () => {
    c.amb.relogio.agora = AGORA;
  };

  it("APR aprovada: 10 pontos para cada participante e 5 a mais para o responsável, e o autor recebe o que ganhou", async () => {
    voltarAoRelogio();
    const a = await c.tecnico("Ana");
    const b = await c.tecnico("Beto");
    const o = await c.novaOs();
    const { resposta } = await c.apr(a, o.id, [a, b]);

    assert.deepEqual(await c.regrasDe(a.id), ["apr_completa", "responsavel_apr"]);
    assert.deepEqual(await c.regrasDe(b.id), ["apr_completa"]);
    assert.equal(await c.pontosDe(a.id), 15);
    assert.equal(await c.pontosDe(b.id), 10);
    // A resposta do envio traz só os pontos de quem enviou ("+N pontos").
    const apenasTarefas = resposta.ganhos.filter((g: { regra: string }) => g.regra !== "conquista_obtida");
    assert.deepEqual(apenasTarefas.map((g: { regra: string; pontos: number }) => [g.regra, g.pontos]).sort(), [["apr_completa", 10], ["responsavel_apr", 5]]);
    assert.equal(resposta.pontos_ganhos, resposta.ganhos.reduce((t: number, g: { pontos: number }) => t + g.pontos, 0));
  });

  it("execução encerrada: mais 10 para todos os participantes da APR (corretiva comum: 25 para o responsável, 20 para o outro)", async () => {
    voltarAoRelogio();
    const a = await c.tecnico();
    const b = await c.tecnico();
    const o = await c.novaOs();
    const { daExecucao } = await c.servico(a, o.id, [a, b]);
    assert.equal(await c.pontosDe(a.id), 25);
    assert.equal(await c.pontosDe(b.id), 20);
    assert.ok(daExecucao.ganhos.some((g: { regra: string }) => g.regra === "execucao_concluida"));
    // O extrato guarda a OS de cada lançamento e as chaves únicas por pessoa.
    const linhas = await c.extrato(a.id);
    assert.deepEqual(linhas.map((l) => l.chave).sort(), [`apr:${o.id}`, `execucao:${o.id}`, `responsavel:${o.id}`]);
    assert.ok(linhas.every((l) => l.osId === o.id && l.temporada === "2026-T4"));
  });

  it("reenviar o evento não pontua de novo", async () => {
    voltarAoRelogio();
    const a = await c.tecnico();
    const o = await c.novaOs();
    const corpo = await c.corpoDaApr([a]);
    const e = c.evento("apr_concluida", corpo, o.id);
    const primeira = await c.enviar(a, e);
    const segunda = await c.enviar(a, e);
    assert.ok(primeira.pontos_ganhos > 0);
    assert.equal(segunda.pontos_ganhos, 0);
    assert.deepEqual(segunda.ganhos, []);
    assert.equal(await c.pontosDe(a.id), 15);
    // Encerrar uma execução já encerrada também não pontua de novo.
    const execId = await c.iniciar(a, o.id, corpo.id);
    await c.encerrar(a, execId);
    const antes = await c.pontosDe(a.id);
    const repetida = await c.encerrar(a, execId);
    assert.equal(repetida.pontos_ganhos, 0);
    assert.equal(await c.pontosDe(a.id), antes);
  });

  it("preventiva em dia em local crítico: o dobro da corretiva e os bônus de local crítico e de preventiva em dia (45 e 40)", async () => {
    voltarAoRelogio();
    const a = await c.tecnico();
    const b = await c.tecnico();
    const o = await c.novaOs({ tipo: "preventiva", critico: true, dataInicioProg: "2026-10-12", dataFimProg: "2026-10-20" });
    await c.servico(a, o.id, [a, b]);
    assert.deepEqual(await c.regrasDe(a.id), ["apr_completa", "execucao_concluida", "local_critico", "preventiva_concluida", "preventiva_em_dia", "responsavel_apr"]);
    assert.equal(await c.pontosDe(a.id), 10 + 10 + 10 + 5 + 5 + 5);
    assert.equal(await c.pontosDe(b.id), 10 + 10 + 10 + 5 + 5);
  });

  it("preventiva atrasada sem justificativa não ganha o bônus; com reprogramação (atraso justificado) ganha", async () => {
    voltarAoRelogio();
    const a = await c.tecnico();
    const atrasada = await c.novaOs({ tipo: "preventiva", dataInicioProg: "2026-10-09", dataFimProg: "2026-10-12" });
    await c.servico(a, atrasada.id);
    assert.equal((await c.regrasDe(a.id)).includes("preventiva_em_dia"), false);
    assert.equal(await c.pontosDe(a.id), 35, "a preventiva concluída vale 10 a mais, mesmo atrasada");

    const justificada = await c.novaOs({ tipo: "preventiva", dataInicioProg: "2026-10-09", dataFimProg: "2026-10-12" });
    await c.amb.db.insert(reprogramacao).values({ osId: justificada.id, usuarioId: c.admin.id, dataAnterior: "2026-10-09", dataNova: "2026-10-12", justificativa: "Aguardando liberação do cliente" });
    await c.servico(a, justificada.id);
    assert.equal(await c.pontosDe(a.id), 35 + 40);
    assert.ok((await c.regrasDe(a.id)).filter((r) => r === "preventiva_em_dia").length === 1);
  });

  it("a corretiva não ganha o bônus de preventiva em dia, mesmo no prazo, nem o de preventiva concluída", async () => {
    voltarAoRelogio();
    const a = await c.tecnico();
    const o = await c.novaOs({ tipo: "corretiva", dataFimProg: "2026-10-20" });
    await c.servico(a, o.id);
    assert.equal((await c.regrasDe(a.id)).includes("preventiva_em_dia"), false);
    assert.equal((await c.regrasDe(a.id)).includes("preventiva_concluida"), false);
  });

  it("preventiva concluída: o dobro da corretiva para todos os participantes, uma por pessoa, por OS", async () => {
    voltarAoRelogio();
    const a = await c.tecnico();
    const b = await c.tecnico();
    const o = await c.novaOs({ tipo: "preventiva", dataInicioProg: "2026-10-01", dataFimProg: "2026-10-02" });
    const { daExecucao } = await c.servico(a, o.id, [a, b]);
    const concluida = (u: { id: string }) => c.extrato(u.id).then((l) => l.filter((x) => x.regra === "preventiva_concluida"));
    assert.deepEqual((await concluida(a)).map((l) => [l.pontos, l.chave]), [[10, `preventiva_concluida:${o.id}`]]);
    assert.equal((await concluida(b)).length, 1);
    assert.ok(daExecucao.ganhos.some((g: { regra: string }) => g.regra === "preventiva_concluida"));
    // Atrasada sem justificativa: não ganha "em dia", mas a preventiva concluída vale do mesmo jeito.
    assert.equal((await c.regrasDe(a.id)).includes("preventiva_em_dia"), false);
    // Corretiva vale 20 (APR + execução) e a preventiva, 10 a mais.
    assert.equal(await c.pontosDe(b.id), 10 + 10 + 10);
  });

  it("APR bloqueada só pontua quando chega a evidência; refazer a APR e encerrar vale o mesmo que fazer de uma vez", async () => {
    voltarAoRelogio();
    const a = await c.tecnico();
    const b = await c.tecnico();
    const o = await c.novaOs();
    const bloqueada = await c.aprBloqueada(a, o.id, [a, b]);
    assert.equal(await c.pontosDe(a.id), 0, "sem a evidência não pontua");
    assert.equal(await c.pontosDe(b.id), 0);

    const r = await bloqueada.enviarEvidencia();
    assert.ok(r.pontos_ganhos >= 15);
    assert.equal(await c.pontosDe(a.id), 15, "APR completa 10 + responsável 5");
    assert.equal(await c.pontosDe(b.id), 10);

    // O problema foi resolvido: APR nova aprovada, execução e encerramento. O limite é uma APR por pessoa, por OS.
    await c.servico(a, o.id, [a, b]);
    assert.equal(await c.pontosDe(a.id), 25, "o mesmo que 20 + 5 de responsável numa OS sem bloqueio");
    assert.equal(await c.pontosDe(b.id), 20);
    assert.equal((await c.regrasDe(a.id)).includes("resgate"), false, "quem fez a tentativa anterior não ganha resgate");
  });

  it("interromper por risco vale o mesmo que encerrar; quem retoma ganha resgate; a preventiva com atraso justificado paga a todos", async () => {
    voltarAoRelogio();
    const a = await c.tecnico();
    const b = await c.tecnico();
    const outro = await c.tecnico();
    // Prazo: hoje. A interrupção é de hoje (a OS fica pendente antes da data) e a retomada, de amanhã (atraso justificado).
    const o = await c.novaOs({ tipo: "preventiva", dataInicioProg: "2026-10-12", dataFimProg: "2026-10-13" });
    const { aprId } = await c.apr(a, o.id, [a, b]);
    const execId = await c.iniciar(a, o.id, aprId);
    await c.interromper(a, execId);
    assert.equal(await c.pontosDe(a.id), 10 + 5 + 10 + 10, "APR + responsável + execução (interrompida) + preventiva concluída: parar não custa pontos");
    assert.equal(await c.pontosDe(b.id), 10 + 10 + 10);
    assert.equal((await c.regrasDe(a.id)).includes("preventiva_em_dia"), false, "ainda não fechou");

    c.amb.relogio.agora = new Date(AGORA.getTime() + DIA);
    await c.servico(outro, o.id);
    assert.deepEqual(await c.regrasDe(outro.id), ["apr_completa", "execucao_concluida", "preventiva_concluida", "preventiva_em_dia", "responsavel_apr", "resgate"].sort());
    assert.equal(await c.pontosDe(outro.id), 10 + 5 + 10 + 10 + 5 + 5, "inclui o resgate (5)");
    // Quem interrompeu também recebe o bônus de preventiva em dia: parar não custa pontos.
    assert.equal(await c.pontosDe(a.id), 10 + 5 + 10 + 10 + 5);
    assert.equal(await c.pontosDe(b.id), 10 + 10 + 10 + 5);
    voltarAoRelogio();
  });

  it("suspender no fim do expediente não pontua nem conta como pendência de resgate; as APRs dos outros dias não somam", async () => {
    voltarAoRelogio();
    const a = await c.tecnico();
    const b = await c.tecnico();
    const o = await c.novaOs();
    const { aprId } = await c.apr(a, o.id);
    const execId = await c.iniciar(a, o.id, aprId);
    await c.suspender(a, execId);
    assert.equal(await c.pontosDe(a.id), 15, "só a APR do primeiro dia");

    c.amb.relogio.agora = new Date(AGORA.getTime() + DIA);
    await c.servico(a, o.id);
    assert.equal(await c.pontosDe(a.id), 25, "a APR do segundo dia não soma; a execução soma uma vez");
    voltarAoRelogio();

    // Trocar quem vai no dia seguinte não dá resgate: a suspensão não é pendência por bloqueio ou interrupção.
    const o2 = await c.novaOs();
    const { aprId: apr2 } = await c.apr(a, o2.id);
    await c.suspender(a, await c.iniciar(a, o2.id, apr2));
    c.amb.relogio.agora = new Date(AGORA.getTime() + DIA);
    await c.servico(b, o2.id);
    assert.equal((await c.regrasDe(b.id)).includes("resgate"), false);
    voltarAoRelogio();
  });

  it("OS de apoio a outra equipe: bônus de apoio para quem conclui a execução", async () => {
    voltarAoRelogio();
    const a = await c.tecnico();
    const original = await c.novaOs();
    const apoio = await c.novaOs({ origem: "apoio", numeroOrdem: null, osOrigemId: original.id, titulo: "Apoio" });
    await c.servico(a, apoio.id);
    assert.deepEqual(await c.regrasDe(a.id), ["apoio", "apr_completa", "execucao_concluida", "responsavel_apr"]);
    assert.equal(await c.pontosDe(a.id), 10 + 5 + 10 + 5);
  });

  it("técnico novo acompanhado: o responsável ganha 5 quando outro participante tem a conta há menos de 60 dias", async () => {
    voltarAoRelogio();
    const experiente = await c.tecnico();
    const novato = await c.tecnico();
    const antigo = await c.tecnico();
    await c.amb.db.update(usuario).set({ criadoEm: new Date(AGORA.getTime() - 10 * DIA) }).where(eq(usuario.id, novato.id));
    await c.amb.db.update(usuario).set({ criadoEm: new Date(AGORA.getTime() - 90 * DIA) }).where(eq(usuario.id, antigo.id));

    const o = await c.novaOs();
    await c.apr(experiente, o.id, [experiente, novato]);
    assert.ok((await c.regrasDe(experiente.id)).includes("tecnico_novo"));
    assert.equal(await c.pontosDe(experiente.id), 10 + 5 + 5);
    assert.equal((await c.regrasDe(novato.id)).includes("tecnico_novo"), false);

    // Com conta de 90 dias não conta; e o novato como responsável, com um colega antigo, também não ganha.
    const o2 = await c.novaOs();
    await c.apr(experiente, o2.id, [experiente, antigo]);
    assert.equal((await c.regrasDe(experiente.id)).filter((r) => r === "tecnico_novo").length, 1);
    const o3 = await c.novaOs();
    await c.apr(novato, o3.id, [novato, antigo]);
    assert.equal((await c.regrasDe(novato.id)).includes("tecnico_novo"), false);
  });

  it("ciência no prazo (até 72 h): 3 pontos para o supervisor, uma por OS; depois do prazo não pontua", async () => {
    voltarAoRelogio();
    const a = await c.tecnico();
    const o = await c.novaOs();
    await c.servico(a, o.id);

    c.amb.relogio.agora = new Date(AGORA.getTime() + 2 * DIA);
    const r = await c.como(c.supervisor, "POST", `/os/${o.id}/ciencia`);
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    const doSupervisor = (await c.extrato(c.supervisor.id)).filter((l) => l.regra === "ciencia_no_prazo");
    assert.equal(doSupervisor.length, 1);
    assert.equal(doSupervisor[0]!.pontos, 3);
    assert.ok(r.corpo.pontos_ganhos >= 3);

    // Fora do prazo: ciência 4 dias depois do encerramento não pontua.
    voltarAoRelogio();
    const atrasada = await c.novaOs();
    await c.servico(a, atrasada.id);
    c.amb.relogio.agora = new Date(AGORA.getTime() + 4 * DIA);
    const tarde = await c.como(c.supervisor, "POST", `/os/${atrasada.id}/ciencia`);
    assert.equal(tarde.status, 200, JSON.stringify(tarde.corpo));
    assert.equal(tarde.corpo.pontos_ganhos, 0);
    assert.equal((await c.extrato(c.supervisor.id)).filter((l) => l.regra === "ciencia_no_prazo").length, 1);
    voltarAoRelogio();
  });

  it("intervalo de preventiva definido: 3 pontos para o supervisor que define o intervalo de um plano que estava sem, uma vez por plano", async () => {
    voltarAoRelogio();
    const planoDaOs = `P${randomUUID().slice(0, 6)}`;
    await c.novaOs({ tipo: "preventiva", planoManutencao: planoDaOs, itemManutencao: "1" });
    const [plano] = await c.amb.db.insert(planoPreventiva).values({ planoManutencao: planoDaOs, itemManutencao: "1" }).returning();

    const antes = (await c.extrato(c.supervisor.id)).length;
    const r = await c.como(c.supervisor, "PUT", `/preventivas/${plano!.id}`, { json: { intervalo: { quantidade: 3, unidade: "mes" } } });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    const linhas = (await c.extrato(c.supervisor.id)).filter((l) => l.regra === "intervalo_definido");
    assert.equal(linhas.length, 1);
    assert.equal(linhas[0]!.pontos, 3);
    assert.equal(linhas[0]!.chave, `intervalo:${plano!.id}`);
    assert.ok(r.corpo.pontos_ganhos >= 3);
    assert.ok((await c.extrato(c.supervisor.id)).length > antes);

    // Mudar o intervalo (que já existia) não pontua; o admin que define não pontua (não joga).
    const de = await c.como(c.supervisor, "PUT", `/preventivas/${plano!.id}`, { json: { intervalo: { quantidade: 6, unidade: "mes" } } });
    assert.equal(de.corpo.pontos_ganhos, 0);
    const outroPlano = `P${randomUUID().slice(0, 6)}`;
    await c.novaOs({ tipo: "preventiva", planoManutencao: outroPlano, itemManutencao: "1" });
    const [plano2] = await c.amb.db.insert(planoPreventiva).values({ planoManutencao: outroPlano, itemManutencao: "1" }).returning();
    const doAdmin = await c.como(c.admin, "PUT", `/preventivas/${plano2!.id}`, { json: { intervalo: { quantidade: 1, unidade: "mes" } } });
    assert.equal(doAdmin.status, 200, JSON.stringify(doAdmin.corpo));
    assert.equal(doAdmin.corpo.pontos_ganhos, 0);
    assert.equal(await c.amb.db.select().from(lancamentoPontos).where(eq(lancamentoPontos.usuarioId, c.admin.id)).then((l) => l.length), 0);
  });

  it("boas-vindas: assinatura (5) e Campo de treino concluído (10), uma vez por conta; o admin não pontua", async () => {
    voltarAoRelogio();
    const novo = await c.amb.criarUsuario({ perfil: "tecnico", equipeId: c.equipe.id, comAssinatura: false });
    const arquivo = randomUUID();
    await c.amb.armazenamento.gravar("assinaturas", arquivo, new Uint8Array([1, 2, 3]), "image/png");
    const r = await c.como(novo, "PUT", "/me/assinatura", { json: { arquivo_id: arquivo } });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.ok(r.corpo.ganhos.some((g: { regra: string; pontos: number }) => g.regra === "assinatura_cadastrada" && g.pontos === 5));

    // Refazer a assinatura não pontua de novo.
    const outro = randomUUID();
    await c.amb.armazenamento.gravar("assinaturas", outro, new Uint8Array([4, 5, 6]), "image/png");
    const refeita = await c.como(novo, "PUT", "/me/assinatura", { json: { arquivo_id: outro } });
    assert.equal(refeita.corpo.pontos_ganhos, 0);

    const treino = await c.como(novo, "PUT", "/me/treinamento", { json: { estado: "concluido" } });
    assert.equal(treino.status, 200, JSON.stringify(treino.corpo));
    assert.ok(treino.corpo.ganhos.some((g: { regra: string; pontos: number }) => g.regra === "treinamento_concluido" && g.pontos === 10));
    // Refazer o treino e concluir de novo, ou apenas pular, não pontua.
    await c.como(novo, "PUT", "/me/treinamento", { json: { estado: "nao_iniciado" } });
    const denovo = await c.como(novo, "PUT", "/me/treinamento", { json: { estado: "concluido" } });
    assert.equal(denovo.corpo.pontos_ganhos, 0);
    assert.equal(await c.pontosDe(novo.id), 15);

    const pulou = await c.amb.criarUsuario({ perfil: "tecnico", equipeId: c.equipe.id });
    const rp = await c.como(pulou, "PUT", "/me/treinamento", { json: { estado: "pulado" } });
    assert.equal(rp.corpo.pontos_ganhos, 0);

    // O admin não joga: assinatura e treino dele não geram lançamento.
    const arquivoAdmin = randomUUID();
    await c.amb.armazenamento.gravar("assinaturas", arquivoAdmin, new Uint8Array([7]), "image/png");
    const ra = await c.como(c.admin, "PUT", "/me/assinatura", { json: { arquivo_id: arquivoAdmin } });
    assert.equal(ra.status, 200);
    assert.equal(ra.corpo.pontos_ganhos, 0);
    await c.como(c.admin, "PUT", "/me/treinamento", { json: { estado: "concluido" } });
    assert.equal((await c.amb.db.select().from(lancamentoPontos).where(eq(lancamentoPontos.usuarioId, c.admin.id))).length, 0);
  });

  it("remover um usuário apaga os pontos dele (assinatura e treino pontuam já no cadastro); o histórico de campo continua impedindo a remoção", async () => {
    voltarAoRelogio();
    const pendente = await c.amb.criarUsuario({ perfil: "tecnico", equipeId: c.equipe.id });
    await c.como(pendente, "PUT", "/me/treinamento", { json: { estado: "concluido" } });
    assert.ok((await c.extrato(pendente.id, true)).length >= 2, "o treino pontuou e concedeu 'Pronto para o campo'");
    const removido = await c.como(c.admin, "DELETE", `/usuarios/${pendente.id}`);
    assert.equal(removido.status, 200, JSON.stringify(removido.corpo));
    assert.equal((await c.extrato(pendente.id, true)).length, 0);
    assert.equal((await c.amb.db.select().from(usuario).where(eq(usuario.id, pendente.id))).length, 0);

    // Quem já fez APR tem histórico: a remoção é recusada e os pontos continuam (a transação desfaz tudo).
    const veterano = await c.tecnico();
    await c.apr(veterano, (await c.novaOs()).id);
    const antes = await c.pontosDe(veterano.id, true);
    const recusada = await c.como(c.admin, "DELETE", `/usuarios/${veterano.id}`);
    assert.equal(recusada.status, 409);
    assert.equal(recusada.corpo.erro.codigo, "usuario_com_historico");
    assert.equal(await c.pontosDe(veterano.id, true), antes);
  });

  it("cada lançamento credita a equipe da pessoa e as equipes que ela supervisiona (quem muda de equipe deixa os pontos onde os fez)", async () => {
    voltarAoRelogio();
    const outraEquipe = await c.amb.criarEquipe({ nome: "Equipe B" });
    const sup = await c.amb.criarUsuario({ perfil: "tecnico", equipeId: c.equipe.id });
    await c.amb.db.update((await import("../src/db/schema")).equipe).set({ supervisorId: sup.id }).where(eq((await import("../src/db/schema")).equipe.id, outraEquipe.id));
    const o = await c.novaOs();
    await c.apr(sup, o.id);
    const [apr10] = (await c.extrato(sup.id)).filter((l) => l.regra === "apr_completa");
    const creditadas = (await c.amb.db.select().from(lancamentoEquipe).where(eq(lancamentoEquipe.lancamentoId, apr10!.id))).map((l) => l.equipeId).sort();
    assert.deepEqual(creditadas, [c.equipe.id, outraEquipe.id].sort());

    // Muda de equipe: o que já foi lançado continua creditado à equipe antiga.
    await c.amb.db.update(usuario).set({ equipeId: outraEquipe.id }).where(eq(usuario.id, sup.id));
    const [continua] = await c.amb.db.select().from(lancamentoEquipe).where(eq(lancamentoEquipe.lancamentoId, apr10!.id));
    assert.ok(continua);
    assert.ok(creditadas.includes(c.equipe.id));
  });

  it("o admin não joga: não pontua, mesmo que apareça numa APR", async () => {
    voltarAoRelogio();
    const o = await c.novaOs();
    // O admin não é da equipe, então a rota recusa; o motor de pontos também ignora quem não é técnico.
    const { lancar } = await import("../src/dominio/lancamentos");
    const ganhos = await lancar({ tx: c.amb.db, agora: AGORA }, [{ usuarioId: c.admin.id, regra: "apr_completa", chave: `apr:${o.id}`, osId: o.id, ocorridoEm: AGORA }]);
    assert.deepEqual(ganhos, []);
    assert.equal((await c.amb.db.select().from(lancamentoPontos).where(eq(lancamentoPontos.usuarioId, c.admin.id))).length, 0);
  });

  it("o admin ajusta as tarefas: o novo valor vale dali em diante e o extrato antigo não muda; tarefa desativada não pontua", async () => {
    voltarAoRelogio();
    const a = await c.tecnico();
    const o1 = await c.novaOs();
    await c.apr(a, o1.id);
    assert.equal(await c.pontosDe(a.id), 15);

    const p = await c.como(c.admin, "PATCH", "/gamificacao/regras/apr_completa", { json: { pontos: 20 } });
    assert.equal(p.status, 200, JSON.stringify(p.corpo));
    const o2 = await c.novaOs();
    await c.apr(a, o2.id);
    assert.equal(await c.pontosDe(a.id), 15 + 25, "o lançamento da OS 2 vale 20 + 5; o da OS 1 continua 10 + 5");
    const antigo = (await c.extrato(a.id)).find((l) => l.chave === `apr:${o1.id}`);
    assert.equal(antigo!.pontos, 10);

    await c.como(c.admin, "PATCH", "/gamificacao/regras/apr_completa", { json: { pontos: 10 } });
    await c.como(c.admin, "PATCH", "/gamificacao/regras/responsavel_apr", { json: { ativa: false } });
    const o3 = await c.novaOs();
    await c.apr(a, o3.id);
    assert.equal(await c.pontosDe(a.id), 15 + 25 + 10, "sem o bônus de responsável");
    await c.como(c.admin, "PATCH", "/gamificacao/regras/responsavel_apr", { json: { ativa: true } });
  });

  it("temporada do lançamento: o trimestre da data; se já fechou (ou passou da tolerância), entra na temporada aberta", async () => {
    const db = c.amb.db;
    // Dentro da tolerância (até 7 dias depois do último dia): o trimestre anterior ainda aceita lançamentos.
    assert.equal(await temporadaParaLancar(db, new Date("2026-09-30T20:00:00Z"), new Date("2026-10-05T15:00:00Z")), "2026-T3");
    // Passou da tolerância: entra na temporada aberta, a de hoje.
    assert.equal(await temporadaParaLancar(db, new Date("2026-09-30T20:00:00Z"), new Date("2026-10-13T15:00:00Z")), "2026-T4");
    // Fechada, mesmo dentro do trimestre da data.
    await db.update(temporada).set({ fechadaEm: new Date("2026-10-06T00:00:00Z") }).where(eq(temporada.codigo, "2026-T3"));
    assert.equal(await temporadaParaLancar(db, new Date("2026-09-30T20:00:00Z"), new Date("2026-10-06T15:00:00Z")), "2026-T4");
    // Relógio errado no aparelho (data futura): o lançamento é trazido para o agora.
    const a = await c.tecnico();
    const o = await c.novaOs();
    const corpo = await c.corpoDaApr([a]);
    const futuro = { ...c.evento("apr_concluida", corpo, o.id), ocorrido_em: "2027-05-01T12:00:00Z" };
    await c.enviar(a, futuro);
    const linhas = await c.extrato(a.id);
    assert.ok(linhas.length > 0);
    assert.ok(linhas.every((l) => l.ocorridoEm.getTime() <= AGORA.getTime() && l.temporada === "2026-T4"));
  });
});
