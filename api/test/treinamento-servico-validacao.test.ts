import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { alerta, atividade, auditoria, localInstalacao, os, treinamentoServico, treinamentoServicoValidador, treinamentoServicoVersao } from "../src/db/schema";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

/**
 * A validação do treinamento pelos supervisores (`validacao-de-treinamento.md`): quem pode criar, quem valida (as 3 equipes que mais
 * fazem o serviço, sem a do autor), o quórum de 2 dos 3, a recusa que devolve ao autor, o rascunho travado, e a publicação direta do admin,
 * que exige justificativa quando a validação era possível.
 */
describe("Validação do treinamento pelos supervisores", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let localId: string;
  let contadorOs = 5_100_000;
  let contadorServicos = 0;

  /** Quatro equipes que fazem o serviço, da que mais faz (Alfa, 5 OS) à que menos faz (Delta, 2 OS), cada uma com o seu supervisor. */
  const equipes: Record<string, { id: string; supervisor: UsuarioDeTeste; tecnico: UsuarioDeTeste }> = {};

  const EXPLICACAO = [
    { ordem: 0, texto: "Antes de começar, confira os EPIs.", expressao: "explicando" },
    { ordem: 1, texto: "Vamos praticar!", expressao: "feliz" },
  ];
  const fases = (n = 3) => Array.from({ length: n }, (_, i) => ({ tipo: "quiz" as const, enunciado: `Pergunta ${i + 1}`, opcoes: ["Certa", "Errada 1", "Errada 2"], correta: 0, explicacao: "A primeira é a certa." }));

  const novaOs = (equipeId: string, codigo: string) =>
    amb.db.insert(os).values({ numeroOrdem: String(++contadorOs), tipo: "corretiva", titulo: "Inspeção", localInstalacaoId: localId, equipeId, dataInicioProg: "2026-10-15", origem: "sap", codigoAtividade: codigo, status: "liberada" });

  /** Um serviço novo, com OS das 4 equipes (5, 4, 3 e 2). */
  async function novoServico(): Promise<string> {
    const codigo = `V.${++contadorServicos}`;
    await amb.db.insert(atividade).values({ codigo, descricao: `Serviço ${codigo}` });
    for (const [nome, quantas] of [["Alfa", 5], ["Beta", 4], ["Gama", 3], ["Delta", 2]] as const) for (let i = 0; i < quantas; i++) await novaOs(equipes[nome]!.id, codigo);
    return codigo;
  }

  const assinatura = async () => {
    const id = randomUUID();
    await amb.armazenamento.gravar("assinaturas", id, new Uint8Array([1, 2, 3]), "image/png");
    return id;
  };
  const rascunho = (codigo: string, como: UsuarioDeTeste) => amb.req("GET", `/treinamentos/${codigo}/rascunho`, { como });
  const salvar = (codigo: string, como: UsuarioDeTeste, n = 3) => amb.req("PUT", `/treinamentos/${codigo}/rascunho`, { como, json: { explicacao: EXPLICACAO, fases: fases(n) } });
  const validacao = (codigo: string, como: UsuarioDeTeste) => amb.req("GET", `/treinamentos/${codigo}/validacao`, { como });
  const enviar = (codigo: string, como: UsuarioDeTeste) => amb.req("POST", `/treinamentos/${codigo}/validacao/enviar`, { como });
  const aprovar = (codigo: string, como: UsuarioDeTeste) => amb.req("POST", `/treinamentos/${codigo}/validacao/aprovar`, { como });
  const recusar = (codigo: string, como: UsuarioDeTeste, motivo = "A fase 2 está confusa") => amb.req("POST", `/treinamentos/${codigo}/validacao/recusar`, { como, json: { motivo } });
  const versaoDe = async (codigo: string, estado: "rascunho" | "publicada") => {
    const [t] = await amb.db.select().from(treinamentoServico).where(eq(treinamentoServico.atividadeCodigo, codigo));
    return (await amb.db.select().from(treinamentoServicoVersao).where(and(eq(treinamentoServicoVersao.treinamentoId, t!.id), eq(treinamentoServicoVersao.estado, estado))))[0];
  };
  const avisosDe = (usuarioId: string, tipo: string) => amb.db.select().from(alerta).where(and(eq(alerta.destinatarioId, usuarioId), eq(alerta.tipo, tipo as never)));

  /** O supervisor Alfa monta (salva) e envia; devolve o código. Os validadores, então, são Beta, Gama e Delta. */
  async function enviadoPorAlfa() {
    const codigo = await novoServico();
    assert.equal((await rascunho(codigo, equipes.Alfa!.supervisor)).status, 200);
    assert.equal((await salvar(codigo, equipes.Alfa!.supervisor)).status, 200);
    const r = await enviar(codigo, equipes.Alfa!.supervisor);
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    return codigo;
  }

  before(async () => {
    amb = await criarAmbiente();
    admin = await amb.criarUsuario({ perfil: "admin", nome: "Admin" });
    [{ id: localId }] = (await amb.db.insert(localInstalacao).values({ codigo: "CARIACICA/ERP" }).returning({ id: localInstalacao.id })) as [{ id: string }];
    for (const nome of ["Alfa", "Beta", "Gama", "Delta"]) {
      const equipe = await amb.criarEquipe({ nome: `Equipe ${nome}` });
      equipes[nome] = {
        id: equipe.id,
        supervisor: await amb.criarUsuario({ perfil: "tecnico", nome: `Sup ${nome}`, equipeId: equipe.id, supervisor: true }),
        tecnico: await amb.criarUsuario({ perfil: "tecnico", nome: `Téc ${nome}`, equipeId: equipe.id }),
      };
    }
  });
  after(() => amb.fechar());

  describe("quem cria", () => {
    it("o supervisor de equipe que faz o serviço cria; técnico, supervisor de equipe que não faz o serviço e serviço sem equipes ficam de fora", async () => {
      const codigo = await novoServico();
      const outra = await amb.criarEquipe({ nome: "Equipe Sem OS" });
      const supervisorSemOs = await amb.criarUsuario({ perfil: "tecnico", equipeId: outra.id, supervisor: true });

      assert.equal((await rascunho(codigo, equipes.Beta!.supervisor)).status, 200);
      assert.equal((await rascunho(codigo, equipes.Alfa!.supervisor)).status, 403, "o rascunho já é do Beta");
      assert.equal((await rascunho(codigo, supervisorSemOs)).status, 403);
      assert.equal((await rascunho(codigo, equipes.Gama!.tecnico)).status, 403);
      assert.equal((await rascunho(codigo, admin)).status, 200, "o admin edita qualquer rascunho");

      const meus = await amb.esperar(200, "GET", "/treinamentos/meus-servicos", { como: equipes.Gama!.supervisor });
      assert.equal(meus.admin, false);
      assert.ok(meus.servicos.includes(codigo));
      assert.deepEqual(await amb.esperar(200, "GET", "/treinamentos/meus-servicos", { como: supervisorSemOs }), { admin: false, servicos: [] });
      assert.equal((await amb.esperar(200, "GET", "/treinamentos/meus-servicos", { como: admin })).admin, true);
    });

    it("o rascunho de outra pessoa é recusado com o nome do autor", async () => {
      const codigo = await novoServico();
      await rascunho(codigo, equipes.Beta!.supervisor);
      const r = await rascunho(codigo, equipes.Gama!.supervisor);
      assert.equal(r.status, 403);
      assert.equal(r.corpo.erro.codigo, "rascunho_de_outra_pessoa");
      assert.match(r.corpo.erro.mensagem, /Sup Beta/);
      const meu = (await rascunho(codigo, equipes.Beta!.supervisor)).corpo;
      assert.deepEqual([meu.autor.nome, meu.pode_editar, meu.em_validacao], ["Sup Beta", true, false]);
    });
  });

  describe("quem valida", () => {
    it("as 3 equipes que mais fazem o serviço, sem a do autor: o autor do 1º lugar é validado pelo 2º, 3º e 4º", async () => {
      const codigo = await enviadoPorAlfa();
      const v = (await validacao(codigo, equipes.Alfa!.supervisor)).corpo;
      assert.equal(v.em_validacao, true);
      assert.deepEqual(v.validadores.map((x: { equipe_nome: string }) => x.equipe_nome), ["Equipe Beta", "Equipe Gama", "Equipe Delta"]);
      assert.deepEqual([v.necessarias, v.aprovacoes, v.rodada, v.autor.nome], [2, 0, 1, "Sup Alfa"]);
      for (const nome of ["Beta", "Gama", "Delta"]) assert.equal((await avisosDe(equipes[nome]!.supervisor.id, "treinamento_para_validar")).length > 0, true, nome);
      assert.equal((await avisosDe(equipes.Alfa!.supervisor.id, "treinamento_para_validar")).length, 0);
    });

    it("o admin como autor é validado pelo 1º, 2º e 3º da fila", async () => {
      const codigo = await novoServico();
      await rascunho(codigo, admin);
      await salvar(codigo, admin);
      const enviado = await enviar(codigo, admin);
      assert.equal(enviado.status, 200, JSON.stringify(enviado.corpo));
      assert.deepEqual(enviado.corpo.validadores.map((x: { equipe_nome: string }) => x.equipe_nome), ["Equipe Alfa", "Equipe Beta", "Equipe Gama"]);
    });

    it("quem supervisiona duas equipes ocupa uma vaga só; a segunda é do próximo da fila", async () => {
      const codigo = await novoServico();
      const [antes] = await amb.db.select().from(treinamentoServico).where(eq(treinamentoServico.atividadeCodigo, codigo));
      assert.equal(antes, undefined);
      // O supervisor Beta passa a supervisionar também a Gama: no lugar dela entra a Delta.
      const { equipe } = await import("../src/db/schema");
      await amb.db.update(equipe).set({ supervisorId: equipes.Beta!.supervisor.id }).where(eq(equipe.id, equipes.Gama!.id));
      try {
        await rascunho(codigo, admin);
        await salvar(codigo, admin);
        const r = await enviar(codigo, admin);
        assert.equal(r.status, 200, JSON.stringify(r.corpo));
        assert.deepEqual(r.corpo.validadores.map((x: { equipe_nome: string }) => x.equipe_nome), ["Equipe Alfa", "Equipe Beta", "Equipe Delta"]);
      } finally {
        await amb.db.update(equipe).set({ supervisorId: equipes.Gama!.supervisor.id }).where(eq(equipe.id, equipes.Gama!.id));
      }
    });

    it("sem nenhuma outra equipe para validar, o supervisor não consegue enviar e o admin publica direto, sem justificativa", async () => {
      const codigo = `V.sozinha.${++contadorServicos}`;
      await amb.db.insert(atividade).values({ codigo, descricao: "Só a Alfa faz" });
      await novaOs(equipes.Alfa!.id, codigo);
      await rascunho(codigo, equipes.Alfa!.supervisor);
      await salvar(codigo, equipes.Alfa!.supervisor);
      const r = await enviar(codigo, equipes.Alfa!.supervisor);
      assert.equal(r.status, 409);
      assert.equal(r.corpo.erro.codigo, "sem_validadores");
      const publicado = await amb.req("POST", `/treinamentos/${codigo}/publicar`, { como: admin, json: { arquivo_id: await assinatura() } });
      assert.equal(publicado.status, 200, JSON.stringify(publicado.corpo));
    });
  });

  describe("o quórum e a recusa", () => {
    it("2 dos 3 assinam e o treinamento é publicado sozinho; o terceiro já não pode decidir", async () => {
      const codigo = await enviadoPorAlfa();
      const primeira = await aprovar(codigo, equipes.Beta!.supervisor);
      assert.equal(primeira.status, 200, JSON.stringify(primeira.corpo));
      assert.deepEqual([primeira.corpo.publicada, primeira.corpo.aprovacoes], [false, 1]);
      assert.equal((await versaoDe(codigo, "publicada")), undefined);

      const segunda = await aprovar(codigo, equipes.Gama!.supervisor);
      assert.deepEqual([segunda.status, segunda.corpo.publicada], [200, true]);
      const no_ar = (await versaoDe(codigo, "publicada"))!;
      assert.equal(no_ar.publicadaPor, equipes.Gama!.supervisor.id);
      assert.ok(no_ar.assinaturaPath && no_ar.termo);
      assert.equal(no_ar.autorId, equipes.Alfa!.supervisor.id);

      const tarde = await aprovar(codigo, equipes.Delta!.supervisor);
      assert.ok([409, 404].includes(tarde.status), `status ${tarde.status}`);
      // Os técnicos jogam; o autor foi avisado e as assinaturas aparecem nas versões.
      assert.ok((await avisosDe(equipes.Alfa!.supervisor.id, "treinamento_validado")).length > 0);
      assert.equal((await amb.req("POST", `/treinamentos/${codigo}/tentativas`, { como: equipes.Beta!.tecnico })).status, 201);
      const { versoes } = await amb.esperar(200, "GET", `/treinamentos/${codigo}/versoes`, { como: equipes.Alfa!.supervisor });
      assert.equal(versoes[0].via, "validacao");
      assert.deepEqual(versoes[0].assinaturas.map((a: { nome: string; equipe_nome: string }) => [a.nome, a.equipe_nome]), [["Sup Beta", "Equipe Beta"], ["Sup Gama", "Equipe Gama"]]);
      const registros = await amb.db.select().from(auditoria).where(and(eq(auditoria.entidadeId, codigo), eq(auditoria.acao, "treinamento.aprovar")));
      assert.equal(registros.length, 2);
    });

    it("só o validador da rodada decide: o autor, o técnico, o supervisor de fora e quem já decidiu ficam de fora", async () => {
      const codigo = await enviadoPorAlfa();
      assert.equal((await aprovar(codigo, equipes.Alfa!.supervisor)).status, 403, "o autor não valida o que montou");
      assert.equal((await aprovar(codigo, equipes.Beta!.tecnico)).status, 403);
      assert.equal((await aprovar(codigo, admin)).status, 403, "o admin publica direto, não valida");
      const fora = await amb.criarUsuario({ perfil: "tecnico", equipeId: (await amb.criarEquipe()).id, supervisor: true });
      assert.equal((await aprovar(codigo, fora)).status, 403);
      assert.equal((await validacao(codigo, fora)).status, 403);
      assert.equal((await aprovar(codigo, equipes.Beta!.supervisor)).status, 200);
      const repetida = await aprovar(codigo, equipes.Beta!.supervisor);
      assert.equal(repetida.status, 409);
      assert.equal(repetida.corpo.erro.codigo, "ja_decidiu");
    });

    it("a recusa pede motivo, devolve o rascunho ao autor, avisa e abre uma nova rodada ao reenviar", async () => {
      const codigo = await enviadoPorAlfa();
      assert.equal((await amb.req("POST", `/treinamentos/${codigo}/validacao/recusar`, { como: equipes.Beta!.supervisor, json: { motivo: "  " } })).status, 422);
      const recusada = await recusar(codigo, equipes.Beta!.supervisor, "A fase 2 está confusa");
      assert.deepEqual([recusada.status, recusada.corpo.devolvido], [200, true]);
      const aviso = await avisosDe(equipes.Alfa!.supervisor.id, "treinamento_devolvido");
      assert.match(aviso.at(-1)!.detalhe, /A fase 2 está confusa/);

      const v = (await validacao(codigo, equipes.Alfa!.supervisor)).corpo;
      assert.deepEqual([v.em_validacao, v.pode_enviar, v.aprovacoes], [false, true, 0]);
      assert.deepEqual(v.historico.map((h: { rodada: number; resultado: string; motivo: string; por_nome: string }) => [h.rodada, h.resultado, h.motivo, h.por_nome]), [[1, "recusada", "A fase 2 está confusa", "Sup Beta"]]);
      // O autor edita de novo e reenvia: rodada 2, com assinaturas zeradas.
      assert.equal((await salvar(codigo, equipes.Alfa!.supervisor, 4)).status, 200);
      const reenviado = await enviar(codigo, equipes.Alfa!.supervisor);
      assert.deepEqual([reenviado.status, reenviado.corpo.rodada, reenviado.corpo.aprovacoes], [200, 2, 0]);
      assert.equal(reenviado.corpo.historico.length, 1);
    });

    it("com 2 validadores possíveis, assinam os 2", async () => {
      const codigo = `V.dois.${++contadorServicos}`;
      await amb.db.insert(atividade).values({ codigo, descricao: "Três equipes" });
      for (const nome of ["Alfa", "Beta", "Gama"]) await novaOs(equipes[nome]!.id, codigo);
      await rascunho(codigo, equipes.Alfa!.supervisor);
      await salvar(codigo, equipes.Alfa!.supervisor);
      const enviado = await enviar(codigo, equipes.Alfa!.supervisor);
      assert.deepEqual([enviado.corpo.validadores.length, enviado.corpo.necessarias], [2, 2]);
      assert.equal((await aprovar(codigo, equipes.Beta!.supervisor)).corpo.publicada, false);
      assert.equal((await aprovar(codigo, equipes.Gama!.supervisor)).corpo.publicada, true);
    });
  });

  describe("o rascunho enviado", () => {
    it("fica travado (salvar e IA recusam) até o autor retirar da validação", async () => {
      const codigo = await enviadoPorAlfa();
      const travado = await salvar(codigo, equipes.Alfa!.supervisor);
      assert.equal(travado.status, 409);
      assert.equal(travado.corpo.erro.codigo, "em_validacao");
      const ia = await amb.req("POST", `/treinamentos/${codigo}/rascunho/ajustar`, { como: equipes.Alfa!.supervisor, json: { pedido: "encurte" } });
      assert.ok([409, 503].includes(ia.status), `status ${ia.status}`);
      assert.equal((await enviar(codigo, equipes.Alfa!.supervisor)).status, 409, "já está em validação");
      assert.equal((await amb.req("POST", `/treinamentos/${codigo}/validacao/retirar`, { como: equipes.Beta!.supervisor })).status, 403);

      const retirado = await amb.req("POST", `/treinamentos/${codigo}/validacao/retirar`, { como: equipes.Alfa!.supervisor });
      assert.equal(retirado.status, 200);
      assert.equal(retirado.corpo.em_validacao, false);
      assert.equal((await salvar(codigo, equipes.Alfa!.supervisor)).status, 200);
      assert.equal((await aprovar(codigo, equipes.Beta!.supervisor)).status, 409, "a rodada retirada não vale mais");
    });

    it("o rascunho precisa estar pronto para publicar para ir à validação", async () => {
      const codigo = await novoServico();
      await rascunho(codigo, equipes.Alfa!.supervisor);
      await salvar(codigo, equipes.Alfa!.supervisor, 2);
      const r = await enviar(codigo, equipes.Alfa!.supervisor);
      assert.equal(r.status, 422, JSON.stringify(r.corpo));
    });

    it("o validador vê o conteúdo e testa o jogo; quem não é da validação não", async () => {
      const codigo = await enviadoPorAlfa();
      const v = (await validacao(codigo, equipes.Gama!.supervisor)).corpo;
      assert.equal(v.posso_decidir, true);
      assert.equal(v.rascunho.fases.length, 3);
      assert.equal((await amb.req("POST", `/treinamentos/${codigo}/rascunho/pre-visualizar/tentativas`, { como: equipes.Gama!.supervisor })).status, 201);
      assert.equal((await amb.req("POST", `/treinamentos/${codigo}/rascunho/pre-visualizar/tentativas`, { como: equipes.Gama!.tecnico })).status, 403);
      const lista = await amb.esperar(200, "GET", "/treinamentos/para-validar", { como: equipes.Delta!.supervisor });
      assert.ok(lista.treinamentos.some((t: { codigo: string; necessarias: number }) => t.codigo === codigo && t.necessarias === 2));
      assert.deepEqual((await amb.esperar(200, "GET", "/treinamentos/para-validar", { como: equipes.Alfa!.supervisor })).treinamentos.filter((t: { codigo: string }) => t.codigo === codigo), []);
      await aprovar(codigo, equipes.Delta!.supervisor);
      assert.deepEqual((await amb.esperar(200, "GET", "/treinamentos/para-validar", { como: equipes.Delta!.supervisor })).treinamentos.filter((t: { codigo: string }) => t.codigo === codigo), []);
    });
  });

  describe("a publicação direta do admin", () => {
    it("com a validação possível exige a justificativa, que fica na versão e na auditoria", async () => {
      const codigo = await novoServico();
      await rascunho(codigo, admin);
      await salvar(codigo, admin);
      const sem = await amb.req("POST", `/treinamentos/${codigo}/publicar`, { como: admin, json: { arquivo_id: await assinatura() } });
      assert.equal(sem.status, 422);
      assert.equal(sem.corpo.erro.codigo, "justificativa_obrigatoria");
      const com = await amb.req("POST", `/treinamentos/${codigo}/publicar`, { como: admin, json: { arquivo_id: await assinatura(), justificativa: "Urgência: auditoria amanhã" } });
      assert.equal(com.status, 200, JSON.stringify(com.corpo));
      assert.equal((await versaoDe(codigo, "publicada"))!.publicacaoDiretaJustificativa, "Urgência: auditoria amanhã");
      const [registro] = await amb.db.select().from(auditoria).where(and(eq(auditoria.entidadeId, codigo), eq(auditoria.acao, "treinamento.publicar")));
      assert.deepEqual((registro!.detalhes as { publicacao_direta: boolean; justificativa: string }).justificativa, "Urgência: auditoria amanhã");
      const { versoes } = await amb.esperar(200, "GET", `/treinamentos/${codigo}/versoes`, { como: admin });
      assert.deepEqual([versoes[0].via, versoes[0].justificativa], ["direta", "Urgência: auditoria amanhã"]);
    });

    it("publicar direto um treinamento em validação também exige a justificativa e encerra a validação", async () => {
      const codigo = await enviadoPorAlfa();
      assert.equal((await amb.req("POST", `/treinamentos/${codigo}/publicar`, { como: admin, json: { arquivo_id: await assinatura() } })).status, 422);
      assert.equal((await amb.req("POST", `/treinamentos/${codigo}/publicar`, { como: admin, json: { arquivo_id: await assinatura(), justificativa: "Prazo" } })).status, 200);
      assert.equal((await versaoDe(codigo, "rascunho")), undefined);
    });

    it("só o admin publica direto", async () => {
      const codigo = await novoServico();
      await rascunho(codigo, equipes.Alfa!.supervisor);
      await salvar(codigo, equipes.Alfa!.supervisor);
      assert.equal((await amb.req("POST", `/treinamentos/${codigo}/publicar`, { como: equipes.Alfa!.supervisor, json: { arquivo_id: await assinatura(), justificativa: "x" } })).status, 403);
    });
  });

  it("as validações ficam registradas: quem decidiu, quando e com que assinatura", async () => {
    const codigo = await enviadoPorAlfa();
    await aprovar(codigo, equipes.Beta!.supervisor);
    await recusar(codigo, equipes.Gama!.supervisor, "Falta uma fase");
    const [t] = await amb.db.select().from(treinamentoServico).where(eq(treinamentoServico.atividadeCodigo, codigo));
    const [versao] = await amb.db.select().from(treinamentoServicoVersao).where(eq(treinamentoServicoVersao.treinamentoId, t!.id));
    const vagas = await amb.db.select().from(treinamentoServicoValidador).where(eq(treinamentoServicoValidador.versaoId, versao!.id));
    const beta = vagas.find((v) => v.equipeId === equipes.Beta!.id)!;
    assert.deepEqual([beta.decisao, beta.usuarioId], ["aprovou", equipes.Beta!.supervisor.id]);
    assert.equal(beta.assinaturaPath, await amb.assinaturaDe(equipes.Beta!.supervisor));
    assert.equal(vagas.find((v) => v.equipeId === equipes.Gama!.id)!.motivo, "Falta uma fase");
  });
});
