import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { equipe, lancamentoPontos, temporada, temporadaEquipe, temporadaUsuario, usuario } from "../src/db/schema";
import { fecharTemporada, fecharTemporadasVencidas } from "../src/dominio/fechamento-temporada";
import { lancar } from "../src/dominio/lancamentos";
import { iniciarTarefas } from "../src/servicos/tarefas";
import { AGORA, prepararCampo, type Campo, type UsuarioDeTeste } from "./gamificacao-ajuda";

const MIN = 60_000;

describe("Gamificação: patentes, ranking e equipes (seções 3, 5 e 6)", () => {
  let c: Campo;
  before(async () => {
    c = await prepararCampo();
  });
  after(() => c.amb.fechar());

  /** Lança pontos direto no extrato (a regra não importa aqui); `historico` mantém o trimestre real da data. */
  async function dar(u: UsuarioDeTeste, pontos: number, quando: Date, opcoes: { historico?: boolean; osId?: string } = {}) {
    return lancar({ tx: c.amb.db, agora: AGORA, historico: opcoes.historico }, [{ usuarioId: u.id, regra: "apr_completa", chave: `teste:${randomUUID()}`, ocorridoEm: quando, pontos, osId: opcoes.osId ?? null }]);
  }
  const ranking = async (como: UsuarioDeTeste, consulta: Record<string, string> = {}) => (await c.amb.esperar(200, "GET", "/gamificacao/ranking", { como, consulta })) as { linhas: any[]; temporada: any };

  it("ranking de pessoas: ordem por pontos, empate pelo último lançamento mais antigo, só técnicos ativos e liberados", async () => {
    const equipeB = await c.amb.criarEquipe({ nome: "Equipe B" });
    const lider = await c.amb.criarUsuario({ perfil: "tecnico", equipeId: equipeB.id, nome: "Lia Líder" });
    const empatadoCedo = await c.amb.criarUsuario({ perfil: "tecnico", equipeId: equipeB.id, nome: "Cedo" });
    const empatadoTarde = await c.amb.criarUsuario({ perfil: "tecnico", equipeId: equipeB.id, nome: "Tarde" });
    const semPontos = await c.amb.criarUsuario({ perfil: "tecnico", equipeId: equipeB.id, nome: "Zero" });
    const inativo = await c.amb.criarUsuario({ perfil: "tecnico", equipeId: equipeB.id, nome: "Inativo", ativo: false });
    const pendente = await c.amb.criarUsuario({ perfil: "tecnico", equipeId: equipeB.id, nome: "Pendente" });
    await c.amb.db.update(usuario).set({ liberacao: "pendente" }).where(eq(usuario.id, pendente.id));

    await dar(lider, 500, new Date(AGORA.getTime() - 10 * MIN));
    await dar(empatadoTarde, 100, new Date(AGORA.getTime() - 5 * MIN));
    await dar(empatadoCedo, 100, new Date(AGORA.getTime() - 60 * MIN));
    await dar(inativo, 900, new Date(AGORA.getTime() - 20 * MIN));
    await dar(pendente, 900, new Date(AGORA.getTime() - 20 * MIN));
    await dar(c.admin, 900, new Date(AGORA.getTime() - 20 * MIN));

    const r = await ranking(lider, { tipo: "pessoas" });
    const nomes = r.linhas.map((l) => l.nome);
    assert.ok(!nomes.includes("Inativo") && !nomes.includes("Pendente") && !nomes.includes("Admin"));
    const ordem = nomes.filter((n) => ["Lia Líder", "Cedo", "Tarde", "Zero"].includes(n));
    assert.deepEqual(ordem, ["Lia Líder", "Cedo", "Tarde", "Zero"], "o empate fica com quem tem o último lançamento mais antigo");
    assert.equal(r.linhas[0].posicao, 1);
    assert.ok(r.linhas.every((l, i) => l.posicao === i + 1));
    assert.equal(r.linhas.find((l) => l.nome === "Lia Líder").voce, true);
    assert.equal(r.temporada.codigo, "2026-T4");
    assert.equal(r.temporada.atual, true);
  });

  it("anônimo: os outros veem 'Participante anônimo' (sem equipe nem link); a própria pessoa e o admin veem o nome", async () => {
    const equipeC = await c.amb.criarEquipe({ nome: "Equipe C" });
    const discreto = await c.amb.criarUsuario({ perfil: "tecnico", equipeId: equipeC.id, nome: "Dora Discreta" });
    const colega = await c.amb.criarUsuario({ perfil: "tecnico", equipeId: equipeC.id, nome: "Caio Colega" });
    await dar(discreto, 777, new Date(AGORA.getTime() - 3 * MIN));
    const alterar = await c.como(discreto, "PUT", "/me/ranking-anonimo", { json: { anonimo: true } });
    assert.equal(alterar.status, 200);
    assert.equal(alterar.corpo.ranking_anonimo, true);

    const paraOutro = (await ranking(colega)).linhas.find((l) => l.pontos === 777);
    assert.equal(paraOutro.nome, "Participante anônimo");
    assert.equal(paraOutro.usuario_id, null);
    assert.equal(paraOutro.equipe_nome, null);
    assert.equal(paraOutro.anonimo, true);
    assert.equal(paraOutro.pontos, 777, "os pontos continuam valendo");

    const paraEla = (await ranking(discreto)).linhas.find((l) => l.pontos === 777);
    assert.equal(paraEla.nome, "Dora Discreta");
    assert.equal(paraEla.voce, true);
    const paraAdmin = (await ranking(c.admin)).linhas.find((l) => l.pontos === 777);
    assert.equal(paraAdmin.nome, "Dora Discreta");

    // O perfil dela também some para os outros: sem patente nem conquistas.
    const perfilParaOutro = await c.amb.esperar(200, "GET", `/gamificacao/usuarios/${discreto.id}`, { como: colega });
    assert.deepEqual(perfilParaOutro, { anonimo: true });
    const perfilDela = await c.amb.esperar(200, "GET", `/gamificacao/usuarios/${discreto.id}`, { como: discreto });
    assert.equal(perfilDela.anonimo, false);
    assert.ok(perfilDela.patente);

    // Os pontos dela continuam na equipe, e a lista de membros da equipe a mascara.
    const equipePerfil = await c.amb.esperar(200, "GET", `/gamificacao/equipes/${equipeC.id}`, { como: colega });
    const membro = equipePerfil.pessoas.find((p: any) => p.pontos === 777);
    assert.equal(membro.nome, "Participante anônimo");
    assert.equal(membro.usuario_id, null);
    assert.equal(equipePerfil.pontos_temporada >= 777, true);

    // Voltar a aparecer.
    await c.como(discreto, "PUT", "/me/ranking-anonimo", { json: { anonimo: false } });
    assert.equal((await ranking(colega)).linhas.find((l) => l.pontos === 777).nome, "Dora Discreta");
  });

  it("o admin não tem anonimato nem pontuação própria: PUT /me/ranking-anonimo e as rotas de 'Minha pontuação' são 403", async () => {
    const admin = c.admin;
    assert.equal((await c.como(admin, "PUT", "/me/ranking-anonimo", { json: { anonimo: true } })).status, 403);
    assert.equal((await c.como(admin, "GET", "/gamificacao/eu")).status, 403);
    assert.equal((await c.como(admin, "GET", "/gamificacao/extrato")).status, 403);
    assert.equal((await c.como(admin, "POST", "/gamificacao/avisos/vistos")).status, 403);
    const eu = await c.amb.esperar(200, "GET", "/me", { como: admin });
    assert.equal(eu.gamificacao, null);
  });

  it("'Minha pontuação': patente (Bronze, Prata…), barra até a próxima, posições e GET /me com o resumo da barra", async () => {
    const equipeD = await c.amb.criarEquipe({ nome: "Equipe D" });
    const u = await c.amb.criarUsuario({ perfil: "tecnico", equipeId: equipeD.id, nome: "Paula Pontos" });
    const comeco = await c.amb.esperar(200, "GET", "/gamificacao/eu", { como: u });
    assert.equal(comeco.patente.nome, "Bronze", "com a carga inicial ninguém fica sem patente");
    assert.equal(comeco.proxima_patente.nome, "Prata");
    assert.equal(comeco.proxima_patente.faltam, 300);
    assert.equal(comeco.pontos_temporada, 0);
    assert.deepEqual(comeco.barra, { de: 0, ate: 300 });

    await dar(u, 320, new Date(AGORA.getTime() - MIN));
    const depois = await c.amb.esperar(200, "GET", "/gamificacao/eu", { como: u });
    assert.equal(depois.pontos_temporada, 320);
    assert.equal(depois.pontos_gerais, 320);
    assert.equal(depois.patente.nome, "Prata");
    assert.equal(depois.proxima_patente.nome, "Ouro");
    assert.equal(depois.proxima_patente.faltam, 1500 - 320);
    assert.equal(depois.maior_patente.nome, "Prata");
    assert.ok(depois.patente.imagem_url?.includes("gamificacao"));
    assert.ok(depois.posicao_temporada >= 1 && depois.posicao_temporada <= depois.participantes_temporada);
    assert.equal(depois.temporada.codigo, "2026-T4");
    assert.equal(depois.temporada.nome, "Primavera 2026");
    // A patente nova aparece como aviso até ser vista.
    assert.equal(depois.avisos.patente.nome, "Prata");
    await c.amb.esperar(200, "POST", "/gamificacao/avisos/vistos", { como: u });
    assert.equal((await c.amb.esperar(200, "GET", "/gamificacao/eu", { como: u })).avisos.patente, null);

    const me = await c.amb.esperar(200, "GET", "/me", { como: u });
    assert.equal(me.gamificacao.patente.nome, "Prata");
    assert.equal(me.gamificacao.pontos_temporada, 320);
    assert.equal(me.gamificacao.temporada.codigo, "2026-T4");
    assert.equal(me.usuario.ranking_anonimo, false);
  });

  it("extrato: cada linha diz de onde veio o ponto, com filtro por temporada e total", async () => {
    const equipeE = await c.amb.criarEquipe({ nome: "Equipe E" });
    const u = await c.amb.criarUsuario({ perfil: "tecnico", equipeId: equipeE.id });
    const o = await c.novaOs({ numeroOrdem: "4019821", equipeId: equipeE.id });
    await c.servico(u, o.id);
    const extrato = await c.amb.esperar(200, "GET", "/gamificacao/extrato", { como: u });
    const descricoes = extrato.lancamentos.map((l: any) => l.descricao);
    assert.ok(descricoes.includes("APR completa da OS 4019821"), JSON.stringify(descricoes));
    assert.ok(descricoes.includes("Execução concluída da OS 4019821"));
    assert.ok(extrato.lancamentos.some((l: any) => l.descricao.startsWith("Conquista:")));
    assert.equal(extrato.pontos, extrato.lancamentos.reduce((t: number, l: any) => t + l.pontos, 0));
    assert.equal(extrato.temporada, "2026-T4");
    // Outra temporada: vazio; geral: tudo.
    assert.equal((await c.amb.esperar(200, "GET", "/gamificacao/extrato", { como: u, consulta: { temporada: "2026-T3" } })).total, 0);
    assert.equal((await c.amb.esperar(200, "GET", "/gamificacao/extrato", { como: u, consulta: { temporada: "geral" } })).total, extrato.total);
    assert.equal((await c.como(u, "GET", "/gamificacao/extrato", { consulta: { temporada: "lixo" } })).status, 404);
  });

  it("ranking de equipes: pela média por membro (a equipe maior não ganha só por ser maior) e o supervisor conta em cada equipe que supervisiona", async () => {
    const grande = await c.amb.criarEquipe({ nome: "Grande" });
    const pequena = await c.amb.criarEquipe({ nome: "Pequena" });
    const g = await Promise.all([1, 2, 3, 4].map((i) => c.amb.criarUsuario({ perfil: "tecnico", equipeId: grande.id, nome: `G${i}` })));
    const p = await Promise.all([1, 2].map((i) => c.amb.criarUsuario({ perfil: "tecnico", equipeId: pequena.id, nome: `P${i}` })));
    // Grande: 4 pessoas, 600 no total (média 150); Pequena: 2 pessoas, 400 no total (média 200).
    for (const u of g) await dar(u, 150, new Date(AGORA.getTime() - 2 * MIN));
    for (const u of p) await dar(u, 200, new Date(AGORA.getTime() - 2 * MIN));

    const r = (await c.amb.esperar(200, "GET", "/gamificacao/ranking", { como: p[0]!, consulta: { tipo: "equipes" } })) as { linhas: any[] };
    const linhaG = r.linhas.find((l) => l.nome === "Grande");
    const linhaP = r.linhas.find((l) => l.nome === "Pequena");
    assert.equal(linhaG.pontos, 600);
    assert.equal(linhaG.membros, 4);
    assert.equal(linhaG.media, 150);
    assert.equal(linhaP.media, 200);
    assert.ok(linhaP.posicao < linhaG.posicao, "a média define a ordem, e não a soma");
    assert.equal(linhaP.voce, true);
    assert.equal(linhaG.voce, false);
    assert.ok(linhaP.patente, "a patente da equipe é a tabela aplicada à média");

    // Supervisor de outra equipe: conta integralmente (pontos e pessoa) na equipe que supervisiona.
    const supervisor = await c.amb.criarUsuario({ perfil: "tecnico", equipeId: grande.id, nome: "Chefe" });
    await c.amb.db.update(equipe).set({ supervisorId: supervisor.id }).where(eq(equipe.id, pequena.id));
    await dar(supervisor, 90, new Date(AGORA.getTime() - MIN));
    const depois = (await c.amb.esperar(200, "GET", "/gamificacao/ranking", { como: p[0]!, consulta: { tipo: "equipes" } })) as { linhas: any[] };
    const pequena2 = depois.linhas.find((l) => l.nome === "Pequena");
    const grande2 = depois.linhas.find((l) => l.nome === "Grande");
    assert.equal(pequena2.membros, 3, "os dois técnicos mais o supervisor que é de outra equipe");
    assert.equal(pequena2.pontos, 400 + 90);
    assert.equal(grande2.membros, 5);
    assert.equal(grande2.pontos, 600 + 90);

    const sem = await c.amb.criarEquipe({ nome: "Sem ninguém" });
    assert.ok(!depois.linhas.some((l) => l.equipe_id === sem.id), "equipe sem ninguém fica fora do ranking");
    const perfil = await c.amb.esperar(200, "GET", `/gamificacao/equipes/${pequena.id}`, { como: g[0]! });
    assert.equal(perfil.membros, 3);
    assert.equal(perfil.pessoas.length, 3);
    assert.ok(perfil.pessoas.some((m: any) => m.nome === "Chefe"));
    assert.equal(perfil.pontos_temporada, 490);
  });

  it("ranking geral: soma todas as temporadas; temporada inexistente (código inválido) é 404", async () => {
    const equipeF = await c.amb.criarEquipe({ nome: "Equipe F" });
    const u = await c.amb.criarUsuario({ perfil: "tecnico", equipeId: equipeF.id, nome: "Geraldo Geral" });
    await dar(u, 40, new Date("2026-08-15T12:00:00Z"), { historico: true });
    await dar(u, 60, new Date(AGORA.getTime() - MIN));
    const geral = await ranking(u, { temporada: "geral" });
    const linha = geral.linhas.find((l) => l.nome === "Geraldo Geral");
    assert.equal(linha.pontos, 100);
    assert.equal(geral.temporada, null);
    const daTemporada = (await ranking(u)).linhas.find((l) => l.nome === "Geraldo Geral");
    assert.equal(daTemporada.pontos, 60);
    assert.equal((await c.como(u, "GET", "/gamificacao/ranking", { consulta: { temporada: "2026-T9" } })).status, 404);
    assert.equal((await c.como(u, "GET", "/gamificacao/ranking", { consulta: { tipo: "times" } })).status, 422);
  });

  it("fechamento: grava pontos, patente e posição de pessoas e equipes; o que chega depois com data da temporada fechada entra na aberta", async () => {
    const x = await c.amb.criarEquipe({ nome: "Fecha X" });
    const y = await c.amb.criarEquipe({ nome: "Fecha Y" });
    const a = await c.amb.criarUsuario({ perfil: "tecnico", equipeId: x.id, nome: "Fecha A" });
    const b = await c.amb.criarUsuario({ perfil: "tecnico", equipeId: x.id, nome: "Fecha B" });
    const d = await c.amb.criarUsuario({ perfil: "tecnico", equipeId: y.id, nome: "Fecha D" });
    const ja = await c.amb.criarUsuario({ perfil: "tecnico", equipeId: y.id, nome: "Fecha Saiu" });
    await dar(a, 1600, new Date("2026-08-01T12:00:00Z"), { historico: true });
    await dar(b, 310, new Date("2026-08-02T12:00:00Z"), { historico: true });
    await dar(d, 50, new Date("2026-08-03T12:00:00Z"), { historico: true });
    await dar(ja, 5000, new Date("2026-08-03T12:00:00Z"), { historico: true });
    // Quem foi desativado antes do fechamento sai do ranking que será gravado.
    await c.amb.db.update(usuario).set({ ativo: false }).where(eq(usuario.id, ja.id));

    // A tolerância de 2026-T3 vai até 07/10; com o relógio em 13/10 o executor de tarefas já pode fechar.
    assert.deepEqual(await fecharTemporadasVencidas(c.amb.db, AGORA), ["2026-T3"]);
    assert.deepEqual(await fecharTemporadasVencidas(c.amb.db, AGORA), [], "fechar de novo não faz nada");
    const [t3] = await c.amb.db.select().from(temporada).where(eq(temporada.codigo, "2026-T3"));
    assert.ok(t3!.fechadaEm);
    const t4 = await c.amb.db.select().from(temporada).where(eq(temporada.codigo, "2026-T4"));
    assert.equal(t4[0]?.fechadaEm ?? null, null, "a temporada aberta não fecha");

    const pessoas = await c.amb.db.select().from(temporadaUsuario).where(eq(temporadaUsuario.temporada, "2026-T3"));
    const pos = (id: string) => pessoas.find((p) => p.usuarioId === id);
    assert.equal(pos(a.id)!.pontos, 1600);
    assert.equal(pos(b.id)!.pontos, 310);
    assert.equal(pos(ja.id), undefined);
    assert.ok(pos(a.id)!.posicao < pos(b.id)!.posicao && pos(b.id)!.posicao < pos(d.id)!.posicao);
    const patentes = await c.amb.esperar(200, "GET", "/gamificacao/patentes", { como: a });
    const idDe = (nome: string) => patentes.patentes.find((p: any) => p.nome === nome).id;
    assert.equal(pos(a.id)!.patenteId, idDe("Ouro"));
    assert.equal(pos(b.id)!.patenteId, idDe("Prata"));
    assert.equal(pos(d.id)!.patenteId, idDe("Bronze"));

    const times = await c.amb.db.select().from(temporadaEquipe).where(eq(temporadaEquipe.temporada, "2026-T3"));
    const tx = times.find((t) => t.equipeId === x.id)!;
    const ty = times.find((t) => t.equipeId === y.id)!;
    assert.equal(tx.pontos, 1910);
    assert.equal(tx.membros, 2);
    assert.equal(tx.media, 955);
    // O que a pessoa desativada fez continua creditado à equipe (a soma), mas ela já não conta nas pessoas (a média).
    assert.equal(ty.pontos, 5050);
    assert.equal(ty.membros, 1);
    assert.equal(ty.posicao, 1);
    assert.equal(tx.posicao, 2);

    // O ranking da temporada fechada vem do gravado, inclusive depois de a patente mudar.
    const antes = (await ranking(a, { temporada: "2026-T3" })).linhas.find((l) => l.nome === "Fecha A");
    assert.equal(antes.patente.nome, "Ouro");
    assert.equal(antes.pontos, 1600);
    await c.como(c.admin, "PATCH", `/gamificacao/patentes/${idDe("Ouro")}`, { json: { pontos_necessarios: 2000 } });
    assert.equal((await ranking(a, { temporada: "2026-T3" })).linhas.find((l) => l.nome === "Fecha A").patente.nome, "Ouro", "as fechadas guardam a patente gravada");
    await c.como(c.admin, "PATCH", `/gamificacao/patentes/${idDe("Ouro")}`, { json: { pontos_necessarios: 1500 } });
    assert.equal((await ranking(a, { temporada: "2026-T3" })).temporada.fechada, true);

    // Depois do fechamento: um lançamento com data de 2026-T3 entra na temporada aberta.
    const [tardio] = await dar(a, 25, new Date("2026-09-20T12:00:00Z"));
    const [linha] = await c.amb.db.select().from(lancamentoPontos).where(eq(lancamentoPontos.id, tardio!.lancamentoId));
    assert.equal(linha!.temporada, "2026-T4");
    assert.equal(linha!.ocorridoEm.toISOString(), "2026-09-20T12:00:00.000Z");
  });

  it("maior patente da equipe: a maior que a média já alcançou, numa temporada fechada ou na aberta; no ranking geral e no perfil", async () => {
    const geral = async () => ((await c.amb.esperar(200, "GET", "/gamificacao/ranking", { como: c.supervisor, consulta: { tipo: "equipes", temporada: "geral" } })) as { linhas: any[] }).linhas;
    const perfil = (id: string) => c.amb.esperar(200, "GET", `/gamificacao/equipes/${id}`, { como: c.supervisor });
    const idDaEquipe = async (nome: string) => (await c.amb.db.select({ id: equipe.id }).from(equipe).where(eq(equipe.nome, nome)))[0]!.id;

    // Da temporada fechada (2026-T3, do teste anterior): "Fecha Y" fechou com média 5050 (Diamante) e "Fecha X" com 955 (Prata).
    // Na aberta (2026-T4) as duas têm média perto de zero, então a patente de agora é a menor, mas a maior continua gravada.
    const y = await idDaEquipe("Fecha Y");
    const x = await idDaEquipe("Fecha X");
    const linhas = await geral();
    assert.equal(linhas.find((l) => l.equipe_id === y).patente.nome, "Diamante", "no geral, a patente da equipe é a maior já alcançada");
    assert.equal(linhas.find((l) => l.equipe_id === x).patente.nome, "Prata");
    const perfilY = await perfil(y);
    assert.equal(perfilY.patente.nome, "Bronze", "a patente da temporada de agora continua a da média de agora");
    assert.equal(perfilY.maior_patente.nome, "Diamante");
    assert.equal((await perfil(x)).maior_patente.nome, "Prata");
    assert.ok(perfilY.maior_patente.imagem_url?.includes("gamificacao"));

    // A equipe usa a imagem da patente para equipes, e a pessoa, a das pessoas.
    const escada = (await c.amb.esperar(200, "GET", "/gamificacao/patentes", { como: c.supervisor })).patentes as any[];
    const patenteDe = (nome: string) => escada.find((p) => p.nome === nome);
    assert.notEqual(patenteDe("Diamante").imagem_url, patenteDe("Diamante").imagem_equipe_url, "a carga traz uma imagem para cada lado");
    assert.equal(linhas.find((l) => l.equipe_id === y).patente.imagem_url, patenteDe("Diamante").imagem_equipe_url, "ranking de equipes");
    assert.equal(perfilY.maior_patente.imagem_url, patenteDe("Diamante").imagem_equipe_url, "maior patente da equipe");
    assert.equal(perfilY.patente.imagem_url, patenteDe("Bronze").imagem_equipe_url, "patente da equipe");
    const doMembro = perfilY.pessoas.find((m: any) => m.nome === "Fecha D");
    assert.equal(doMembro.patente.imagem_url, patenteDe(doMembro.patente.nome).imagem_url, "a patente de cada membro é a das pessoas");
    const dasPessoas = (await ranking(c.supervisor, { temporada: "geral" })).linhas.find((l) => l.nome === "Fecha A");
    assert.equal(dasPessoas.patente.imagem_url, patenteDe(dasPessoas.patente.nome).imagem_url, "ranking de pessoas");

    // Da temporada aberta: a média de 1.600 por membro é Ouro, e já conta como a maior sem esperar o fechamento.
    const ouro = await c.amb.criarEquipe({ nome: "Maior Ouro" });
    for (const nome of ["Ouro 1", "Ouro 2"]) await dar(await c.amb.criarUsuario({ perfil: "tecnico", equipeId: ouro.id, nome }), 1600, new Date(AGORA.getTime() - MIN));
    const doOuro = await perfil(ouro.id);
    assert.equal(doOuro.media, 1600);
    assert.equal(doOuro.patente.nome, "Ouro");
    assert.equal(doOuro.maior_patente.nome, "Ouro");
    assert.equal((await geral()).find((l) => l.equipe_id === ouro.id).patente.nome, "Ouro");

    // Equipe nova, sem pontos: a maior é a primeira da escada (como a de uma pessoa que está começando).
    const nova = await c.amb.criarEquipe({ nome: "Maior Nova" });
    await c.amb.criarUsuario({ perfil: "tecnico", equipeId: nova.id, nome: "Novata" });
    assert.equal((await geral()).find((l) => l.equipe_id === nova.id).patente.nome, "Bronze");
    assert.equal((await perfil(nova.id)).maior_patente.nome, "Bronze");

    // A temporada fechada continua mostrando a patente gravada (a da média da época), e não a maior de hoje.
    const t3 = ((await c.amb.esperar(200, "GET", "/gamificacao/ranking", { como: c.supervisor, consulta: { tipo: "equipes", temporada: "2026-T3" } })) as { linhas: any[] }).linhas;
    assert.equal(t3.find((l) => l.equipe_id === x).patente.nome, "Prata");
  });

  it("temporada impecável: a equipe teve preventivas no trimestre e nenhuma ficou atrasada sem justificativa", async () => {
    const boa = await c.amb.criarEquipe({ nome: "Impecável" });
    const ruim = await c.amb.criarEquipe({ nome: "Atrasada" });
    const semPreventiva = await c.amb.criarEquipe({ nome: "Sem preventiva" });
    for (const e of [boa, ruim, semPreventiva]) await c.amb.criarUsuario({ perfil: "tecnico", equipeId: e.id });
    await c.novaOs({ equipeId: boa.id, tipo: "preventiva", dataInicioProg: "2026-02-10", dataFimProg: "2026-02-12", status: "encerrada" });
    await c.novaOs({ equipeId: ruim.id, tipo: "preventiva", dataInicioProg: "2026-02-10", dataFimProg: "2026-02-12", status: "liberada" });
    await c.novaOs({ equipeId: semPreventiva.id, tipo: "corretiva", dataInicioProg: "2026-02-10", status: "liberada" });
    const alguem = await c.amb.criarUsuario({ perfil: "tecnico", equipeId: boa.id });
    await dar(alguem, 10, new Date("2026-02-11T12:00:00Z"), { historico: true });
    assert.equal(await fecharTemporada(c.amb.db, "2026-T1", AGORA), true);
    const linhas = await c.amb.db.select().from(temporadaEquipe).where(eq(temporadaEquipe.temporada, "2026-T1"));
    const impecavel = (id: string) => linhas.find((l) => l.equipeId === id)?.impecavel;
    assert.equal(impecavel(boa.id), true);
    assert.equal(impecavel(ruim.id), false);
    assert.equal(impecavel(semPreventiva.id), false);
  });

  it("o executor de tarefas fecha as temporadas vencidas", async () => {
    const equipeG = await c.amb.criarEquipe({ nome: "Equipe G" });
    const u = await c.amb.criarUsuario({ perfil: "tecnico", equipeId: equipeG.id });
    await dar(u, 33, new Date("2026-04-10T12:00:00Z"), { historico: true });
    const parar = iniciarTarefas(c.amb.deps);
    try {
      let fechada = false;
      for (let i = 0; i < 100 && !fechada; i++) {
        await new Promise((r) => setTimeout(r, 50));
        const [t] = await c.amb.db.select().from(temporada).where(eq(temporada.codigo, "2026-T2"));
        fechada = Boolean(t?.fechadaEm);
      }
      assert.ok(fechada, "o executor fechou a temporada 2026-T2");
    } finally {
      parar();
    }
  });

  it("GET /gamificacao/temporadas lista as temporadas conhecidas e a de hoje", async () => {
    const r = await c.amb.esperar(200, "GET", "/gamificacao/temporadas", { como: c.supervisor });
    const atual = r.temporadas.find((t: any) => t.atual);
    assert.equal(atual.codigo, "2026-T4");
    assert.equal(atual.nome, "Primavera 2026");
    assert.equal(atual.inicio, "2026-10-01");
    assert.equal(atual.fim, "2026-12-31");
    assert.ok(r.temporadas.some((t: any) => t.codigo === "2026-T3" && t.fechada));
  });

  it("sem token é 401", async () => {
    assert.equal((await c.amb.req("GET", "/gamificacao/ranking")).status, 401);
    assert.equal((await c.amb.req("GET", "/gamificacao/patentes")).status, 401);
  });

});
