import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { conquista, conquistaEquipe, conquistaUsuario, lancamentoPontos, regraPontuacao, temporada, usuario } from "../src/db/schema";
import { concederConquistas } from "../src/dominio/conquistas";
import { fecharTemporada } from "../src/dominio/fechamento-temporada";
import { lancar } from "../src/dominio/lancamentos";
import { AGORA, formulario, prepararCampo, type Campo, type UsuarioDeTeste } from "./gamificacao-ajuda";

const DIA = 86_400_000;

describe("Gamificação: conquistas (seção 7)", () => {
  let c: Campo;
  before(async () => {
    c = await prepararCampo();
  });
  after(() => c.amb.fechar());

  const dar = (u: UsuarioDeTeste, pontos: number, quando: Date, opcoes: { historico?: boolean } = {}) =>
    lancar({ tx: c.amb.db, agora: AGORA, historico: opcoes.historico }, [{ usuarioId: u.id, regra: "apr_completa", chave: `teste:${randomUUID()}`, ocorridoEm: quando, pontos }]);
  /** O que o servidor faz depois de cada lançamento real: confere as conquistas da pessoa. */
  const avaliar = (u: UsuarioDeTeste) => concederConquistas({ tx: c.amb.db, agora: AGORA }, { usuarios: [u.id] });
  const criar = async (campos: Record<string, string | number | boolean>) => {
    const r = await c.amb.req("POST", "/gamificacao/conquistas", { como: c.admin, form: formulario(campos) });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    return r.corpo as { id: string; titulo: string; criterio: string; pontos: number; quantidade: number };
  };
  const obtidas = async (usuarioId: string) =>
    new Map((await c.amb.db.select({ id: conquista.id, titulo: conquista.titulo, obtidaEm: conquistaUsuario.obtidaEm }).from(conquistaUsuario).innerJoin(conquista, eq(conquista.id, conquistaUsuario.conquistaId)).where(eq(conquistaUsuario.usuarioId, usuarioId))).map((o) => [o.titulo, o]));

  it("a carga inicial traz as 27 conquistas (21 de pessoa e 6 de equipe, sem pontos) e as 5 patentes", async () => {
    // 23 da migração 0016 + 3 dos treinamentos de serviço (migração 0027: Aprendiz, Especialista, Nota máxima) + a de sincronização offline (0037), todas de pessoa.
    const todas = await c.amb.db.select().from(conquista);
    assert.equal(todas.length, 27);
    const deEquipe = todas.filter((x) => ["aprs_da_equipe", "execucoes_da_equipe", "preventivas_em_dia_da_equipe", "pontos_gerais_da_equipe", "patente_da_equipe", "posicao_da_equipe", "temporadas_impecaveis"].includes(x.criterio));
    assert.equal(deEquipe.length, 6);
    assert.ok(deEquipe.every((x) => x.pontos === 0));
    assert.ok(todas.filter((x) => !deEquipe.includes(x)).every((x) => x.pontos >= 25 || x.criterio === "sincronizacoes_offline"), "só a de sincronização offline vale 0 ponto (a sincronização não pontua)");
    const patentes = await c.amb.esperar(200, "GET", "/gamificacao/patentes", { como: c.supervisor });
    assert.deepEqual(patentes.patentes.map((p: any) => [p.nome, p.pontos_necessarios, p.cor]), [["Bronze", 0, "#CD7F32"], ["Prata", 300, "#A8A9AD"], ["Ouro", 1500, "#D4AF37"], ["Platina", 3000, "#9DB4C0"], ["Diamante", 5000, "#4FC3F7"]]);
    const regras = await c.amb.esperar(200, "GET", "/gamificacao/regras", { como: c.supervisor });
    // As 18 da seção 2.1 do `docs/gamificacao-e-treinamentos.md`: 14 + treinamento_servico_concluido (5) e treinamento_servico_fases (1), dos treinamentos (seção 8.8), + as 2 de colaboração (30 e 3), da sugestão de materiais.
    assert.equal(regras.regras.length, 18);
    assert.deepEqual(regras.regras.map((r: any) => r.pontos), [10, 10, 5, 10, 5, 5, 5, 5, 5, 5, 10, 5, 1, 3, 3, 30, 3, 0]);
  });

  it("a primeira APR concede 'Primeiro passo' (25 pontos), com aviso pendente até a pessoa ver; não é dada duas vezes", async () => {
    const u = await c.tecnico("Primeira Vez");
    const o = await c.novaOs();
    const { resposta } = await c.apr(u, o.id);
    const minhas = await obtidas(u.id);
    assert.ok(minhas.has("Primeiro passo"));
    assert.equal(minhas.get("Primeiro passo")!.obtidaEm.toISOString(), AGORA.toISOString());
    const lancamento = (await c.extrato(u.id, true)).find((l) => l.regra === "conquista_obtida");
    assert.equal(lancamento!.pontos, 25);
    assert.equal(lancamento!.chave, `conquista:${minhas.get("Primeiro passo")!.id}`);
    assert.ok(resposta.ganhos.some((g: any) => g.regra === "conquista_obtida" && g.pontos === 25 && g.nome === "Conquista: Primeiro passo"));
    assert.equal(await c.pontosDe(u.id, true), 15 + 25);

    const antes = await c.amb.esperar(200, "GET", "/gamificacao/eu", { como: u });
    assert.deepEqual(antes.avisos.conquistas.map((a: any) => a.titulo), ["Primeiro passo"]);
    assert.equal((await c.amb.esperar(200, "GET", "/me", { como: u })).gamificacao.avisos_pendentes >= 1, true);
    await c.amb.esperar(200, "POST", "/gamificacao/avisos/vistos", { como: u });
    const depois = await c.amb.esperar(200, "GET", "/gamificacao/eu", { como: u });
    assert.deepEqual(depois.avisos.conquistas, []);
    assert.equal((await c.amb.esperar(200, "GET", "/me", { como: u })).gamificacao.avisos_pendentes, 0);

    const o2 = await c.novaOs();
    await c.apr(u, o2.id);
    assert.equal((await c.extrato(u.id, true)).filter((l) => l.regra === "conquista_obtida").length, 1);
  });

  it("Campo de treino concluído concede 'Pronto para o campo'", async () => {
    const u = await c.tecnico();
    await c.como(u, "PUT", "/me/treinamento", { json: { estado: "concluido" } });
    assert.ok((await obtidas(u.id)).has("Pronto para o campo"));
  });

  it("conquista nova vale para o passado: quem já bateu a meta recebe na hora, com a data em que bateu (lida do extrato)", async () => {
    const u = await c.tecnico("Velho de Guerra");
    const novato = await c.tecnico("Novato");
    await dar(u, 60, new Date("2026-08-10T12:00:00Z"), { historico: true });
    await dar(u, 60, new Date("2026-10-05T12:00:00Z"));
    await dar(novato, 10, new Date("2026-10-06T12:00:00Z"));

    const nova = await criar({ titulo: "Cem pontos", descricao: "Chegou aos 100.", criterio: "pontos_gerais", quantidade: 100, pontos: 30 });
    const minhas = await obtidas(u.id);
    assert.equal(minhas.get("Cem pontos")!.obtidaEm.toISOString(), "2026-10-05T12:00:00.000Z", "o lançamento que fez a soma chegar a 100");
    assert.equal((await obtidas(novato.id)).has("Cem pontos"), false);

    // Os pontos entram no extrato com a data em que a meta foi batida, na temporada aberta.
    const linha = (await c.extrato(u.id, true)).find((l) => l.chave === `conquista:${nova.id}`);
    assert.equal(linha!.pontos, 30);
    assert.equal(linha!.ocorridoEm.toISOString(), "2026-10-05T12:00:00.000Z");
    assert.equal(linha!.temporada, "2026-T4");

    // Uma conquista criada com data de meta numa temporada fechada cai na aberta.
    await c.amb.db.update(temporada).set({ fechadaEm: new Date("2026-10-08T00:00:00Z") }).where(eq(temporada.codigo, "2026-T3"));
    const antiga = await criar({ titulo: "Cinquenta pontos", descricao: "Metade do caminho.", criterio: "pontos_gerais", quantidade: 50, pontos: 15 });
    const l2 = (await c.extrato(u.id, true)).find((l) => l.chave === `conquista:${antiga.id}`);
    assert.equal(l2!.ocorridoEm.toISOString(), "2026-08-10T12:00:00.000Z");
    assert.equal(l2!.temporada, "2026-T4", "a temporada do trimestre da data já fechou: entra na aberta");
  });

  it("os pontos de uma conquista podem cumprir a meta de outra, e a conferência repete até estabilizar", async () => {
    const u = await c.tecnico("Cascata");
    await dar(u, 190, new Date(AGORA.getTime() - DIA));
    const b = await criar({ titulo: "Duzentos e cinquenta", descricao: "Passa dos 250.", criterio: "pontos_gerais", quantidade: 250, pontos: 20 });
    assert.equal((await obtidas(u.id)).has(b.titulo), false);
    // A conquista de 150 pontos vale 80: 190 + 80 = 270 cumpre também a de 250.
    await criar({ titulo: "Cento e cinquenta", descricao: "Passa dos 150.", criterio: "pontos_gerais", quantidade: 150, pontos: 80 });
    const minhas = await obtidas(u.id);
    assert.ok(minhas.has("Cento e cinquenta"));
    assert.ok(minhas.has("Duzentos e cinquenta"), "os 80 pontos da primeira cumpriram a meta da segunda");
    // Os pontos de cada uma entram no extrato (as outras conquistas deste grupo de testes também valem para quem tem 190 pontos).
    const pontosDe = async (titulo: string) => {
      const [x] = await c.amb.db.select().from(conquista).where(eq(conquista.titulo, titulo));
      return (await c.extrato(u.id, true)).find((l) => l.chave === `conquista:${x!.id}`)?.pontos;
    };
    assert.equal(await pontosDe("Cento e cinquenta"), 80);
    assert.equal(await pontosDe("Duzentos e cinquenta"), 20);
  });

  it("editar a meta: quem já tem a conquista não perde; se a meta baixar, quem passa a cumpri-la recebe; reativar também confere", async () => {
    const forte = await c.tecnico("Forte");
    const fraco = await c.tecnico("Fraco");
    await dar(forte, 500, new Date(AGORA.getTime() - 2 * DIA));
    await dar(fraco, 300, new Date(AGORA.getTime() - 2 * DIA));
    const meta = await criar({ titulo: "Meta alta", descricao: "Quinhentos.", criterio: "pontos_gerais", quantidade: 500, pontos: 25 });
    assert.ok((await obtidas(forte.id)).has("Meta alta"));
    assert.equal((await obtidas(fraco.id)).has("Meta alta"), false);

    // Subir a meta não tira de quem já tem.
    await c.amb.esperar(200, "PATCH", `/gamificacao/conquistas/${meta.id}`, { como: c.admin, json: { quantidade: 5000 } });
    assert.ok((await obtidas(forte.id)).has("Meta alta"));
    // Baixar a meta dá a quem passa a cumprir.
    await c.amb.esperar(200, "PATCH", `/gamificacao/conquistas/${meta.id}`, { como: c.admin, json: { quantidade: 300 } });
    assert.ok((await obtidas(fraco.id)).has("Meta alta"));

    // Desativada: deixa de ser dada, mas quem a tem continua com ela.
    await c.amb.esperar(200, "PATCH", `/gamificacao/conquistas/${meta.id}`, { como: c.admin, json: { ativa: false } });
    const depois = await c.tecnico("Depois");
    await dar(depois, 400, new Date(AGORA.getTime() - DIA));
    assert.equal((await obtidas(depois.id)).has("Meta alta"), false);
    assert.ok((await obtidas(forte.id)).has("Meta alta"));
    // Reativar confere todo mundo.
    await c.amb.esperar(200, "PATCH", `/gamificacao/conquistas/${meta.id}`, { como: c.admin, json: { ativa: true } });
    assert.ok((await obtidas(depois.id)).has("Meta alta"));

    // Mudar os pontos vale dali em diante: o lançamento antigo não muda.
    const antes = (await c.extrato(forte.id, true)).find((l) => l.chave === `conquista:${meta.id}`);
    await c.amb.esperar(200, "PATCH", `/gamificacao/conquistas/${meta.id}`, { como: c.admin, json: { pontos: 40 } });
    assert.equal((await c.extrato(forte.id, true)).find((l) => l.chave === `conquista:${meta.id}`)!.pontos, antes!.pontos);

    // Excluir só vale se ninguém a tem.
    const excluir = await c.como(c.admin, "DELETE", `/gamificacao/conquistas/${meta.id}`);
    assert.equal(excluir.status, 409);
    assert.equal(excluir.corpo.erro.codigo, "conquista_em_uso");
    const vazia = await criar({ titulo: "Ninguém chega lá", descricao: "Impossível.", criterio: "pontos_gerais", quantidade: 900000, pontos: 0 });
    assert.equal((await c.como(c.admin, "DELETE", `/gamificacao/conquistas/${vazia.id}`)).status, 200);
    assert.equal((await c.amb.db.select().from(conquista).where(eq(conquista.id, vazia.id))).length, 0);
  });

  it("conquista de equipe: concedida à equipe, sem pontos (mesmo que o admin informe), e pessoa não vira equipe", async () => {
    const equipeH = await c.amb.criarEquipe({ nome: "Equipe H" });
    const a = await c.tecnico("H1", equipeH.id);
    const b = await c.tecnico("H2", equipeH.id);
    const nova = await criar({ titulo: "Duas juntos", descricao: "Duas execuções.", criterio: "execucoes_da_equipe", quantidade: 2, pontos: 50 });
    assert.equal(nova.pontos, 0, "nas conquistas de equipe os pontos são sempre 0");

    const o1 = await c.novaOs({ equipeId: equipeH.id });
    await c.servico(a, o1.id, [a, b]);
    assert.equal((await c.amb.db.select().from(conquistaEquipe).where(and(eq(conquistaEquipe.conquistaId, nova.id), eq(conquistaEquipe.equipeId, equipeH.id)))).length, 0, "uma execução só: ainda não");
    const o2 = await c.novaOs({ equipeId: equipeH.id });
    await c.servico(b, o2.id, [b]);
    const [da] = await c.amb.db.select().from(conquistaEquipe).where(and(eq(conquistaEquipe.conquistaId, nova.id), eq(conquistaEquipe.equipeId, equipeH.id)));
    assert.ok(da, "duas OS distintas com execução concluída creditadas à equipe");
    assert.equal((await c.amb.db.select().from(lancamentoPontos).where(eq(lancamentoPontos.chave, `conquista:${nova.id}`))).length, 0, "equipe não pontua");

    const lista = await c.amb.esperar(200, "GET", "/gamificacao/conquistas", { como: a });
    const item = lista.conquistas.find((x: any) => x.id === nova.id);
    assert.equal(item.tipo, "equipe");
    assert.ok(item.obtida_em);
    assert.equal(item.progresso, null);

    const troca = await c.como(c.admin, "PATCH", `/gamificacao/conquistas/${nova.id}`, { json: { criterio: "aprs_completas" } });
    assert.equal(troca.status, 422);
    assert.equal(troca.corpo.erro.codigo, "tipo_imutavel");
  });

  it("conquista de patente: alcançar a patente numa temporada (e 'Brilho de diamante' dá 100 pontos)", async () => {
    const u = await c.tecnico("Diamante");
    await dar(u, 5000, new Date(AGORA.getTime() - 3 * DIA));
    await avaliar(u);
    const minhas = await obtidas(u.id);
    assert.ok(minhas.has("Brilho de diamante"));
    assert.ok(!minhas.has("Pódio"), "posição só vale numa temporada fechada");
    const ouro = (await c.amb.esperar(200, "GET", "/gamificacao/patentes", { como: u })).patentes.find((p: any) => p.nome === "Ouro");
    const sem = await c.amb.req("POST", "/gamificacao/conquistas", { como: c.admin, form: formulario({ titulo: "Sem patente", descricao: "x", criterio: "patente" }) });
    assert.equal(sem.status, 422);
    assert.equal(sem.corpo.erro.codigo, "patente_obrigatoria");
    const comOuro = await criar({ titulo: "Chegou ao ouro", descricao: "Alcançou o ouro.", criterio: "patente", patente_id: ouro.id, quantidade: 77, pontos: 0 });
    assert.equal(comOuro.quantidade, 1, "a meta é a patente: a quantidade fica em 1");
    assert.ok((await obtidas(u.id)).has("Chegou ao ouro"));
  });

  it("a tarefa 'Conquista obtida' desativada concede a conquista, mas sem os pontos", async () => {
    await c.como(c.admin, "PATCH", "/gamificacao/regras/conquista_obtida", { json: { ativa: false } });
    try {
      const u = await c.tecnico("Sem Pontos");
      await dar(u, 60, new Date(AGORA.getTime() - DIA));
      const nova = await criar({ titulo: "Sessenta", descricao: "Sessenta pontos.", criterio: "pontos_gerais", quantidade: 60, pontos: 99 });
      assert.ok((await obtidas(u.id)).has(nova.titulo));
      assert.equal((await c.amb.db.select().from(lancamentoPontos).where(and(eq(lancamentoPontos.usuarioId, u.id), eq(lancamentoPontos.regra, "conquista_obtida")))).length, 0);
      assert.equal((await c.como(c.admin, "PATCH", "/gamificacao/regras/conquista_obtida", { json: { pontos: 5 } })).status, 422, "sem valor próprio");
    } finally {
      await c.como(c.admin, "PATCH", "/gamificacao/regras/conquista_obtida", { json: { ativa: true } });
    }
    const [r] = await c.amb.db.select().from(regraPontuacao).where(eq(regraPontuacao.codigo, "conquista_obtida"));
    assert.equal(r!.ativa, true);
  });

  it("locais diferentes: conta os locais distintos com execução concluída", async () => {
    const u = await c.tecnico("Explorador de Locais");
    const dois = await criar({ titulo: "Dois locais", descricao: "Dois locais.", criterio: "locais_diferentes", quantidade: 2, pontos: 0 });
    await c.servico(u, (await c.novaOs()).id);
    await c.servico(u, (await c.novaOs()).id);
    assert.equal((await obtidas(u.id)).has(dois.titulo), false, "dois serviços no mesmo local contam um só");
    const lista = await c.amb.esperar(200, "GET", "/gamificacao/conquistas", { como: u });
    assert.deepEqual(lista.conquistas.find((x: any) => x.id === dois.id).progresso, { atual: 1, meta: 2, cumprida: false });
    await c.servico(u, (await c.novaOs({ critico: true })).id);
    assert.ok((await obtidas(u.id)).has(dois.titulo));
  });

  it("posição numa temporada fechada: 'Pódio' para os três primeiros, com a data do fechamento e os pontos na temporada aberta", async () => {
    const times = await c.amb.criarEquipe({ nome: "Pódio" });
    const quatro = await Promise.all([1, 2, 3, 4].map((i) => c.tecnico(`Podio ${i}`, times.id)));
    const T1 = new Date("2026-02-10T12:00:00Z");
    for (const [i, u] of quatro.entries()) await dar(u, 1000 - i * 100, T1, { historico: true });
    const fechouEm = new Date("2026-10-13T16:00:00Z");
    assert.equal(await fecharTemporada(c.amb.db, "2026-T1", fechouEm), true);
    for (const u of quatro.slice(0, 3)) {
      const o = (await obtidas(u.id)).get("Pódio");
      assert.ok(o, "entre os três primeiros");
      assert.equal(o.obtidaEm.toISOString(), fechouEm.toISOString());
      const pontos = (await c.extrato(u.id, true)).find((l) => l.regra === "conquista_obtida" && l.chave === `conquista:${o.id}`);
      assert.equal(pontos!.pontos, 100);
      assert.equal(pontos!.temporada, "2026-T4");
    }
    assert.equal((await obtidas(quatro[3]!.id)).has("Pódio"), false);
  });

  it("a galeria: meta em texto, progresso, raridade e visibilidade (o técnico não vê a desativada que não tem)", async () => {
    const u = await c.tecnico("Galeria");
    const o = await c.novaOs();
    await c.apr(u, o.id);
    const lista = await c.amb.esperar(200, "GET", "/gamificacao/conquistas", { como: u });
    const olhoVivo = lista.conquistas.find((x: any) => x.titulo === "Olho vivo");
    assert.equal(olhoVivo.meta, "Complete 50 APRs");
    assert.deepEqual(olhoVivo.progresso, { atual: 1, meta: 50, cumprida: false });
    assert.equal(olhoVivo.obtida_em, null);
    assert.equal(olhoVivo.tipo, "pessoa");
    const primeiro = lista.conquistas.find((x: any) => x.titulo === "Primeiro passo");
    assert.ok(primeiro.obtida_em);
    assert.equal(primeiro.progresso, null);
    assert.ok(primeiro.raridade > 0 && primeiro.raridade <= 1);
    const brilho = lista.conquistas.find((x: any) => x.titulo === "Brilho de diamante");
    assert.equal(brilho.meta, "Alcance a patente Diamante numa temporada");
    assert.equal(lista.conquistas.find((x: any) => x.titulo === "Equipe em campo").meta, "A equipe conclui 100 execuções");
    assert.ok(lista.criterios.some((x: any) => x.codigo === "aprs_completas" && x.tipo === "pessoa"));
    assert.ok(lista.criterios.some((x: any) => x.codigo === "patente_da_equipe" && x.pede_patente));
    assert.ok(lista.conquistas.every((x: any) => typeof x.imagem_url === "string" && x.imagem_url.includes("gamificacao")));

    const [guardiao] = await c.amb.db.select().from(conquista).where(eq(conquista.titulo, "Guardião da APR"));
    await c.amb.esperar(200, "PATCH", `/gamificacao/conquistas/${guardiao!.id}`, { como: c.admin, json: { ativa: false } });
    assert.equal((await c.amb.esperar(200, "GET", "/gamificacao/conquistas", { como: u })).conquistas.some((x: any) => x.titulo === "Guardião da APR"), false);
    assert.equal((await c.amb.esperar(200, "GET", "/gamificacao/conquistas", { como: c.admin })).conquistas.some((x: any) => x.titulo === "Guardião da APR"), true);
    await c.amb.esperar(200, "PATCH", `/gamificacao/conquistas/${guardiao!.id}`, { como: c.admin, json: { ativa: true } });
  });

  it("as conquistas aparecem no perfil da pessoa e da equipe", async () => {
    const u = await c.tecnico("Perfil com troféu");
    await c.como(u, "PUT", "/me/treinamento", { json: { estado: "concluido" } });
    const perfil = await c.amb.esperar(200, "GET", `/gamificacao/usuarios/${u.id}`, { como: c.supervisor });
    assert.ok(perfil.conquistas.some((x: any) => x.titulo === "Pronto para o campo"));
    assert.ok(perfil.patente.nome);
    assert.ok(perfil.maior_patente.nome);
    const admin = await c.como(c.admin, "GET", `/gamificacao/usuarios/${c.admin.id}`);
    assert.equal(admin.status, 404, "o admin não joga: não tem perfil de pontuação");
  });

  it("uma pessoa desativada não recebe conquistas novas", async () => {
    const u = await c.tecnico("Desativado");
    await c.amb.db.update(usuario).set({ ativo: false }).where(eq(usuario.id, u.id));
    await dar(u, 1234, new Date(AGORA.getTime() - DIA));
    await criar({ titulo: "Mil", descricao: "Mil pontos.", criterio: "pontos_gerais", quantidade: 1000, pontos: 0 });
    assert.equal((await obtidas(u.id)).has("Mil"), false);
  });
});
