import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { and, eq, ne, sql } from "drizzle-orm";
import { conquistaEquipe, conquistaUsuario, lancamentoEquipe, lancamentoPontos, planoPreventiva, temporada, temporadaEquipe, temporadaUsuario, usuario } from "../src/db/schema";
import { preencherHistoricoDaGamificacao } from "../src/db/seed/gamificacao-historico";
import { AGORA, prepararCampo, type Campo } from "./gamificacao-ajuda";

describe("Gamificação: implantação (o extrato nasce do histórico, com as mesmas regras)", () => {
  let c: Campo;
  before(async () => {
    c = await prepararCampo();
  });
  after(() => c.amb.fechar());

  const noDia = (iso: string) => {
    c.amb.relogio.agora = new Date(iso);
  };
  /**
   * O extrato como o servidor o gravou na hora, sem as conquistas (o preenchimento as concede no fim) e sem a assinatura (os
   * usuários de teste nascem com a assinatura gravada, sem passar por `PUT /me/assinatura`, então só o histórico a pontua).
   */
  const retrato = async () =>
    (await c.amb.db.select().from(lancamentoPontos).where(and(ne(lancamentoPontos.regra, "conquista_obtida"), ne(lancamentoPontos.regra, "assinatura_cadastrada"))))
      .map((l) => `${l.usuarioId}|${l.chave}|${l.regra}|${l.pontos}|${l.ocorridoEm.toISOString()}|${l.temporada}`)
      .sort();
  const apagarTudo = async () => {
    const db = c.amb.db;
    await db.delete(conquistaUsuario);
    await db.delete(conquistaEquipe);
    await db.delete(lancamentoEquipe);
    await db.delete(lancamentoPontos);
    await db.delete(temporadaUsuario);
    await db.delete(temporadaEquipe);
    await db.delete(temporada);
  };

  it("preenche o extrato do histórico idêntico ao que as regras lançaram na hora, fecha as temporadas passadas e concede as conquistas", async () => {
    const ana = await c.tecnico("Ana");
    const beto = await c.tecnico("Beto");
    const caio = await c.tecnico("Caio");
    const dani = await c.tecnico("Dani");

    // Terceiro trimestre (já passou da tolerância em 13/10): serviço comum e uma preventiva em local crítico.
    noDia("2026-08-10T15:00:00Z");
    await c.servico(ana, (await c.novaOs()).id, [ana, beto]);
    await c.servico(caio, (await c.novaOs({ tipo: "preventiva", critico: true, dataInicioProg: "2026-08-10", dataFimProg: "2026-08-20" })).id);

    // Quarto trimestre (aberto).
    noDia("2026-10-13T15:00:00Z");
    // APR bloqueada sem evidência (não pontua) e outra, com evidência, que depois é refeita e encerrada.
    const semEvidencia = await c.novaOs();
    await c.aprBloqueada(dani, semEvidencia.id);
    const refeita = await c.novaOs();
    const bloqueada = await c.aprBloqueada(ana, refeita.id, [ana, caio]);
    await bloqueada.enviarEvidencia();
    await c.servico(ana, refeita.id, [ana, caio]);
    // Interrupção por risco e retomada no dia seguinte (preventiva com atraso justificado, resgate, bônus para todos).
    const preventiva = await c.novaOs({ tipo: "preventiva", dataInicioProg: "2026-10-12", dataFimProg: "2026-10-13" });
    const { aprId } = await c.apr(beto, preventiva.id, [beto, dani]);
    await c.interromper(beto, await c.iniciar(beto, preventiva.id, aprId));
    noDia("2026-10-14T15:00:00Z");
    await c.servico(caio, preventiva.id);
    // Apoio, ciência do supervisor, assinatura, treino e intervalo de preventiva.
    const original = await c.novaOs();
    const apoio = await c.novaOs({ origem: "apoio", numeroOrdem: null, osOrigemId: original.id, titulo: "Apoio" });
    await c.servico(dani, apoio.id);
    const encerrada = await c.novaOs();
    await c.servico(ana, encerrada.id);
    assert.equal((await c.como(c.supervisor, "POST", `/os/${encerrada.id}/ciencia`)).status, 200);
    const novo = await c.amb.criarUsuario({ perfil: "tecnico", equipeId: c.equipe.id, comAssinatura: false });
    const arquivo = randomUUID();
    await c.amb.armazenamento.gravar("assinaturas", arquivo, new Uint8Array([1]), "image/png");
    await c.como(novo, "PUT", "/me/assinatura", { json: { arquivo_id: arquivo } });
    await c.como(novo, "PUT", "/me/treinamento", { json: { estado: "concluido" } });
    const plano = `P${randomUUID().slice(0, 6)}`;
    await c.novaOs({ tipo: "preventiva", planoManutencao: plano, itemManutencao: "1" });
    const [pp] = await c.amb.db.insert(planoPreventiva).values({ planoManutencao: plano, itemManutencao: "1" }).returning();
    await c.como(c.supervisor, "PUT", `/preventivas/${pp!.id}`, { json: { intervalo: { quantidade: 6, unidade: "mes" } } });
    noDia("2026-10-14T18:00:00Z");

    const aoVivo = await retrato();
    const regras = new Set(aoVivo.map((l) => l.split("|")[2]));
    for (const r of ["apr_completa", "responsavel_apr", "execucao_concluida", "preventiva_em_dia", "local_critico", "resgate", "apoio", "ciencia_no_prazo", "treinamento_concluido", "intervalo_definido"]) {
      assert.ok(regras.has(r), `o cenário cobre a regra ${r}`);
    }
    assert.ok(aoVivo.some((l) => l.includes("2026-T3")) && aoVivo.some((l) => l.includes("2026-T4")));

    // Implantação: o extrato some e é refeito só pelo histórico.
    await apagarTudo();
    assert.equal(await c.totalDeLancamentos(), 0);
    const r = await preencherHistoricoDaGamificacao(c.amb.db, c.amb.relogio.agora);
    assert.ok(r);
    assert.deepEqual(await retrato(), aoVivo, "as mesmas regras, o mesmo extrato");
    assert.equal(r.temporadasFechadas, 1);
    // As assinaturas já gravadas pontuam no histórico (5 para cada técnico), na data em que foram cadastradas.
    const assinaturas = await c.amb.db.select().from(lancamentoPontos).where(eq(lancamentoPontos.regra, "assinatura_cadastrada"));
    const tecnicosComAssinatura = await c.amb.db.select({ id: usuario.id }).from(usuario).where(and(eq(usuario.perfil, "tecnico"), sql`${usuario.assinaturaEm} is not null`));
    assert.equal(assinaturas.length, tecnicosComAssinatura.length);
    assert.ok(assinaturas.every((a) => a.pontos === 5 && a.chave === "assinatura"));

    // A temporada passada nasce fechada, com o resultado gravado; a de hoje fica aberta.
    const [t3] = await c.amb.db.select().from(temporada).where(eq(temporada.codigo, "2026-T3"));
    const [t4] = await c.amb.db.select().from(temporada).where(eq(temporada.codigo, "2026-T4"));
    assert.ok(t3!.fechadaEm);
    assert.equal(t4!.fechadaEm, null);
    const fechadas = await c.amb.db.select().from(temporadaUsuario).where(eq(temporadaUsuario.temporada, "2026-T3"));
    assert.deepEqual(fechadas.map((f) => f.usuarioId).sort(), [ana.id, beto.id, caio.id].sort());
    assert.equal(fechadas.find((f) => f.usuarioId === ana.id)!.pontos, 25);
    assert.deepEqual(fechadas.map((f) => f.posicao).sort(), [1, 2, 3]);

    // As conquistas vêm no fim, e os pontos delas entram na temporada aberta (mesmo as de data antiga).
    assert.ok(r.conquistas >= 4);
    const comoConquista = await c.amb.db.select().from(lancamentoPontos).where(eq(lancamentoPontos.regra, "conquista_obtida"));
    assert.ok(comoConquista.length >= 4);
    assert.ok(comoConquista.every((l) => l.temporada === "2026-T4"));
    const primeiros = await c.amb.db.select().from(conquistaUsuario).where(eq(conquistaUsuario.usuarioId, ana.id));
    const [antiga] = primeiros.filter((p) => p.obtidaEm.getTime() < new Date("2026-10-01T00:00:00Z").getTime());
    assert.ok(antiga, "a data da conquista é a em que a meta foi batida (o serviço de agosto), não a da implantação");

    // Só roda com o extrato vazio: de novo, nada; forçado, nada se duplica.
    assert.equal(await preencherHistoricoDaGamificacao(c.amb.db, c.amb.relogio.agora), null);
    const antes = await c.totalDeLancamentos();
    await preencherHistoricoDaGamificacao(c.amb.db, c.amb.relogio.agora, { forcar: true });
    assert.equal(await c.totalDeLancamentos(), antes);
    assert.deepEqual(await retrato(), aoVivo);
  });

  it("sem histórico, a implantação não muda nada", async () => {
    const outro = await prepararCampo();
    try {
      const r = await preencherHistoricoDaGamificacao(outro.amb.db, outro.amb.relogio.agora);
      // Só a assinatura da supervisora (cadastrada na criação da conta) tem o que pontuar: nenhuma APR, execução ou ciência.
      assert.deepEqual(r, { lancamentos: 1, temporadasFechadas: 0, conquistas: 0 });
      assert.deepEqual(await outro.regrasDe(outro.supervisor.id), ["assinatura_cadastrada"]);
    } finally {
      await outro.amb.fechar();
    }
  });

  it("os admins e quem ainda não é técnico não entram no preenchimento", async () => {
    const quem = await c.amb.db.select({ id: usuario.id, perfil: usuario.perfil }).from(usuario).where(eq(usuario.perfil, "admin"));
    const admins = new Set(quem.map((a) => a.id));
    const dosAdmins = (await c.amb.db.select({ u: lancamentoPontos.usuarioId }).from(lancamentoPontos)).filter((l) => admins.has(l.u));
    assert.equal(dosAdmins.length, 0);
    assert.ok((await c.amb.db.select({ n: sql<number>`count(*)::int` }).from(lancamentoPontos))[0]!.n > 0);
  });
});
