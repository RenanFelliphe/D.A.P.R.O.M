import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { agendarLeituraDiariaRh } from "../src/dominio/rh";
import { ESPERAS_MIN, executarTarefasPendentes } from "../src/servicos/tarefas";
import { configDeTeste, criarAmbiente, SENHA_PADRAO, type Ambiente, type UsuarioDeTeste } from "./ajuda";

/** Meio-dia em São Paulo, bem depois da hora da leitura diária (3h). */
const MEIO_DIA = new Date("2026-10-14T15:00:00Z");

describe("Registro de funcionários: cadastro, desligamento e leitura diária", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let supervisor: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;
  let equipeId: string;
  let centro: string;

  const aviso = (matriculas: string[], token: string | null = configDeTeste.rhAvisoToken) =>
    amb.req("POST", "/rh/avisos", { cabecalhos: token === null ? {} : { Authorization: `Bearer ${token}` }, json: { matriculas } });
  const usuarioNoBanco = async (id: string) => (await amb.sql<any>("select * from usuario where id = $1", [id]))[0];
  const trilha = async (consulta: Record<string, string | number> = {}) => (await amb.esperar(200, "GET", "/auditoria", { como: admin, consulta })).registros as any[];

  /** Um técnico com conta e o seu funcionário no registro (mesma matrícula e e-mail). */
  async function pessoa(opcoes: Parameters<Ambiente["criarUsuario"]>[0] = { perfil: "tecnico", equipeId }) {
    const u = await amb.criarUsuario(opcoes);
    amb.registrarFuncionario({ matricula: u.matricula, centro_trabalho: centro });
    return u;
  }

  before(async () => {
    amb = await criarAmbiente({ relogio: MEIO_DIA });
    const equipe = await amb.criarEquipe({ nome: "Elétrica", centroTrabalho: "ELE_1" });
    equipeId = equipe.id;
    centro = equipe.centroTrabalho;
    admin = await amb.criarUsuario({ perfil: "admin", nome: "Ana Admin" });
    supervisor = await amb.criarUsuario({ perfil: "tecnico", equipeId, supervisor: true, nome: "Sandra Supervisora" });
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId });
  });
  after(() => amb.fechar());

  describe("GET /rh/funcionarios/{matricula}?email= (prévia do cadastro)", () => {
    it("admin e supervisor veem nome, cargo, setor, CREA, situação, a equipe sugerida e se já tem conta; técnico não", async () => {
      amb.registrarFuncionario({ matricula: "P100", nome: "Paulo Prévia", email: "paulo.previa@empresa.com.br", cargo: "Engenheiro Mecânico", registro_profissional: "CREA ES-050003/D", centro_trabalho: centro, setor: "Elétrica" });
      for (const como of [admin, supervisor]) {
        const r = await amb.esperar(200, "GET", "/rh/funcionarios/P100", { como, consulta: { email: "Paulo.Previa@empresa.com.br" } });
        assert.deepEqual(r.funcionario, { matricula: "P100", nome: "Paulo Prévia", cargo: "Engenheiro Mecânico", centro_trabalho: centro, setor: "Elétrica", registro_profissional: "CREA ES-050003/D", situacao: "ativo" });
        assert.deepEqual(r.equipe_sugerida, { id: equipeId, nome: "Elétrica" });
        assert.equal(r.conta_existente, false);
      }
      assert.equal((await amb.req("GET", "/rh/funcionarios/P100", { como: tecnico, consulta: { email: "paulo.previa@empresa.com.br" } })).status, 403);
      assert.equal((await amb.req("GET", "/rh/funcionarios/P100", { consulta: { email: "paulo.previa@empresa.com.br" } })).status, 401);
    });

    it("diz quando a pessoa já tem conta", async () => {
      const u = await pessoa();
      const r = await amb.esperar(200, "GET", `/rh/funcionarios/${u.matricula}`, { como: admin, consulta: { email: u.email } });
      assert.equal(r.conta_existente, true);
    });

    it("matrícula fora do registro é 404; e-mail errado é 422 sem revelar o certo; afastado e desligado são 409; sem e-mail é 422", async () => {
      const fora = await amb.req("GET", "/rh/funcionarios/NAO_EXISTE", { como: admin, consulta: { email: "x@empresa.com.br" } });
      assert.equal(fora.status, 404);
      assert.equal(fora.corpo.erro.codigo, "funcionario_nao_encontrado");

      amb.registrarFuncionario({ matricula: "P101", email: "certo@empresa.com.br" });
      const errado = await amb.req("GET", "/rh/funcionarios/P101", { como: admin, consulta: { email: "errado@empresa.com.br" } });
      assert.equal(errado.status, 422);
      assert.equal(errado.corpo.erro.codigo, "email_nao_confere");
      assert.ok(!JSON.stringify(errado.corpo).includes("certo@empresa.com.br"), "a mensagem não revela o e-mail da matrícula");

      amb.registrarFuncionario({ matricula: "P102", situacao: "afastado" });
      amb.registrarFuncionario({ matricula: "P103", situacao: "desligado" });
      const afastado = await amb.req("GET", "/rh/funcionarios/P102", { como: admin, consulta: { email: "p102@empresa.com.br" } });
      assert.equal(afastado.status, 409);
      assert.equal(afastado.corpo.erro.codigo, "funcionario_afastado");
      const desligado = await amb.req("GET", "/rh/funcionarios/P103", { como: admin, consulta: { email: "p103@empresa.com.br" } });
      assert.equal(desligado.status, 409);
      assert.equal(desligado.corpo.erro.codigo, "funcionario_desligado");

      assert.equal((await amb.req("GET", "/rh/funcionarios/P101", { como: admin })).status, 422);
    });

    it("o supervisor só vê quem é de um setor cuja equipe ele supervisiona (403 fora_da_supervisao)", async () => {
      amb.registrarFuncionario({ matricula: "P104", centro_trabalho: "OUTRO_SETOR", setor: "Outro Setor" });
      const r = await amb.req("GET", "/rh/funcionarios/P104", { como: supervisor, consulta: { email: "p104@empresa.com.br" } });
      assert.equal(r.status, 403);
      assert.equal(r.corpo.erro.codigo, "fora_da_supervisao");
      assert.equal(r.corpo.erro.mensagem, "Este funcionário é do setor Outro Setor, que você não supervisiona");
      // o admin vê, sem equipe sugerida
      const doAdmin = await amb.esperar(200, "GET", "/rh/funcionarios/P104", { como: admin, consulta: { email: "p104@empresa.com.br" } });
      assert.equal(doAdmin.equipe_sugerida, null);
    });

    it("registro fora do ar é 503 registro_indisponivel", async () => {
      amb.rh.falhar = true;
      try {
        const r = await amb.req("GET", "/rh/funcionarios/P100", { como: admin, consulta: { email: "paulo.previa@empresa.com.br" } });
        assert.equal(r.status, 503);
        assert.equal(r.corpo.erro.codigo, "registro_indisponivel");
      } finally {
        amb.rh.falhar = false;
      }
    });
  });

  describe("POST /usuarios (cadastro a partir do registro)", () => {
    const corpo = (matricula: string, extra: Record<string, unknown> = {}) => ({ matricula, email: `${matricula.toLowerCase()}@empresa.com.br`, senha_inicial: "senha-inicial-1", ...extra });

    it("consulta o registro de novo e grava os dados da consulta de agora, não os da prévia", async () => {
      amb.registrarFuncionario({ matricula: "C100", nome: "Nome da Prévia", cargo: "Eletricista", centro_trabalho: centro });
      await amb.esperar(200, "GET", "/rh/funcionarios/C100", { como: admin, consulta: { email: "c100@empresa.com.br" } });
      amb.registrarFuncionario({ matricula: "C100", nome: "Nome Depois da Prévia", cargo: "Mecânico", centro_trabalho: centro, registro_profissional: "CREA 9" });
      const antes = amb.rh.consultas;
      const { id } = await amb.esperar(201, "POST", "/usuarios", { como: admin, json: corpo("C100", { perfil: "tecnico" }) });
      assert.equal(amb.rh.consultas, antes + 1, "o POST consulta o registro");
      const u = await usuarioNoBanco(id);
      assert.equal(u.nome, "Nome Depois da Prévia");
      assert.equal(u.cargo, "Mecânico");
      assert.equal(u.registro_profissional, "CREA 9");
      assert.equal(u.situacao_registro, "ativo");
      assert.ok(u.registro_conferido_em);
      assert.equal(u.liberacao, "liberado");
    });

    it("sem equipe_id, o admin cadastra na equipe do setor; com null, sem equipe; com outra, na outra", async () => {
      amb.registrarFuncionario({ matricula: "C101", centro_trabalho: centro });
      const { id } = await amb.esperar(201, "POST", "/usuarios", { como: admin, json: corpo("C101", { perfil: "tecnico" }) });
      assert.equal((await usuarioNoBanco(id)).equipe_id, equipeId);

      amb.registrarFuncionario({ matricula: "C102", centro_trabalho: centro });
      const semEquipe = await amb.esperar(201, "POST", "/usuarios", { como: admin, json: corpo("C102", { perfil: "tecnico", equipe_id: null }) });
      assert.equal((await usuarioNoBanco(semEquipe.id)).equipe_id, null);

      const outra = (await amb.criarEquipe()).id;
      amb.registrarFuncionario({ matricula: "C103", centro_trabalho: centro });
      const naOutra = await amb.esperar(201, "POST", "/usuarios", { como: admin, json: corpo("C103", { perfil: "tecnico", equipe_id: outra }) });
      assert.equal((await usuarioNoBanco(naOutra.id)).equipe_id, outra);

      amb.registrarFuncionario({ matricula: "C104", centro_trabalho: "SEM_EQUIPE_ALGUMA" });
      const semSetor = await amb.esperar(201, "POST", "/usuarios", { como: admin, json: corpo("C104", { perfil: "tecnico" }) });
      assert.equal((await usuarioNoBanco(semSetor.id)).equipe_id, null);
    });

    it("ignora nome, cargo e CREA do corpo: o que vale é o registro", async () => {
      amb.registrarFuncionario({ matricula: "C105", nome: "Do Registro", cargo: "Eletricista", centro_trabalho: centro });
      const { id } = await amb.esperar(201, "POST", "/usuarios", { como: admin, json: corpo("C105", { perfil: "tecnico", nome: "Digitado", cargo: "Digitado", registro_profissional: "Digitado" }) });
      const u = await usuarioNoBanco(id);
      assert.equal(u.nome, "Do Registro");
      assert.equal(u.cargo, "Eletricista");
      assert.equal(u.registro_profissional, null);
    });

    it("cada recusa do registro: 404, 422, 409 (afastado e desligado), 409 (já tem conta) e 503", async () => {
      assert.equal((await amb.req("POST", "/usuarios", { como: admin, json: corpo("NAO_EXISTE", { perfil: "tecnico" }) })).corpo.erro.codigo, "funcionario_nao_encontrado");

      amb.registrarFuncionario({ matricula: "C110", email: "certo.c110@empresa.com.br" });
      const errado = await amb.req("POST", "/usuarios", { como: admin, json: corpo("C110", { perfil: "tecnico", email: "errado@empresa.com.br" }) });
      assert.equal(errado.status, 422);
      assert.equal(errado.corpo.erro.codigo, "email_nao_confere");

      amb.registrarFuncionario({ matricula: "C111", situacao: "afastado" });
      amb.registrarFuncionario({ matricula: "C112", situacao: "desligado" });
      assert.equal((await amb.req("POST", "/usuarios", { como: admin, json: corpo("C111", { perfil: "tecnico" }) })).corpo.erro.codigo, "funcionario_afastado");
      assert.equal((await amb.req("POST", "/usuarios", { como: admin, json: corpo("C112", { perfil: "tecnico" }) })).corpo.erro.codigo, "funcionario_desligado");

      const u = await pessoa();
      const dup = await amb.req("POST", "/usuarios", { como: admin, json: { matricula: u.matricula, email: u.email, perfil: "tecnico", senha_inicial: "senha-inicial-1" } });
      assert.equal(dup.status, 409);
      assert.equal(dup.corpo.erro.codigo, "matricula_duplicada");

      amb.registrarFuncionario({ matricula: "C113", centro_trabalho: centro });
      amb.rh.falhar = true;
      try {
        const fora = await amb.req("POST", "/usuarios", { como: admin, json: corpo("C113", { perfil: "tecnico" }) });
        assert.equal(fora.status, 503);
        assert.equal(fora.corpo.erro.codigo, "registro_indisponivel");
      } finally {
        amb.rh.falhar = false;
      }
      assert.deepEqual(await amb.sql("select 1 from usuario where matricula = 'C113'"), [], "o cadastro para: nada foi criado");
    });

    it("o supervisor cadastra só técnico de um setor cuja equipe ele supervisiona, na equipe do setor, e a conta nasce pendente", async () => {
      amb.registrarFuncionario({ matricula: "C120", centro_trabalho: centro });
      const { id } = await amb.esperar(201, "POST", "/usuarios", { como: supervisor, json: corpo("C120") });
      const u = await usuarioNoBanco(id);
      assert.equal(u.liberacao, "pendente");
      assert.equal(u.equipe_id, equipeId);
      assert.equal(u.perfil, "tecnico");

      amb.registrarFuncionario({ matricula: "C121", centro_trabalho: "OUTRO_SETOR", setor: "Outro Setor" });
      const r = await amb.req("POST", "/usuarios", { como: supervisor, json: corpo("C121") });
      assert.equal(r.status, 403);
      assert.equal(r.corpo.erro.codigo, "fora_da_supervisao");
      assert.deepEqual(await amb.sql("select 1 from usuario where matricula = 'C121'"), []);

      // Mesmo informando a equipe de outro, a equipe é a do setor.
      const outra = (await amb.criarEquipe()).id;
      amb.registrarFuncionario({ matricula: "C122", centro_trabalho: centro });
      const comOutra = await amb.esperar(201, "POST", "/usuarios", { como: supervisor, json: corpo("C122", { equipe_id: outra }) });
      assert.equal((await usuarioNoBanco(comOutra.id)).equipe_id, equipeId);
    });
  });

  describe("PATCH /usuarios/{id}: reativar consulta o registro", () => {
    it("desligado, fora do registro e afastado: 409; ativo: reativa e grava a situação", async () => {
      const u = await pessoa();
      await amb.esperar(200, "PATCH", `/usuarios/${u.id}`, { como: admin, json: { ativo: false } });

      amb.registrarFuncionario({ matricula: u.matricula, situacao: "desligado" });
      const desligado = await amb.req("PATCH", `/usuarios/${u.id}`, { como: admin, json: { ativo: true } });
      assert.equal(desligado.status, 409);
      assert.equal(desligado.corpo.erro.codigo, "funcionario_desligado");

      amb.registrarFuncionario({ matricula: u.matricula, situacao: "afastado" });
      assert.equal((await amb.req("PATCH", `/usuarios/${u.id}`, { como: admin, json: { ativo: true } })).corpo.erro.codigo, "funcionario_afastado");

      amb.rh.funcionarios.delete(u.matricula);
      assert.equal((await amb.req("PATCH", `/usuarios/${u.id}`, { como: admin, json: { ativo: true } })).corpo.erro.codigo, "funcionario_desligado");

      amb.rh.falhar = true;
      assert.equal((await amb.req("PATCH", `/usuarios/${u.id}`, { como: admin, json: { ativo: true } })).status, 503);
      amb.rh.falhar = false;
      assert.equal((await usuarioNoBanco(u.id)).ativo, false, "nada mudou");

      amb.registrarFuncionario({ matricula: u.matricula, centro_trabalho: centro });
      await amb.esperar(200, "PATCH", `/usuarios/${u.id}`, { como: admin, json: { ativo: true } });
      const depois = await usuarioNoBanco(u.id);
      assert.equal(depois.ativo, true);
      assert.equal(depois.situacao_registro, "ativo");
      await amb.esperar(200, "GET", "/equipes", { como: u });
    });

    it("desativar não consulta o registro", async () => {
      const u = await amb.criarUsuario({ perfil: "tecnico", equipeId }); // nem está no registro
      amb.rh.falhar = true;
      try {
        await amb.esperar(200, "PATCH", `/usuarios/${u.id}`, { como: admin, json: { ativo: false } });
      } finally {
        amb.rh.falhar = false;
      }
    });
  });

  describe("POST /rh/avisos e a conferência", () => {
    it("só o registro, com o token dele, avisa (401 sem token ou com outro token, inclusive o da API)", async () => {
      assert.equal((await aviso(["X"], null)).status, 401);
      assert.equal((await aviso(["X"], "token-errado")).status, 401);
      assert.equal((await aviso(["X"], configDeTeste.rhApiToken)).status, 401);
      assert.equal((await amb.req("POST", "/rh/avisos", { como: admin, json: { matriculas: ["X"] } })).status, 401, "nem o token de um admin");
      assert.equal((await aviso([])).status, 422);
    });

    it("responde 202 e enfileira uma conferência por matrícula que tem conta; matrícula sem conta é ignorada; não repete a que já espera", async () => {
      const a = await pessoa();
      const b = await pessoa();
      const antes = (await amb.sql<{ n: number }>("select count(*)::int n from tarefa where tipo = 'conferencia_rh'"))[0]!.n;
      const r = await aviso([a.matricula, a.matricula.toLowerCase(), b.matricula, "SEM_CONTA"]);
      assert.equal(r.status, 202);
      assert.equal(r.corpo.enfileiradas, 2);
      const tarefas = await amb.sql<{ referencia_id: string }>("select referencia_id from tarefa where tipo = 'conferencia_rh' and estado = 'pendente' order by criada_em");
      assert.ok(tarefas.some((t) => t.referencia_id === a.id) && tarefas.some((t) => t.referencia_id === b.id));
      assert.equal((await amb.sql<{ n: number }>("select count(*)::int n from tarefa where tipo = 'conferencia_rh'"))[0]!.n, antes + 2);
      assert.equal((await aviso([a.matricula])).corpo.enfileiradas, 0, "já há uma esperando");
      await executarTarefasPendentes(amb.deps);
    });

    it("desligado no registro: o aviso desativa a conta, e a api recusa a pessoa na hora (acesso_revogado)", async () => {
      const u = await pessoa();
      await amb.esperar(200, "GET", "/equipes", { como: u });
      amb.registrarFuncionario({ matricula: u.matricula, situacao: "desligado", centro_trabalho: centro });
      await aviso([u.matricula]);
      await executarTarefasPendentes(amb.deps);

      const r = await amb.req("GET", "/equipes", { como: u });
      assert.equal(r.status, 401);
      assert.equal(r.corpo.erro.codigo, "acesso_revogado");
      const doBanco = await usuarioNoBanco(u.id);
      assert.equal(doBanco.ativo, false);
      assert.equal(doBanco.situacao_registro, "desligado");
      assert.ok(doBanco.registro_conferido_em);

      const [registro] = (await trilha({ entidade: "usuario", entidade_id: u.id })).filter((x) => x.acao === "usuario.desativar");
      assert.equal(registro.ator_id, null, "o ator é o sistema");
      assert.equal(registro.ator_nome, "Registro de funcionários");
      assert.match(registro.resumo, /Desativou o usuário/);
    });

    it("a conta pendente de um desligado vira recusada, com o motivo", async () => {
      amb.registrarFuncionario({ matricula: "A200", centro_trabalho: centro });
      const { id } = await amb.esperar(201, "POST", "/usuarios", { como: supervisor, json: { matricula: "A200", email: "a200@empresa.com.br", senha_inicial: "senha-inicial-1" } });
      amb.registrarFuncionario({ matricula: "A200", situacao: "desligado", centro_trabalho: centro });
      await aviso(["A200"]);
      await executarTarefasPendentes(amb.deps);
      const u = await usuarioNoBanco(id);
      assert.equal(u.liberacao, "recusado");
      assert.equal(u.ativo, false);
      assert.equal(u.recusa_motivo, "Desligado no registro de funcionários");
      const login = await amb.req("POST", "/auth/login", { json: { email: "a200@empresa.com.br", senha: "senha-inicial-1" } });
      assert.equal(login.status, 403, "quem foi recusado não entra");
      assert.equal(login.corpo.erro.codigo, "acesso_recusado");
      assert.match(login.corpo.erro.mensagem, /Desligado no registro de funcionários/);
    });

    it("um aviso falso não muda nada: o SYNC OS consulta o registro e age pelo que ele responde", async () => {
      const u = await pessoa();
      await aviso([u.matricula]); // o registro diz que a pessoa segue ativa
      await executarTarefasPendentes(amb.deps);
      const doBanco = await usuarioNoBanco(u.id);
      assert.equal(doBanco.ativo, true);
      assert.equal(doBanco.situacao_registro, "ativo");
      await amb.esperar(200, "GET", "/equipes", { como: u });
    });

    it("afastado só grava a situação; readmitido não reativa sozinho", async () => {
      const u = await pessoa();
      await aviso([u.matricula]); // primeira conferência: ativo
      await executarTarefasPendentes(amb.deps);
      amb.registrarFuncionario({ matricula: u.matricula, situacao: "afastado", centro_trabalho: centro });
      await aviso([u.matricula]);
      await executarTarefasPendentes(amb.deps);
      let doBanco = await usuarioNoBanco(u.id);
      assert.equal(doBanco.ativo, true);
      assert.equal(doBanco.situacao_registro, "afastado");
      assert.ok((await trilha({ entidade_id: u.id })).some((x) => x.acao === "usuario.situacao_registro"));

      // desliga, depois "readmite": a conta continua desativada até uma pessoa reativar.
      amb.registrarFuncionario({ matricula: u.matricula, situacao: "desligado", centro_trabalho: centro });
      await aviso([u.matricula]);
      await executarTarefasPendentes(amb.deps);
      amb.registrarFuncionario({ matricula: u.matricula, situacao: "ativo", centro_trabalho: centro });
      await aviso([u.matricula]);
      await executarTarefasPendentes(amb.deps);
      doBanco = await usuarioNoBanco(u.id);
      assert.equal(doBanco.ativo, false);
      assert.equal(doBanco.situacao_registro, "ativo");
    });

    it("nunca desativa o último administrador ativo: grava a situação e deixa a decisão para uma pessoa", async () => {
      const amb2 = await criarAmbiente({ relogio: MEIO_DIA });
      try {
        const unico = await amb2.criarUsuario({ perfil: "admin", nome: "Único Admin" });
        amb2.registrarFuncionario({ matricula: unico.matricula, situacao: "desligado" });
        await amb2.req("POST", "/rh/avisos", { cabecalhos: { Authorization: `Bearer ${configDeTeste.rhAvisoToken}` }, json: { matriculas: [unico.matricula] } });
        await executarTarefasPendentes(amb2.deps);
        const [u] = await amb2.sql<any>("select ativo, situacao_registro from usuario where id = $1", [unico.id]);
        assert.equal(u.ativo, true);
        assert.equal(u.situacao_registro, "desligado");
        const registros = (await amb2.esperar(200, "GET", "/auditoria", { como: unico, consulta: { entidade_id: unico.id } })).registros as any[];
        assert.ok(registros.some((x) => x.acao === "usuario.conferencia_bloqueada" && x.ator_id === null));
        assert.ok(!registros.some((x) => x.acao === "usuario.desativar"));

        // Com outro admin ativo, o desligado é desativado.
        const outro = await amb2.criarUsuario({ perfil: "admin" });
        amb2.registrarFuncionario({ matricula: outro.matricula });
        await amb2.req("POST", "/rh/avisos", { cabecalhos: { Authorization: `Bearer ${configDeTeste.rhAvisoToken}` }, json: { matriculas: [unico.matricula] } });
        await executarTarefasPendentes(amb2.deps);
        assert.equal((await amb2.sql<any>("select ativo from usuario where id = $1", [unico.id]))[0].ativo, false);
      } finally {
        await amb2.fechar();
      }
    });

    it("registro fora do ar: a tarefa tenta de novo depois de 1 minuto, e dá certo quando ele volta", async () => {
      const u = await pessoa();
      amb.registrarFuncionario({ matricula: u.matricula, situacao: "desligado", centro_trabalho: centro });
      await aviso([u.matricula]);
      amb.rh.falhar = true;
      await executarTarefasPendentes(amb.deps);
      amb.rh.falhar = false;
      const [t] = await amb.sql<any>("select estado, tentativas from tarefa where tipo = 'conferencia_rh' and referencia_id = $1", [u.id]);
      assert.equal(t.estado, "pendente");
      assert.equal(t.tentativas, 1);
      assert.equal((await usuarioNoBanco(u.id)).ativo, true, "nada mudou enquanto o registro estava fora");

      await executarTarefasPendentes(amb.deps);
      assert.equal((await usuarioNoBanco(u.id)).ativo, true, "ainda não venceu a espera");
      amb.relogio.agora = new Date(MEIO_DIA.getTime() + (ESPERAS_MIN[0] + 1) * 60_000);
      try {
        await executarTarefasPendentes(amb.deps);
      } finally {
        amb.relogio.agora = MEIO_DIA;
      }
      assert.equal((await usuarioNoBanco(u.id)).ativo, false);
    });

    it("equipe cujo supervisor foi desligado: os alertas passam a ir para os administradores", async () => {
      const { destinatariosDaEquipe } = await import("../src/dominio/alertas");
      const equipe = await amb.criarEquipe();
      const sup = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipe.id, supervisor: true });
      amb.registrarFuncionario({ matricula: sup.matricula, situacao: "desligado" });
      assert.deepEqual((await destinatariosDaEquipe(amb.db, equipe.id)).map((d) => d.id), [sup.id]);
      await aviso([sup.matricula]);
      await executarTarefasPendentes(amb.deps);
      const destinos = (await destinatariosDaEquipe(amb.db, equipe.id)).map((d) => d.id);
      assert.ok(!destinos.includes(sup.id));
      assert.ok(destinos.includes(admin.id));
    });
  });

  describe("leitura completa (diária e \"Ler agora\")", () => {
    const lerAgora = async () => {
      const { leitura_id } = await amb.esperar(202, "POST", "/rh/leituras", { como: admin });
      await executarTarefasPendentes(amb.deps);
      return (await amb.sql<any>("select * from leitura_rh where id = $1", [leitura_id]))[0];
    };

    it("só o admin pede; vira auditoria `rh.leitura`", async () => {
      assert.equal((await amb.req("POST", "/rh/leituras", { como: tecnico })).status, 403);
      assert.equal((await amb.req("POST", "/rh/leituras", { como: supervisor })).status, 403);
      assert.equal((await amb.req("POST", "/rh/leituras")).status, 401);
      const { leitura_id } = await amb.esperar(202, "POST", "/rh/leituras", { como: admin });
      const registros = await trilha({ entidade: "rh" });
      assert.ok(registros.some((x) => x.acao === "rh.leitura" && x.entidade_id === leitura_id && x.ator_id === admin.id));
      await executarTarefasPendentes(amb.deps);
    });

    it("atualiza os dados e o login de quem mudou, desativa o desligado e quem sumiu do registro, e conta tudo", async () => {
      const amb2 = await criarAmbiente({ relogio: MEIO_DIA });
      try {
        const eq = await amb2.criarEquipe();
        const adm = await amb2.criarUsuario({ perfil: "admin" });
        const mudou = await amb2.criarUsuario({ perfil: "tecnico", equipeId: eq.id });
        const desligado = await amb2.criarUsuario({ perfil: "tecnico", equipeId: eq.id });
        const sumiu = await amb2.criarUsuario({ perfil: "tecnico", equipeId: eq.id });
        const quieto = await amb2.criarUsuario({ perfil: "tecnico", equipeId: eq.id });
        const novoEmail = `${mudou.matricula.toLowerCase()}.novo@empresa.com.br`;
        for (const u of [adm, quieto]) amb2.registrarFuncionario({ matricula: u.matricula, nome: `Funcionário ${u.matricula}` });
        amb2.registrarFuncionario({ matricula: mudou.matricula, nome: "Nome Novo", email: novoEmail, cargo: "Engenheiro", registro_profissional: "CREA 1" });
        amb2.registrarFuncionario({ matricula: desligado.matricula, situacao: "desligado" });
        // `sumiu` nem está no registro

        const { leitura_id } = await amb2.esperar(202, "POST", "/rh/leituras", { como: adm });
        await executarTarefasPendentes(amb2.deps);
        const [l] = await amb2.sql<any>("select * from leitura_rh where id = $1", [leitura_id]);
        assert.equal(l.erro, null);
        assert.ok(l.concluida_em);
        assert.equal(l.conferidos, 5);
        assert.equal(l.desativados, 2);
        assert.ok(l.atualizados >= 1);

        const [u] = await amb2.sql<any>("select nome, email, cargo, registro_profissional, ativo, situacao_registro from usuario where id = $1", [mudou.id]);
        assert.deepEqual(u, { nome: "Nome Novo", email: novoEmail, cargo: "Engenheiro", registro_profissional: "CREA 1", ativo: true, situacao_registro: "ativo" });
        assert.equal((await amb2.req("POST", "/auth/login", { json: { email: mudou.email, senha: SENHA_PADRAO } })).status, 401);
        await amb2.esperar(200, "POST", "/auth/login", { json: { email: novoEmail, senha: SENHA_PADRAO } });

        assert.equal((await amb2.sql<any>("select ativo, situacao_registro from usuario where id = $1", [desligado.id]))[0].situacao_registro, "desligado");
        const [fora] = await amb2.sql<any>("select ativo, situacao_registro from usuario where id = $1", [sumiu.id]);
        assert.deepEqual(fora, { ativo: false, situacao_registro: "fora_do_registro" });
        assert.equal((await amb2.sql<any>("select ativo from usuario where id = $1", [quieto.id]))[0].ativo, true);

        const sinc = await amb2.esperar(200, "GET", "/rh/sincronizacao", { como: adm });
        assert.equal(sinc.ultima_leitura.id, leitura_id);
        assert.equal(sinc.ultima_leitura.situacao, "concluida");
        assert.equal(sinc.ultima_leitura.desativados, 2);
        assert.equal(sinc.configurado, true);
        assert.equal(sinc.leitura_hora, 3);
      } finally {
        await amb2.fechar();
      }
    });

    it("a trava de segurança: se desativaria mais da metade dos ativos, não aplica nada e termina com erro", async () => {
      const amb2 = await criarAmbiente({ relogio: MEIO_DIA });
      try {
        const eq = await amb2.criarEquipe();
        const adm = await amb2.criarUsuario({ perfil: "admin" });
        const todos = [adm, ...(await Promise.all([1, 2, 3].map(() => amb2.criarUsuario({ perfil: "tecnico", equipeId: eq.id }))))];
        // O registro veio vazio (ou mal configurado): ninguém está nele.
        const { leitura_id } = await amb2.esperar(202, "POST", "/rh/leituras", { como: adm });
        await executarTarefasPendentes(amb2.deps);
        const [l] = await amb2.sql<any>("select * from leitura_rh where id = $1", [leitura_id]);
        assert.match(l.erro, /interrompida/i);
        assert.ok(l.concluida_em, "terminou, sem tentar de novo");
        assert.equal(l.desativados, 0);
        const ativos = await amb2.sql<any>("select id from usuario where ativo and situacao_registro is null");
        assert.equal(ativos.length, todos.length, "ninguém foi desativado nem conferido");
        assert.equal((await amb2.sql<any>("select estado from tarefa where tipo = 'leitura_rh'"))[0].estado, "concluida");
        await amb2.esperar(200, "GET", "/equipes", { como: todos[1]! });

        const sinc = await amb2.esperar(200, "GET", "/rh/sincronizacao", { como: adm });
        assert.equal(sinc.ultima_leitura.situacao, "falhou");
        assert.match(sinc.ultima_leitura.erro, /interrompida/i);
      } finally {
        await amb2.fechar();
      }
    });

    it("exatamente a metade passa; registro fora do ar deixa a leitura tentando de novo, com o erro, até acabar as tentativas", async () => {
      const amb2 = await criarAmbiente({ relogio: MEIO_DIA, duracaoDoTokenSeg: 24 * 3600 });
      try {
        const eq = await amb2.criarEquipe();
        const adm = await amb2.criarUsuario({ perfil: "admin" });
        const a = await amb2.criarUsuario({ perfil: "tecnico", equipeId: eq.id });
        amb2.registrarFuncionario({ matricula: adm.matricula });
        // a está fora do registro: 1 de 2 ativos = metade, e a trava só vale acima disso
        await amb2.esperar(202, "POST", "/rh/leituras", { como: adm });
        await executarTarefasPendentes(amb2.deps);
        assert.equal((await amb2.sql<any>("select ativo from usuario where id = $1", [a.id]))[0].ativo, false);

        amb2.rh.falhar = true;
        amb2.relogio.agora = new Date(amb2.relogio.agora.getTime() + 60_000);
        const { leitura_id: segunda } = await amb2.esperar(202, "POST", "/rh/leituras", { como: adm });
        await executarTarefasPendentes(amb2.deps);
        const [tentando] = await amb2.sql<any>("select * from leitura_rh where id = $1", [segunda]);
        assert.match(tentando.erro, /RH fora do ar/);
        assert.equal(tentando.concluida_em, null);
        assert.equal((await amb2.esperar(200, "GET", "/rh/sincronizacao", { como: adm })).ultima_leitura.situacao, "tentando_de_novo");
        for (let i = 0; i < 4; i++) {
          amb2.relogio.agora = new Date(amb2.relogio.agora.getTime() + 20 * 60_000);
          await executarTarefasPendentes(amb2.deps);
        }
        const sinc = await amb2.esperar(200, "GET", "/rh/sincronizacao", { como: adm });
        assert.equal(sinc.ultima_leitura.situacao, "falhou", "as tentativas acabaram");
        assert.match(sinc.ultima_leitura.erro, /RH fora do ar/);
      } finally {
        await amb2.fechar();
      }
    });

    it("o último administrador ativo nunca é desativado pela leitura", async () => {
      const amb2 = await criarAmbiente({ relogio: MEIO_DIA });
      try {
        const eq = await amb2.criarEquipe();
        const adm = await amb2.criarUsuario({ perfil: "admin" });
        const outros = await Promise.all([1, 2, 3].map(() => amb2.criarUsuario({ perfil: "tecnico", equipeId: eq.id })));
        for (const o of outros) amb2.registrarFuncionario({ matricula: o.matricula });
        // o admin sumiu do registro: 1 de 4 ativos (abaixo da trava), mas é o último admin
        await amb2.esperar(202, "POST", "/rh/leituras", { como: adm });
        await executarTarefasPendentes(amb2.deps);
        const [u] = await amb2.sql<any>("select ativo, situacao_registro from usuario where id = $1", [adm.id]);
        assert.deepEqual(u, { ativo: true, situacao_registro: "fora_do_registro" });
      } finally {
        await amb2.fechar();
      }
    });

    it("GET /rh/sincronizacao é só do admin e, antes de qualquer leitura, não tem última leitura", async () => {
      const amb2 = await criarAmbiente({ relogio: MEIO_DIA });
      try {
        const adm = await amb2.criarUsuario({ perfil: "admin" });
        const tec = await amb2.criarUsuario({ perfil: "tecnico" });
        assert.equal((await amb2.req("GET", "/rh/sincronizacao")).status, 401);
        assert.equal((await amb2.req("GET", "/rh/sincronizacao", { como: tec })).status, 403);
        const vazio = await amb2.esperar(200, "GET", "/rh/sincronizacao", { como: adm });
        assert.equal(vazio.ultima_leitura, null);
      } finally {
        await amb2.fechar();
      }
    });

    it("lerAgora de verdade: a leitura concluída traz as contagens", async () => {
      const u = await pessoa();
      const l = await lerAgora();
      assert.ok(l.concluida_em);
      assert.ok(l.conferidos >= 1);
      assert.equal((await usuarioNoBanco(u.id)).situacao_registro, "ativo");
    });
  });

  describe("leitura diária agendada", () => {
    it("só a partir da hora configurada e uma por dia, mesmo se a api reiniciar (o executor chama de novo)", async () => {
      const amb2 = await criarAmbiente({ relogio: new Date("2026-10-14T05:00:00Z") }); // 2h em São Paulo
      try {
        assert.equal(await agendarLeituraDiariaRh(amb2.deps), false, "ainda é antes das 3h");
        amb2.relogio.agora = new Date("2026-10-14T06:00:00Z"); // 3h
        assert.equal(await agendarLeituraDiariaRh(amb2.deps), true);
        assert.equal(await agendarLeituraDiariaRh(amb2.deps), false, "o dia já tem a sua");
        amb2.relogio.agora = new Date("2026-10-14T20:00:00Z");
        assert.equal(await agendarLeituraDiariaRh(amb2.deps), false);
        const [l] = await amb2.sql<any>("select origem, dia::text, usuario_id from leitura_rh");
        assert.deepEqual(l, { origem: "agendada", dia: "2026-10-14", usuario_id: null });
        assert.equal((await amb2.sql<any>("select count(*)::int n from tarefa where tipo = 'leitura_rh'"))[0].n, 1);

        // O banco também garante: um segundo insert do mesmo dia é recusado.
        await assert.rejects(() => amb2.sql("insert into leitura_rh (origem, dia) values ('agendada', '2026-10-14')"), /leitura_rh_dia_unico|unique/i);

        amb2.relogio.agora = new Date("2026-10-15T06:30:00Z");
        assert.equal(await agendarLeituraDiariaRh(amb2.deps), true, "no dia seguinte, outra");
        assert.equal((await amb2.sql<any>("select count(*)::int n from leitura_rh"))[0].n, 2);
      } finally {
        await amb2.fechar();
      }
    });

    it("sem registro configurado a leitura diária não é agendada, e `Ler agora` e o cadastro respondem 503", async () => {
      const amb2 = await criarAmbiente({ relogio: MEIO_DIA });
      try {
        const adm = await amb2.criarUsuario({ perfil: "admin" });
        const { ClienteRhHttp } = await import("../src/servicos/rh-http");
        // Só esta aplicação perde o registro (o `config` de teste é compartilhado: troca-se o objeto, sem alterá-lo).
        amb2.deps.config = { ...configDeTeste, rhApiUrl: "" };
        amb2.deps.rh = new ClienteRhHttp("", "");
        assert.equal(await agendarLeituraDiariaRh(amb2.deps), false);
        assert.equal((await amb2.sql<any>("select count(*)::int n from leitura_rh"))[0].n, 0);
        const lerAgora = await amb2.req("POST", "/rh/leituras", { como: adm });
        assert.equal(lerAgora.status, 503);
        assert.equal(lerAgora.corpo.erro.codigo, "registro_indisponivel");
        const cadastro = await amb2.req("POST", "/usuarios", { como: adm, json: { matricula: "Z1", email: "z1@empresa.com.br", perfil: "tecnico", senha_inicial: "senha-inicial-1" } });
        assert.equal(cadastro.status, 503);
        assert.equal(cadastro.corpo.erro.codigo, "registro_indisponivel");
        const sinc = await amb2.esperar(200, "GET", "/rh/sincronizacao", { como: adm });
        assert.equal(sinc.configurado, false);
      } finally {
        await amb2.fechar();
      }
    });
  });

  describe("GET /usuarios mostra a situação no registro", () => {
    it("situacao_registro e registro_conferido_em na lista e no perfil, até a primeira conferência (nulos)", async () => {
      const novo = await amb.criarUsuario({ perfil: "tecnico", equipeId });
      const { usuario } = await amb.esperar(200, "GET", `/usuarios/${novo.id}`, { como: admin });
      assert.equal(usuario.situacao_registro, null);
      assert.equal(usuario.registro_conferido_em, null);
      const lista = await amb.esperar(200, "GET", "/usuarios", { como: admin, consulta: { tamanho: 200 } });
      assert.ok(lista.usuarios.every((u: any) => "situacao_registro" in u));
    });
  });
});
