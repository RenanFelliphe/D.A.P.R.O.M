import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

describe("Auditoria e ajustes do painel do admin", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let supervisor: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;
  let equipeId: string;
  /** Centro de trabalho da equipe: o funcionário do registro precisa ser desse setor para o supervisor cadastrá-lo. */
  let centro: string;

  const trilha = async (consulta: Record<string, string | number> = {}) => (await amb.esperar(200, "GET", "/auditoria", { como: admin, consulta })).registros as any[];

  before(async () => {
    amb = await criarAmbiente();
    const equipe = await amb.criarEquipe({ nome: "Elétrica" });
    equipeId = equipe.id;
    centro = equipe.centroTrabalho;
    admin = await amb.criarUsuario({ perfil: "admin", nome: "Ana Admin" });
    supervisor = await amb.criarUsuario({ perfil: "tecnico", equipeId, supervisor: true, nome: "Sandra Supervisora" });
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId });
  });
  after(() => amb.fechar());

  describe("GET /auditoria", () => {
    it("é só do admin", async () => {
      assert.equal((await amb.req("GET", "/auditoria")).status, 401);
      assert.equal((await amb.req("GET", "/auditoria", { como: tecnico })).status, 403);
      assert.equal((await amb.req("GET", "/auditoria", { como: supervisor })).status, 403);
      await amb.esperar(200, "GET", "/auditoria", { como: admin });
    });

    it("registra cadastro, edição, desativação e redefinição de senha de usuário, com quem fez", async () => {
      amb.registrarFuncionario({ matricula: "A100", nome: "Maria Souza", email: "maria.souza@empresa.com.br" });
      const { id } = await amb.esperar(201, "POST", "/usuarios", {
        como: admin,
        json: { matricula: "A100", email: "maria.souza@empresa.com.br", perfil: "tecnico", equipe_id: equipeId, senha_inicial: "senha-inicial-1" },
      });
      await amb.esperar(200, "PATCH", `/usuarios/${id}`, { como: admin, json: { equipe_id: null } });
      await amb.esperar(200, "PATCH", `/usuarios/${id}`, { como: admin, json: { ativo: false } });
      await amb.esperar(200, "POST", `/usuarios/${id}/redefinir-senha`, { como: admin });

      const registros = (await trilha({ entidade: "usuario", entidade_id: id })).reverse();
      assert.deepEqual(
        registros.map((r) => r.acao),
        ["usuario.criar", "usuario.editar", "usuario.desativar", "usuario.redefinir_senha"],
      );
      assert.ok(registros.every((r) => r.ator_id === admin.id && r.ator_nome === "Ana Admin" && r.alvo === "Maria Souza"));
      assert.deepEqual(registros[1].detalhes, { equipe_id: { de: equipeId, para: null } });
      assert.match(registros[2].resumo, /Desativou o usuário Maria Souza/);
      assert.ok(!JSON.stringify(registros).includes("senha-inicial-1"), "a senha nunca vai para a trilha");
    });

    it("editar sem mudar nada não gera registro", async () => {
      const antes = (await trilha()).length;
      await amb.esperar(200, "PATCH", `/usuarios/${tecnico.id}`, { como: admin, json: { perfil: "tecnico", equipe_id: equipeId } });
      assert.equal((await trilha()).length, antes);
    });

    it("o cadastro pelo supervisor e a liberação e a recusa pelo admin também ficam registrados", async () => {
      const dois = async (n: number) => {
        amb.registrarFuncionario({ matricula: `N${n}`, nome: `Novato ${n}`, email: `novato${n}@empresa.com.br`, centro_trabalho: centro });
        return (
          await amb.esperar(201, "POST", "/usuarios", {
            como: supervisor,
            json: { matricula: `N${n}`, email: `novato${n}@empresa.com.br`, senha_inicial: "senha-inicial-1" },
          })
        ).id as string;
      };
      const liberado = await dois(1);
      const recusado = await dois(2);
      await amb.esperar(200, "POST", `/usuarios/${liberado}/liberar`, { como: admin });
      await amb.esperar(200, "POST", `/usuarios/${recusado}/recusar`, { como: admin, json: { motivo: "Sem vaga" } });

      const criados = await trilha({ busca: "Novato" });
      const porAcao = (acao: string) => criados.filter((r) => r.acao === acao);
      assert.equal(porAcao("usuario.criar").length, 2);
      assert.ok(porAcao("usuario.criar").every((r) => r.ator_id === supervisor.id));
      assert.equal(porAcao("usuario.liberar")[0].ator_id, admin.id);
      assert.deepEqual(porAcao("usuario.recusar")[0].detalhes, { motivo: "Sem vaga" });
    });

    it("registra equipe, atividade e modelo de APR", async () => {
      const { id } = await amb.esperar(201, "POST", "/equipes", { como: admin, json: { nome: "Mecânica", centro_trabalho: "MEC_1" } });
      await amb.esperar(200, "PATCH", `/equipes/${id}`, { como: admin, json: { nome: "Mecânica Pesada", supervisor_id: supervisor.id } });
      await amb.esperar(200, "PUT", "/atividades/8.7.1", { como: admin, json: { descricao: "Inspeção" } });
      await amb.esperar(200, "PUT", "/atividades/8.7.1", { como: admin, json: { descricao: "Inspeção geral" } });
      await amb.esperar(200, "PUT", "/atividades/8.7.1", { como: admin, json: { descricao: "Inspeção geral" } });

      const equipes = await trilha({ entidade: "equipe", entidade_id: id });
      assert.deepEqual(equipes.map((r) => r.acao).reverse(), ["equipe.criar", "equipe.editar"]);
      assert.deepEqual(equipes[0].detalhes.nome, { de: "Mecânica", para: "Mecânica Pesada" });

      const atividades = await trilha({ entidade: "atividade" });
      assert.deepEqual(atividades.map((r) => r.acao).reverse(), ["atividade.criar", "atividade.editar"], "salvar igual não registra");
    });

    it("filtra por tipo, por texto sem diferenciar acento e por período, e pagina", async () => {
      assert.ok((await trilha({ busca: "mecanica" })).length >= 2);
      assert.ok((await trilha({ entidade: "equipe" })).every((r) => r.entidade === "equipe"));
      assert.equal((await trilha({ entidade: "exportacao" })).length, 0);

      const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      assert.ok((await trilha({ de: hoje, ate: hoje })).length > 0);
      assert.equal((await trilha({ ate: "2000-01-01" })).length, 0);
      assert.equal((await amb.req("GET", "/auditoria", { como: admin, consulta: { de: "ontem" } })).status, 422);
      assert.equal((await amb.req("GET", "/auditoria", { como: admin, consulta: { entidade: "outra" } })).status, 422);

      const pagina = await amb.esperar(200, "GET", "/auditoria", { como: admin, consulta: { tamanho: 2, pagina: 2 } });
      assert.equal(pagina.registros.length, 2);
      assert.ok(pagina.total > 2);
      assert.ok(pagina.registros[0].em <= (await trilha({ tamanho: 2 }))[1].em, "do mais novo ao mais antigo");
    });

    it("a trilha só cresce: o banco recusa alterar ou apagar um registro", async () => {
      await assert.rejects(() => amb.sql("update auditoria set resumo = 'adulterado'"), /não aceita alterar nem apagar/);
      await assert.rejects(() => amb.sql("delete from auditoria"), /não aceita alterar nem apagar/);
    });

    it("sobrevive à remoção da conta de quem agiu e do alvo", async () => {
      amb.registrarFuncionario({ matricula: "T1", nome: "Temporário", email: "temporario@empresa.com.br" });
      const { id } = await amb.esperar(201, "POST", "/usuarios", {
        como: admin,
        json: { matricula: "T1", email: "temporario@empresa.com.br", perfil: "tecnico", senha_inicial: "senha-inicial-1" },
      });
      await amb.esperar(200, "DELETE", `/usuarios/${id}`, { como: admin });
      const registros = await trilha({ entidade_id: id });
      assert.deepEqual(registros.map((r) => r.acao).reverse(), ["usuario.criar", "usuario.excluir"]);
      assert.equal(registros[0].alvo, "Temporário");
    });
  });

  describe("POST /auth/sair", () => {
    it("derruba o refresh_token: depois de sair, a sessão não se renova mais", async () => {
      const login = await amb.esperar(200, "POST", "/auth/login", { json: { email: tecnico.email, senha: tecnico.senha } });
      await amb.esperar(200, "POST", "/auth/sair", { cabecalhos: { Authorization: `Bearer ${login.access_token}` } });
      assert.equal((await amb.req("POST", "/auth/refresh", { json: { refresh_token: login.refresh_token } })).status, 401);
      // entrar de novo continua possível
      await amb.esperar(200, "POST", "/auth/login", { json: { email: tecnico.email, senha: tecnico.senha } });
    });

    it("exige sessão e vale também para conta desativada", async () => {
      assert.equal((await amb.req("POST", "/auth/sair")).status, 401);
      const inativo = await amb.criarUsuario({ perfil: "tecnico", equipeId, ativo: false });
      await amb.esperar(200, "POST", "/auth/sair", { como: inativo });
    });
  });

  describe("GET /alertas?tipo=", () => {
    it("filtra por tipo na api e recusa tipo desconhecido", async () => {
      const r = await amb.esperar(200, "GET", "/alertas", { como: admin, consulta: { tipo: "falha_importacao" } });
      assert.deepEqual(r.alertas, []);
      assert.equal(r.total, 0);
      assert.equal((await amb.req("GET", "/alertas", { como: admin, consulta: { tipo: "inventado" } })).status, 422);
    });
  });

  describe("GET /usuarios?minha_supervisao=true", () => {
    it("lista os técnicos das equipes do supervisor em qualquer situação, menos ele, e pagina na api", async () => {
      const outraEquipe = (await amb.criarEquipe()).id;
      const alheio = await amb.criarUsuario({ perfil: "tecnico", equipeId: outraEquipe });
      const inativo = await amb.criarUsuario({ perfil: "tecnico", equipeId, ativo: false });
      amb.registrarFuncionario({ matricula: "P1", nome: "Pendente Um", email: "pendente.um@empresa.com.br", centro_trabalho: centro });
      await amb.esperar(201, "POST", "/usuarios", {
        como: supervisor,
        json: { matricula: "P1", email: "pendente.um@empresa.com.br", senha_inicial: "senha-inicial-1" },
      });

      const todos = await amb.esperar(200, "GET", "/usuarios", { como: supervisor, consulta: { minha_supervisao: true, perfil: "tecnico", tamanho: 200 } });
      const ids = todos.usuarios.map((u: any) => u.id);
      assert.ok(!ids.includes(supervisor.id), "o próprio supervisor fica de fora");
      assert.ok(!ids.includes(alheio.id), "técnico de outra equipe fica de fora");
      assert.ok(!ids.includes(inativo.id), "liberado e inativo fica de fora, como na lista de colegas");
      assert.ok(ids.includes(tecnico.id));
      assert.ok(todos.usuarios.some((u: any) => u.liberacao === "pendente"));
      assert.ok(todos.usuarios.some((u: any) => u.liberacao === "recusado"));

      const pendentes = await amb.esperar(200, "GET", "/usuarios", { como: supervisor, consulta: { minha_supervisao: true, liberacao: "pendente", tamanho: 1 } });
      assert.ok(pendentes.total >= 1);
      assert.ok(pendentes.usuarios.every((u: any) => u.liberacao === "pendente"));

      const segunda = await amb.esperar(200, "GET", "/usuarios", { como: supervisor, consulta: { minha_supervisao: true, tamanho: 1, pagina: 2 } });
      assert.equal(segunda.usuarios.length, 1);
      assert.equal(segunda.total, todos.total);
    });

    it("sem equipe supervisionada não traz ninguém", async () => {
      const r = await amb.esperar(200, "GET", "/usuarios", { como: tecnico, consulta: { minha_supervisao: true } });
      assert.equal(r.total, 0);
    });
  });

  describe("exclusão de equipe e de atividade", () => {
    it("exclui a equipe vazia e registra; com usuário ligado, 409", async () => {
      const vazia = (await amb.esperar(201, "POST", "/equipes", { como: admin, json: { nome: "Sobrando", centro_trabalho: "SOBRA" } })).id;
      assert.equal((await amb.req("DELETE", `/equipes/${vazia}`, { como: supervisor })).status, 403);
      await amb.esperar(200, "DELETE", `/equipes/${vazia}`, { como: admin });
      assert.equal((await amb.req("DELETE", `/equipes/${vazia}`, { como: admin })).status, 404);
      assert.ok((await trilha({ entidade_id: vazia })).some((r) => r.acao === "equipe.excluir"));

      const ocupada = await amb.req("DELETE", `/equipes/${equipeId}`, { como: admin });
      assert.equal(ocupada.status, 409);
      assert.equal(ocupada.corpo.erro.codigo, "equipe_com_historico");
    });

    it("exclui a atividade que nenhuma OS usa; só o admin; inexistente é 404", async () => {
      await amb.esperar(200, "PUT", "/atividades/9.9.9", { como: admin, json: { descricao: "Temporária" } });
      assert.equal((await amb.req("DELETE", "/atividades/9.9.9", { como: tecnico })).status, 403);
      await amb.esperar(200, "DELETE", "/atividades/9.9.9", { como: admin });
      assert.equal((await amb.req("DELETE", "/atividades/9.9.9", { como: admin })).status, 404);
      assert.ok((await trilha({ entidade: "atividade", entidade_id: "9.9.9" })).some((r) => r.acao === "atividade.excluir"));
    });
  });
});
