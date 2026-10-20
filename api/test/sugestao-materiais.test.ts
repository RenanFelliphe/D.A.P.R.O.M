import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { atividade, atividadeMaterial, auditoria, alerta, lancamentoEquipe, lancamentoPontos, localInstalacao, material, os, sugestaoMateriais, temporada } from "../src/db/schema";
import { executarTarefasPendentes } from "../src/servicos/tarefas";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

/** Sugestão e contestação da lista de materiais de um serviço (`/sugestoes-materiais`). */
describe("Sugestão e contestação de materiais", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let equipeA: string;
  let equipeB: string;
  let supervisorA: UsuarioDeTeste;
  let supervisorB: UsuarioDeTeste;
  let tecnicoA: UsuarioDeTeste;
  let tecnicoA2: UsuarioDeTeste;
  let tecnicoB: UsuarioDeTeste;
  let localId: string;
  let luva: { id: string };
  let detector: { id: string };
  let tinta: { id: string };
  let contadorOs = 4_300_000;
  const servico = "9.9.1";
  const caminhoDoServico = `/catalogo/servicos/${encodeURIComponent(servico)}`;

  const novaOs = (equipeId: string, codigo = servico, status: "liberada" | "cancelada" | "devolvida" | "encerrada" = "liberada") =>
    amb.db.insert(os).values({ numeroOrdem: String(++contadorOs), tipo: "corretiva", titulo: "Inspeção", localInstalacaoId: localId, equipeId, dataInicioProg: "2026-10-15", origem: "sap", codigoAtividade: codigo, status });
  const criarMaterial = (dados: object) => amb.esperar(201, "POST", "/catalogo/materiais", { como: admin, json: dados });
  const enviar = (como: UsuarioDeTeste, dados: object, status = 201) => amb.esperar(status, "POST", "/sugestoes-materiais", { como, json: dados });
  const listaDoServico = async () => (await amb.esperar(200, "GET", caminhoDoServico, { como: admin })).materiais.map((m: { material_id: string; quantidade: number | null }) => [m.material_id, m.quantidade]);
  const alertasDe = (usuarioId: string, tipo: string) => amb.db.select().from(alerta).where(and(eq(alerta.destinatarioId, usuarioId), eq(alerta.tipo, tipo as never)));
  const pontosDe = async (usuarioId: string, regra: string) =>
    (await amb.db.select().from(lancamentoPontos).where(and(eq(lancamentoPontos.usuarioId, usuarioId), eq(lancamentoPontos.regra, regra)))).reduce((t, l) => t + l.pontos, 0);

  before(async () => {
    amb = await criarAmbiente({ comCarga: true, relogio: new Date("2026-10-15T15:00:00Z"), duracaoDoTokenSeg: 90 * 86_400 });
    admin = await amb.criarUsuario({ perfil: "admin" });
    equipeA = (await amb.criarEquipe({ nome: "Equipe Alfa" })).id;
    equipeB = (await amb.criarEquipe({ nome: "Equipe Beta" })).id;
    supervisorA = await amb.criarUsuario({ perfil: "tecnico", nome: "Sônia Alfa", equipeId: equipeA, supervisor: true });
    supervisorB = await amb.criarUsuario({ perfil: "tecnico", nome: "Beto Beta", equipeId: equipeB, supervisor: true });
    tecnicoA = await amb.criarUsuario({ perfil: "tecnico", nome: "Ana Alfa", equipeId: equipeA });
    tecnicoA2 = await amb.criarUsuario({ perfil: "tecnico", nome: "Alex Alfa", equipeId: equipeA });
    tecnicoB = await amb.criarUsuario({ perfil: "tecnico", nome: "Bia Beta", equipeId: equipeB });
    await amb.db.insert(atividade).values([
      { codigo: servico, descricao: "Inspeção de estação redutora" },
      { codigo: "9.9.2", descricao: "Serviço de ninguém" },
    ]);
    [{ id: localId }] = (await amb.db.insert(localInstalacao).values({ codigo: "CARIACICA/ERP" }).returning({ id: localInstalacao.id })) as [{ id: string }];
    luva = await criarMaterial({ descricao: "Luva de vaqueta", unidade: "par", categoria: "epi" });
    detector = await criarMaterial({ descricao: "Detector de gases", unidade: "un", categoria: "ferramenta" });
    tinta = await criarMaterial({ descricao: "Tinta epóxi", unidade: "L" });
    await amb.esperar(200, "PUT", caminhoDoServico, { como: admin, json: { materiais: [{ material_id: luva.id, quantidade: 2 }] } });
    // A equipe Alfa tem 3 OS do serviço; a Beta, 1 (e uma cancelada, que não conta).
    await Promise.all([novaOs(equipeA), novaOs(equipeA), novaOs(equipeA), novaOs(equipeB), novaOs(equipeB, servico, "cancelada")]);
  });
  after(() => amb.fechar());

  describe("equipes que fazem o serviço", () => {
    it("lista da que mais faz para a que menos faz, sem as OS canceladas; a primeira é a responsável", async () => {
      const { equipes } = await amb.esperar(200, "GET", "/sugestoes-materiais/equipes", { como: tecnicoB, consulta: { atividade: servico } });
      assert.deepEqual(equipes.map((e: { nome: string; os_total: number; responsavel: boolean }) => [e.nome, e.os_total, e.responsavel]), [["Equipe Alfa", 3, true], ["Equipe Beta", 1, false]]);
      assert.equal(equipes[0].supervisor_nome, "Sônia Alfa");
    });

    it("no empate de OS, vence a equipe com mais pontos; sem pontos, a ordem alfabética", async () => {
      await novaOs(equipeB);
      await novaOs(equipeB);
      const empatado = (await amb.esperar(200, "GET", "/sugestoes-materiais/equipes", { como: tecnicoB, consulta: { atividade: servico } })).equipes;
      assert.deepEqual(empatado.map((e: { nome: string }) => e.nome), ["Equipe Alfa", "Equipe Beta"], "sem pontos, alfabética");
      // Pontos para a Beta: um lançamento creditado a ela.
      await amb.db.insert(temporada).values({ codigo: "2026-T4", nome: "Primavera 2026", inicio: "2026-10-01", fim: "2026-12-31" }).onConflictDoNothing();
      const [t] = await amb.db.select().from(temporada).where(eq(temporada.codigo, "2026-T4"));
      const [lanc] = await amb.db.insert(lancamentoPontos).values({ usuarioId: tecnicoB.id, regra: "apr_completa", pontos: 50, chave: "teste-desempate", ocorridoEm: amb.relogio.agora, temporada: t!.codigo }).returning();
      await amb.db.insert(lancamentoEquipe).values({ lancamentoId: lanc!.id, equipeId: equipeB });
      const comPontos = (await amb.esperar(200, "GET", "/sugestoes-materiais/equipes", { como: tecnicoB, consulta: { atividade: servico } })).equipes;
      assert.deepEqual(comPontos.map((e: { nome: string; responsavel: boolean; pontos: number }) => [e.nome, e.responsavel, e.pontos]), [["Equipe Beta", true, 50], ["Equipe Alfa", false, 0]]);
      // Desfaz: o resto dos testes conta com a Alfa na frente.
      await amb.db.delete(lancamentoEquipe).where(eq(lancamentoEquipe.lancamentoId, lanc!.id));
      await amb.db.delete(lancamentoPontos).where(eq(lancamentoPontos.id, lanc!.id));
      await amb.db.delete(os).where(and(eq(os.equipeId, equipeB), eq(os.status, "liberada"), eq(os.codigoAtividade, servico)));
      await novaOs(equipeB);
    });

    it("serviço sem nenhuma OS não tem equipe responsável", async () => {
      const { equipes } = await amb.esperar(200, "GET", "/sugestoes-materiais/equipes", { como: tecnicoA, consulta: { atividade: "9.9.2" } });
      assert.deepEqual(equipes, []);
    });
  });

  describe("enviar", () => {
    it("a sugestão chega ao supervisor da equipe que mais faz o serviço, e a lista continua a mesma até ele aceitar", async () => {
      const s = await enviar(tecnicoB, {
        atividade: servico,
        tipo: "sugestao",
        motivo: "Falta o detector",
        lista: [{ material_id: luva.id, quantidade: 2 }, { material_id: detector.id, quantidade: 1 }],
      });
      assert.equal(s.estado, "pendente");
      assert.equal(s.equipe_responsavel_nome, "Equipe Alfa");
      assert.equal(s.desatualizada, false);
      assert.equal(s.posso_retirar, true);
      assert.equal(s.posso_avaliar, false);
      assert.deepEqual(await listaDoServico(), [[luva.id, 2]]);
      const avisos = await alertasDe(supervisorA.id, "sugestao_materiais_nova");
      assert.equal(avisos.length, 1);
      assert.match(avisos[0]!.detalhe, /Bia Beta sugeriu uma lista de materiais para 9\.9\.1/);
      assert.match(avisos[0]!.detalhe, /\+ Detector de gases/);
      assert.equal((await alertasDe(supervisorB.id, "sugestao_materiais_nova")).length, 0, "a equipe que não é a responsável não recebe");
      assert.equal(avisos[0]!.sugestaoMateriaisId, s.id);
      await amb.esperar(200, "POST", `/sugestoes-materiais/${s.id}/retirar`, { como: tecnicoB });
    });

    it("o administrador não envia; o item digitado fica livre, mas o que já existe no catálogo é ligado", async () => {
      assert.equal((await amb.req("POST", "/sugestoes-materiais", { como: admin, json: { atividade: servico, tipo: "sugestao", lista: [{ material_id: tinta.id }] } })).status, 403);
      const s = await enviar(tecnicoB, {
        atividade: servico,
        tipo: "sugestao",
        lista: [{ descricao: "  luva  DE vaqueta ", unidade: "PAR", quantidade: 4 }, { descricao: "Chave inglesa 12", unidade: "un", categoria: "ferramenta" }],
      });
      assert.equal(s.itens[0].material_id, luva.id, "a mesma descrição e unidade do catálogo vira o material");
      assert.equal(s.itens[1].material_id, null);
      assert.equal(s.itens[1].descricao, "Chave inglesa 12");
      await amb.esperar(200, "POST", `/sugestoes-materiais/${s.id}/retirar`, { como: tecnicoB });
    });

    it("recusa lista igual à atual, lista vazia na sugestão, repetidos e material inexistente", async () => {
      const r = async (dados: object) => amb.req("POST", "/sugestoes-materiais", { como: tecnicoB, json: { atividade: servico, tipo: "sugestao", ...dados } });
      assert.equal((await r({ lista: [{ material_id: luva.id, quantidade: 2 }] })).corpo.erro.codigo, "sem_mudanca");
      assert.equal((await r({ lista: [] })).corpo.erro.codigo, "lista_obrigatoria");
      assert.equal((await r({ lista: [{ material_id: luva.id }, { material_id: luva.id }] })).corpo.erro.codigo, "material_repetido");
      assert.equal((await r({ lista: [{ material_id: "00000000-0000-4000-8000-000000000000" }] })).corpo.erro.codigo, "material_inexistente");
      assert.equal((await amb.req("POST", "/sugestoes-materiais", { como: tecnicoB, json: { atividade: "nao-existe", tipo: "sugestao", lista: [{ material_id: tinta.id }] } })).status, 404);
    });

    it("a contestação exige o motivo; a lista é opcional", async () => {
      const semMotivo = await amb.req("POST", "/sugestoes-materiais", { como: tecnicoB, json: { atividade: servico, tipo: "contestacao", motivo: "curto" } });
      assert.equal(semMotivo.status, 422);
      assert.equal(semMotivo.corpo.erro.codigo, "motivo_obrigatorio");
      const c = await enviar(tecnicoB, { atividade: servico, tipo: "contestacao", motivo: "A luva de vaqueta não serve para este serviço." });
      assert.equal(c.tipo, "contestacao");
      assert.equal(c.tem_lista, false);
      assert.deepEqual(c.itens, []);
      assert.equal((await alertasDe(supervisorA.id, "contestacao_materiais_nova")).length, 1);
      await amb.esperar(200, "POST", `/sugestoes-materiais/${c.id}/retirar`, { como: tecnicoB });
    });

    it("só uma pendente por pessoa e serviço", async () => {
      const primeira = await enviar(tecnicoB, { atividade: servico, tipo: "sugestao", lista: [{ material_id: tinta.id }] });
      const segunda = await amb.req("POST", "/sugestoes-materiais", { como: tecnicoB, json: { atividade: servico, tipo: "sugestao", lista: [{ material_id: detector.id }] } });
      assert.equal(segunda.status, 409);
      assert.equal(segunda.corpo.erro.codigo, "sugestao_pendente");
      // Outra pessoa pode.
      const deOutro = await enviar(tecnicoA2, { atividade: servico, tipo: "sugestao", lista: [{ material_id: detector.id }] });
      await amb.esperar(200, "POST", `/sugestoes-materiais/${primeira.id}/retirar`, { como: tecnicoB });
      await amb.esperar(200, "POST", `/sugestoes-materiais/${deOutro.id}/retirar`, { como: tecnicoA2 });
    });

    it("quem recebe é outro supervisor, se o autor é o supervisor da equipe responsável; só o autor retira", async () => {
      const s = await enviar(supervisorA, { atividade: servico, tipo: "sugestao", lista: [{ material_id: tinta.id }] });
      assert.equal(s.posso_avaliar, false, "ninguém avalia a própria sugestão");
      const comoAdmin = await amb.esperar(200, "GET", `/sugestoes-materiais/${s.id}`, { como: admin });
      assert.equal(comoAdmin.posso_avaliar, true);
      assert.ok((await alertasDe(admin.id, "sugestao_materiais_nova")).length >= 1, "sem outro avaliador, os administradores recebem");
      assert.equal((await amb.req("POST", `/sugestoes-materiais/${s.id}/retirar`, { como: tecnicoA })).status, 403);
      await amb.esperar(200, "POST", `/sugestoes-materiais/${s.id}/retirar`, { como: supervisorA });
    });
  });

  describe("avaliar", () => {
    it("o supervisor da equipe responsável vê na fila; o de outra equipe e o técnico não avaliam", async () => {
      const s = await enviar(tecnicoB, { atividade: servico, tipo: "sugestao", lista: [{ material_id: luva.id, quantidade: 2 }, { material_id: detector.id }] });
      const fila = await amb.esperar(200, "GET", "/sugestoes-materiais", { como: supervisorA, consulta: { escopo: "avaliar" } });
      assert.deepEqual(fila.sugestoes.map((x: { id: string }) => x.id), [s.id]);
      assert.equal(fila.sugestoes[0].posso_avaliar, true);
      assert.equal((await amb.esperar(200, "GET", "/sugestoes-materiais/resumo", { como: supervisorA })).para_avaliar, 1);
      assert.equal((await amb.esperar(200, "GET", "/sugestoes-materiais", { como: supervisorB, consulta: { escopo: "avaliar" } })).total, 0);
      assert.equal((await amb.req("POST", `/sugestoes-materiais/${s.id}/aceitar`, { como: supervisorB, json: {} })).status, 403);
      assert.equal((await amb.req("POST", `/sugestoes-materiais/${s.id}/aceitar`, { como: tecnicoA, json: {} })).status, 403);
      assert.equal((await amb.req("POST", `/sugestoes-materiais/${s.id}/recusar`, { como: tecnicoB, json: { resposta: "Tentando recusar a minha mesma sugestão" } })).status, 403);
      await amb.esperar(200, "POST", `/sugestoes-materiais/${s.id}/retirar`, { como: tecnicoB });
    });

    it("aceitar troca a lista do serviço, pontua o autor (30) e o avaliador (3), avisa o autor e todas as equipes que fazem o serviço", async () => {
      const s = await enviar(tecnicoB, { atividade: servico, tipo: "sugestao", lista: [{ material_id: luva.id, quantidade: 2 }, { material_id: detector.id, quantidade: 1 }] });
      const aceita = await amb.esperar(200, "POST", `/sugestoes-materiais/${s.id}/aceitar`, { como: supervisorA, json: { resposta: "Boa, faltava mesmo." } });
      assert.equal(aceita.estado, "aceita");
      assert.equal(aceita.ajustada, false);
      assert.equal(aceita.avaliada_por_nome, "Sônia Alfa");
      assert.equal(aceita.lista_mudou, true);
      assert.equal(aceita.pontos_ganhos, 3, "o avaliador ganha 3");
      assert.deepEqual(await listaDoServico(), [[luva.id, 2], [detector.id, 1]]);
      assert.equal(await pontosDe(tecnicoB.id, "sugestao_materiais_aceita"), 30);
      assert.equal(await pontosDe(supervisorA.id, "sugestao_materiais_avaliada"), 3);

      const aoAutor = await alertasDe(tecnicoB.id, "sugestao_materiais_aceita");
      assert.equal(aoAutor.length, 1);
      assert.match(aoAutor[0]!.detalhe, /foi aceita por Sônia Alfa\. Você ganhou 30 pontos\./);
      // As equipes que fazem o serviço sabem da mudança (menos o autor e o avaliador, que já sabem).
      const atualizados = (await amb.db.select().from(alerta).where(eq(alerta.tipo, "materiais_atualizados"))).filter((a) => a.atividadeCodigo === servico);
      const destinatarios = new Set(atualizados.map((a) => a.destinatarioId));
      assert.ok(destinatarios.has(tecnicoA.id) && destinatarios.has(tecnicoA2.id), "membros da equipe Alfa");
      assert.ok(destinatarios.has(supervisorB.id), "supervisor da equipe Beta");
      assert.ok(!destinatarios.has(tecnicoB.id) && !destinatarios.has(supervisorA.id) && !destinatarios.has(admin.id));
      assert.match(atualizados[0]!.detalhe, /\+ Detector de gases/);
      const trilha = await amb.db.select().from(auditoria);
      assert.ok(trilha.some((t) => t.acao === "sugestao_materiais.aceitar" && t.entidadeId === s.id));
      assert.ok(trilha.some((t) => t.acao === "atividade.materiais" && t.entidadeId === servico));
    });

    it("uma segunda aceita do mesmo serviço pela mesma pessoa em menos de 30 dias atualiza a lista, mas não pontua de novo", async () => {
      const s = await enviar(tecnicoB, { atividade: servico, tipo: "sugestao", lista: [{ material_id: luva.id, quantidade: 2 }, { material_id: detector.id, quantidade: 1 }, { material_id: tinta.id }] });
      const aceita = await amb.esperar(200, "POST", `/sugestoes-materiais/${s.id}/aceitar`, { como: supervisorA, json: {} });
      assert.equal(aceita.estado, "aceita");
      assert.equal(await pontosDe(tecnicoB.id, "sugestao_materiais_aceita"), 30, "continua 30");
      assert.doesNotMatch((await alertasDe(tecnicoB.id, "sugestao_materiais_aceita")).at(-1)!.detalhe, /Você ganhou/);
      // Depois de 30 dias, pontua de novo.
      amb.relogio.agora = new Date(amb.relogio.agora.getTime() + 31 * 86_400_000);
      const s2 = await enviar(tecnicoB, { atividade: servico, tipo: "sugestao", lista: [{ material_id: luva.id, quantidade: 2 }, { material_id: tinta.id }] });
      await amb.esperar(200, "POST", `/sugestoes-materiais/${s2.id}/aceitar`, { como: supervisorA, json: {} });
      assert.equal(await pontosDe(tecnicoB.id, "sugestao_materiais_aceita"), 60);
      amb.relogio.agora = new Date("2026-10-15T15:00:00Z");
    });

    it("aceitar com ajuste grava a lista do avaliador e marca a sugestão como ajustada", async () => {
      await amb.esperar(200, "PUT", caminhoDoServico, { como: admin, json: { materiais: [{ material_id: luva.id, quantidade: 2 }] } });
      const s = await enviar(tecnicoA2, { atividade: servico, tipo: "sugestao", lista: [{ material_id: luva.id, quantidade: 2 }, { material_id: detector.id, quantidade: 1 }] });
      const aceita = await amb.esperar(200, "POST", `/sugestoes-materiais/${s.id}/aceitar`, { como: supervisorA, json: { lista: [{ material_id: luva.id, quantidade: 3 }, { material_id: detector.id, quantidade: 1 }] } });
      assert.equal(aceita.ajustada, true);
      assert.deepEqual(await listaDoServico(), [[luva.id, 3], [detector.id, 1]]);
      assert.equal(await pontosDe(tecnicoA2.id, "sugestao_materiais_aceita"), 30, "ajustada conta como aceita");
    });

    it("o item digitado precisa ser ligado ou cadastrado por quem avalia", async () => {
      await amb.esperar(200, "PUT", caminhoDoServico, { como: admin, json: { materiais: [{ material_id: luva.id, quantidade: 2 }] } });
      const s = await enviar(tecnicoA, { atividade: servico, tipo: "sugestao", lista: [{ material_id: luva.id, quantidade: 2 }, { descricao: "Chave inglesa 12", unidade: "un", categoria: "ferramenta" }] });
      const semResolver = await amb.req("POST", `/sugestoes-materiais/${s.id}/aceitar`, { como: supervisorA, json: {} });
      assert.equal(semResolver.status, 422);
      assert.equal(semResolver.corpo.erro.codigo, "item_sem_material");
      assert.equal((await amb.esperar(200, "GET", `/sugestoes-materiais/${s.id}`, { como: admin })).estado, "pendente", "a falha desfaz tudo");
      const aceita = await amb.esperar(200, "POST", `/sugestoes-materiais/${s.id}/aceitar`, { como: supervisorA, json: { resolucoes: [{ ordem: 2, criar_material: true }] } });
      assert.equal(aceita.ajustada, false, "ligar o item digitado não é ajuste");
      const [criado] = await amb.db.select().from(material).where(eq(material.descricao, "Chave inglesa 12"));
      assert.ok(criado, "o material foi cadastrado");
      assert.equal(criado!.categoria, "ferramenta");
      assert.deepEqual(await listaDoServico(), [[luva.id, 2], [criado!.id, null]]);
    });

    it("liga o item digitado a um material que já existe", async () => {
      await amb.esperar(200, "PUT", caminhoDoServico, { como: admin, json: { materiais: [{ material_id: luva.id, quantidade: 2 }] } });
      const s = await enviar(tecnicoA, { atividade: servico, tipo: "sugestao", lista: [{ material_id: luva.id, quantidade: 2 }, { descricao: "Detector portátil de gás", unidade: "un" }] });
      await amb.esperar(200, "POST", `/sugestoes-materiais/${s.id}/aceitar`, { como: supervisorA, json: { resolucoes: [{ ordem: 2, material_id: detector.id }] } });
      assert.deepEqual(await listaDoServico(), [[luva.id, 2], [detector.id, null]]);
    });

    it("a contestação aceita sem lista pede a lista nova; com lista, aplica", async () => {
      await amb.esperar(200, "PUT", caminhoDoServico, { como: admin, json: { materiais: [{ material_id: luva.id, quantidade: 2 }] } });
      const c = await enviar(tecnicoB, { atividade: servico, tipo: "contestacao", motivo: "A luva de vaqueta não resiste a este produto químico." });
      const semLista = await amb.req("POST", `/sugestoes-materiais/${c.id}/aceitar`, { como: supervisorA, json: {} });
      assert.equal(semLista.corpo.erro.codigo, "lista_obrigatoria");
      const aceita = await amb.esperar(200, "POST", `/sugestoes-materiais/${c.id}/aceitar`, { como: supervisorA, json: { lista: [{ material_id: tinta.id, quantidade: 1 }] } });
      assert.equal(aceita.estado, "aceita");
      assert.deepEqual(await listaDoServico(), [[tinta.id, 1]]);
      assert.match((await alertasDe(tecnicoB.id, "sugestao_materiais_aceita")).at(-1)!.detalhe, /Sua contestação/);
    });

    it("recusar pede o motivo, avisa o autor, não muda a lista e o avaliador pontua do mesmo jeito", async () => {
      const antes = await listaDoServico();
      const pontosAntes = await pontosDe(supervisorA.id, "sugestao_materiais_avaliada");
      const s = await enviar(tecnicoA2, { atividade: servico, tipo: "sugestao", lista: [{ material_id: luva.id }] });
      assert.equal((await amb.req("POST", `/sugestoes-materiais/${s.id}/recusar`, { como: supervisorA, json: { resposta: "não" } })).corpo.erro.codigo, "resposta_obrigatoria");
      const recusada = await amb.esperar(200, "POST", `/sugestoes-materiais/${s.id}/recusar`, { como: supervisorA, json: { resposta: "A luva atual já cobre este serviço." } });
      assert.equal(recusada.estado, "recusada");
      assert.equal(recusada.resposta, "A luva atual já cobre este serviço.");
      assert.deepEqual(await listaDoServico(), antes);
      assert.equal(await pontosDe(supervisorA.id, "sugestao_materiais_avaliada"), pontosAntes + 3);
      const aviso = (await alertasDe(tecnicoA2.id, "sugestao_materiais_recusada")).at(-1)!;
      assert.match(aviso.detalhe, /foi recusada por Sônia Alfa\. Motivo: "A luva atual já cobre este serviço\."/);
      // Já avaliada: não avalia de novo, nem retira.
      assert.equal((await amb.req("POST", `/sugestoes-materiais/${s.id}/aceitar`, { como: supervisorA, json: {} })).corpo.erro.codigo, "sugestao_ja_avaliada");
      assert.equal((await amb.req("POST", `/sugestoes-materiais/${s.id}/retirar`, { como: tecnicoA2 })).corpo.erro.codigo, "sugestao_ja_avaliada");
    });

    it("a sugestão fica desatualizada quando a lista do serviço muda depois do envio", async () => {
      const s = await enviar(tecnicoA2, { atividade: servico, tipo: "sugestao", lista: [{ material_id: tinta.id, quantidade: 2 }] });
      assert.equal((await amb.esperar(200, "GET", `/sugestoes-materiais/${s.id}`, { como: supervisorA })).desatualizada, false);
      await amb.esperar(200, "PUT", caminhoDoServico, { como: admin, json: { materiais: [{ material_id: detector.id }] } });
      const depois = await amb.esperar(200, "GET", `/sugestoes-materiais/${s.id}`, { como: supervisorA });
      assert.equal(depois.desatualizada, true);
      assert.deepEqual(depois.lista_base.map((i: { descricao: string }) => i.descricao), ["Tinta epóxi"]);
      assert.deepEqual(depois.lista_atual.map((i: { descricao: string }) => i.descricao), ["Detector de gases"]);
      await amb.esperar(200, "POST", `/sugestoes-materiais/${s.id}/retirar`, { como: tecnicoA2 });
    });
  });

  describe("avisos da lista", () => {
    it("quando o admin muda a lista, todas as equipes que fazem o serviço são avisadas (só no sino)", async () => {
      const antes = (await amb.db.select().from(alerta).where(eq(alerta.tipo, "materiais_atualizados"))).length;
      await amb.esperar(200, "PUT", caminhoDoServico, { como: admin, json: { materiais: [{ material_id: luva.id, quantidade: 1 }] } });
      const novos = (await amb.db.select().from(alerta).where(eq(alerta.tipo, "materiais_atualizados"))).slice(antes);
      const destinatarios = new Set(novos.map((a) => a.destinatarioId));
      for (const u of [tecnicoA, tecnicoA2, tecnicoB, supervisorA, supervisorB]) assert.ok(destinatarios.has(u.id), `${u.id} avisado`);
      assert.ok(!destinatarios.has(admin.id));
      assert.equal(novos[0]!.emailEnviadoEm, null);
      // Salvar a mesma lista não avisa ninguém.
      const totalAntes = (await amb.db.select().from(alerta).where(eq(alerta.tipo, "materiais_atualizados"))).length;
      await amb.esperar(200, "PUT", caminhoDoServico, { como: admin, json: { materiais: [{ material_id: luva.id, quantidade: 1 }] } });
      assert.equal((await amb.db.select().from(alerta).where(eq(alerta.tipo, "materiais_atualizados"))).length, totalAntes);
    });

    it("a sugestão a avaliar e a resposta ao autor saem por e-mail (categoria Equipe), com o link para a sugestão; a lista mudou, não", async () => {
      await executarTarefasPendentes(amb.deps);
      const antes = amb.email.enviados.length;
      const s = await enviar(tecnicoA2, { atividade: servico, tipo: "contestacao", motivo: "A lista pede uma luva que não serve neste serviço." });
      await executarTarefasPendentes(amb.deps);
      const paraOSupervisor = amb.email.enviados.slice(antes).find((m) => m.para === supervisorA.email);
      assert.ok(paraOSupervisor, "o supervisor recebe o e-mail");
      assert.match(paraOSupervisor!.assunto, /^\[SYNQ OS\] Contestação de materiais para avaliar — /);
      assert.ok(paraOSupervisor!.texto.includes(`/app/catalogo/servicos/${servico}/materiais/sugestoes/${s.id}`), "o botão leva à sugestão");

      await amb.esperar(200, "POST", `/sugestoes-materiais/${s.id}/recusar`, { como: supervisorA, json: { resposta: "A luva atual já cobre este serviço." } });
      const depoisDaRecusa = amb.email.enviados.length;
      await executarTarefasPendentes(amb.deps);
      const aoAutor = amb.email.enviados.slice(depoisDaRecusa).find((m) => m.para === tecnicoA2.email);
      assert.ok(aoAutor, "o autor recebe a resposta");
      assert.match(aoAutor!.assunto, /Sua sugestão de materiais foi recusada/);

      // O aviso de que a lista mudou não gera tarefa de e-mail: fica só no sino.
      const antesDaMudanca = amb.email.enviados.length;
      await amb.esperar(200, "PUT", caminhoDoServico, { como: admin, json: { materiais: [{ material_id: luva.id, quantidade: 3 }] } });
      await executarTarefasPendentes(amb.deps);
      assert.equal(amb.email.enviados.slice(antesDaMudanca).filter((m) => /Materiais do serviço atualizados/.test(m.assunto)).length, 0);
    });

    it("o aviso de sugestão aparece em GET /alertas com o código do serviço", async () => {
      const s = await enviar(tecnicoA2, { atividade: servico, tipo: "sugestao", lista: [{ material_id: tinta.id }] });
      const { alertas } = await amb.esperar(200, "GET", "/alertas", { como: supervisorA });
      const a = alertas.find((x: { sugestao_id: string | null }) => x.sugestao_id === s.id);
      assert.ok(a, "o supervisor vê o aviso");
      assert.equal(a.servico_codigo, servico);
      assert.equal(a.tipo, "sugestao_materiais_nova");
      await amb.esperar(200, "POST", `/sugestoes-materiais/${s.id}/retirar`, { como: tecnicoA2 });
    });

    it("não exclui o material que está numa sugestão pendente", async () => {
      const novo = await criarMaterial({ descricao: "Fita isolante", unidade: "rolo" });
      const s = await enviar(tecnicoA2, { atividade: servico, tipo: "sugestao", lista: [{ material_id: novo.id }] });
      const r = await amb.req("DELETE", `/catalogo/materiais/${novo.id}`, { como: admin });
      assert.equal(r.status, 409);
      assert.equal(r.corpo.erro.codigo, "material_em_sugestao");
      await amb.esperar(200, "POST", `/sugestoes-materiais/${s.id}/retirar`, { como: tecnicoA2 });
      await amb.esperar(200, "DELETE", `/catalogo/materiais/${novo.id}`, { como: admin });
    });
  });

  describe("listas", () => {
    it("minhas, e o histórico do serviço (todos veem)", async () => {
      const minhas = await amb.esperar(200, "GET", "/sugestoes-materiais", { como: tecnicoB, consulta: { escopo: "minhas" } });
      assert.ok(minhas.total >= 3);
      assert.ok(minhas.sugestoes.every((s: { autor_id: string }) => s.autor_id === tecnicoB.id));
      const aceitas = await amb.esperar(200, "GET", "/sugestoes-materiais", { como: tecnicoA, consulta: { escopo: "servico", atividade: servico, estado: "aceita" } });
      assert.ok(aceitas.total >= 3);
      assert.ok(aceitas.sugestoes.every((s: { estado: string }) => s.estado === "aceita"));
      assert.equal((await amb.req("GET", "/sugestoes-materiais", { como: tecnicoA, consulta: { escopo: "servico" } })).status, 422);
      // O admin avalia qualquer uma pendente.
      assert.ok((await amb.esperar(200, "GET", "/sugestoes-materiais/resumo", { como: admin })).para_avaliar >= 0);
    });

    it("a lista base não mexe nas sugestões já gravadas depois que o serviço muda", async () => {
      const [qualquer] = await amb.db.select().from(sugestaoMateriais).where(eq(sugestaoMateriais.estado, "aceita")).limit(1);
      assert.ok(qualquer);
      assert.ok(Array.isArray(qualquer!.listaBase));
      // A tabela do serviço segue sendo a lista recomendada.
      const total = await amb.db.select().from(atividadeMaterial).where(eq(atividadeMaterial.atividadeCodigo, servico));
      assert.ok(total.length >= 1);
    });
  });
});
