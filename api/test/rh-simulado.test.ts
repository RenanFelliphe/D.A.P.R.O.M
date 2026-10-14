import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { carregarRegistroDosUsuarios } from "../src/db/seed/registro-rh";
import { cargoDeEngenharia, gerarFuncionarios, LIMITE_POR_ENVIO, SETORES } from "../src/dominio/rh-simulado";
import { ClienteRhHttp } from "../src/servicos/rh-http";
import { executarTarefasPendentes } from "../src/servicos/tarefas";
import { configDeTeste, criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

/** Sorteio reproduzível (mulberry32): a mesma semente dá sempre os mesmos funcionários. */
function sorteioComSemente(semente: number) {
  let a = semente;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const novoCorpo = (matricula: string, extra: Record<string, unknown> = {}) => ({
  matricula,
  nome: `Fulano ${matricula}`,
  email: `fulano.${matricula}@empresa.com.br`,
  cargo: "Eletricista",
  centro_trabalho: "SERV_ESP",
  ...extra,
});

describe("Simulador do registro de funcionários", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;

  const contrato = (caminho: string, token: string | null = configDeTeste.rhApiToken, consulta: Record<string, string | number> = {}) =>
    amb.req("GET", `/rh-simulado${caminho}`, { cabecalhos: token === null ? {} : { Authorization: `Bearer ${token}` }, consulta });
  const criar = (matricula: string, extra: Record<string, unknown> = {}) => amb.esperar(201, "POST", "/rh-simulado/gestao/funcionarios", { como: admin, json: novoCorpo(matricula, extra) });
  const lista = (consulta: Record<string, string | number> = {}) => amb.esperar(200, "GET", "/rh-simulado/gestao/funcionarios", { como: admin, consulta: { tamanho: 200, ...consulta } });
  const emMassa = (json: unknown) => amb.esperar(200, "POST", "/rh-simulado/gestao/funcionarios/em-massa", { como: admin, json });

  before(async () => {
    amb = await criarAmbiente();
    admin = await amb.criarUsuario({ perfil: "admin" });
    tecnico = await amb.criarUsuario({ perfil: "tecnico" });
  });
  after(() => amb.fechar());

  describe("contrato (o que o DAPROM lê)", () => {
    it("exige o token do registro", async () => {
      await criar("K1");
      assert.equal((await contrato("/funcionarios", null)).status, 401);
      assert.equal((await contrato("/funcionarios", "errado")).status, 401);
      assert.equal((await contrato("/funcionarios/K1", null)).status, 401);
      assert.equal((await contrato("/funcionarios", configDeTeste.rhAvisoToken)).status, 401);
    });

    it("devolve o funcionário no formato do contrato, sem CPF, e 404 para matrícula inexistente", async () => {
      await criar("K2", { cargo: "Engenheiro Mecânico", registro_profissional: "CREA ES-050003/D", telefone: "(27) 3200-1234", lotacao: "Vila Velha/ES", gestor_matricula: "K1", data_admissao: "2018-03-12", data_nascimento: "1990-07-04" });
      const r = await contrato("/funcionarios/K2");
      assert.equal(r.status, 200);
      assert.deepEqual(r.corpo, {
        matricula: "K2",
        nome: "Fulano K2",
        email: "fulano.k2@empresa.com.br",
        cargo: "Engenheiro Mecânico",
        centro_trabalho: "SERV_ESP",
        setor: "Serviços Especiais",
        registro_profissional: "CREA ES-050003/D",
        situacao: "ativo",
        data_admissao: "2018-03-12",
        data_nascimento: "1990-07-04",
        telefone: "(27) 3200-1234",
        gestor_matricula: "K1",
        lotacao: "Vila Velha/ES",
      });
      assert.ok(!("cpf" in r.corpo));
      const nao = await contrato("/funcionarios/NAO_EXISTE");
      assert.equal(nao.status, 404);
    });

    it("pagina com proxima_pagina, por matrícula, e o cliente HTTP do DAPROM lê tudo", async () => {
      for (const m of ["K10", "K11", "K12", "K13", "K14"]) await criar(m);
      const total = (await lista()).total;
      const p1 = await contrato("/funcionarios", configDeTeste.rhApiToken, { pagina: 1, tamanho: 2 });
      assert.equal(p1.corpo.funcionarios.length, 2);
      assert.equal(p1.corpo.proxima_pagina, 2);
      const ultima = await contrato("/funcionarios", configDeTeste.rhApiToken, { pagina: Math.ceil(total / 2), tamanho: 2 });
      assert.equal(ultima.corpo.proxima_pagina, undefined);
      assert.equal((await contrato("/funcionarios", configDeTeste.rhApiToken, { tamanho: 500 })).status, 422);

      // O mesmo caminho do DAPROM: o cliente HTTP falando com a aplicação.
      const buscarNaApp: typeof fetch = async (entrada, init) => amb.app.request(entrada instanceof Request ? entrada : new URL(String(entrada)).pathname + new URL(String(entrada)).search, init);
      const cliente = new ClienteRhHttp("http://rh.local/rh-simulado", configDeTeste.rhApiToken, buscarNaApp);
      const todos: string[] = [];
      for (let pagina = 1; ; ) {
        const r = await cliente.listarFuncionarios({ pagina, tamanho: 3 });
        todos.push(...r.funcionarios.map((f) => f.matricula));
        if (!r.proxima_pagina) break;
        pagina = r.proxima_pagina;
      }
      assert.equal(todos.length, total);
      assert.equal((await cliente.obterFuncionario("K2"))?.nome, "Fulano K2");
      assert.equal(await cliente.obterFuncionario("NAO_EXISTE"), null);
      const semToken = new ClienteRhHttp("http://rh.local/rh-simulado", "errado", buscarNaApp);
      await assert.rejects(() => semToken.obterFuncionario("K2"), /respondeu 401/);
    });
  });

  describe("gestão: só o admin logado", () => {
    it("é 401 sem login e 403 para quem não é admin; o token do registro não vale na gestão", async () => {
      assert.equal((await amb.req("GET", "/rh-simulado/gestao/funcionarios")).status, 401);
      assert.equal((await amb.req("GET", "/rh-simulado/gestao/funcionarios", { cabecalhos: { Authorization: `Bearer ${configDeTeste.rhApiToken}` } })).status, 401);
      assert.equal((await amb.req("GET", "/rh-simulado/gestao/funcionarios", { como: tecnico })).status, 403);
      assert.equal((await amb.req("POST", "/rh-simulado/gestao/funcionarios", { como: tecnico, json: novoCorpo("X") })).status, 403);
      assert.equal((await amb.req("GET", "/rh-simulado/gestao/catalogo", { como: tecnico })).status, 403);
    });
  });

  describe("criação manual", () => {
    it("cria com o setor do catálogo, e-mail em minúsculas, situação ativo e a data de criação", async () => {
      const r = await amb.esperar(201, "POST", "/rh-simulado/gestao/funcionarios", { como: admin, json: novoCorpo("M1", { email: "Fulano.M1@Empresa.com.br", centro_trabalho: "INSTRUM", cargo: "Instrumentista" }) });
      assert.equal(r.funcionario.email, "fulano.m1@empresa.com.br");
      assert.equal(r.funcionario.setor, "Instrumentação");
      assert.equal(r.funcionario.centro_trabalho, "INSTRUM");
      assert.equal(r.funcionario.situacao, "ativo");
      assert.ok(r.funcionario.criado_em);
    });

    it("recusa matrícula e e-mail repetidos (409), setor fora do catálogo (422) e corpo inválido (422)", async () => {
      await criar("M2");
      const mat = await amb.req("POST", "/rh-simulado/gestao/funcionarios", { como: admin, json: novoCorpo("M2", { email: "outro.m2@empresa.com.br" }) });
      assert.equal(mat.status, 409);
      assert.equal(mat.corpo.erro.codigo, "matricula_duplicada");
      const email = await amb.req("POST", "/rh-simulado/gestao/funcionarios", { como: admin, json: novoCorpo("M3", { email: "FULANO.M2@empresa.com.br" }) });
      assert.equal(email.status, 409);
      assert.equal(email.corpo.erro.codigo, "email_duplicado");
      const setor = await amb.req("POST", "/rh-simulado/gestao/funcionarios", { como: admin, json: novoCorpo("M4", { centro_trabalho: "INEXISTENTE" }) });
      assert.equal(setor.status, 422);
      assert.equal(setor.corpo.erro.codigo, "setor_inexistente");
      assert.equal((await amb.req("POST", "/rh-simulado/gestao/funcionarios", { como: admin, json: { matricula: "M5" } })).status, 422);
      assert.equal((await amb.req("POST", "/rh-simulado/gestao/funcionarios", { como: admin, json: novoCorpo("M6", { situacao: "demitido" }) })).status, 422);
    });
  });

  describe("catálogo", () => {
    it("traz os setores com os cargos, quais têm equipe no DAPROM e a próxima matrícula livre (a maior numérica mais um)", async () => {
      const amb2 = await criarAmbiente();
      try {
        const adm = await amb2.criarUsuario({ perfil: "admin" });
        await amb2.criarEquipe({ nome: "Serviços Especiais", centroTrabalho: "SERV_ESP" });
        const catalogo = () => amb2.esperar(200, "GET", "/rh-simulado/gestao/catalogo", { como: adm });
        const c = await catalogo();
        assert.equal(c.proxima_matricula, "100001", "começa em 100001");
        assert.deepEqual(c.situacoes, ["ativo", "afastado", "desligado"]);
        const serv = c.setores.find((s: any) => s.centro_trabalho === "SERV_ESP");
        assert.equal(serv.equipe_no_daprom, "Serviços Especiais");
        assert.ok(serv.cargos.includes("Técnico em Gás"));
        assert.equal(c.setores.find((s: any) => s.centro_trabalho === "INSTRUM").equipe_no_daprom, null);
        assert.ok(c.setores.some((s: any) => s.centro_trabalho === "MAN_ELE"), "há setores sem equipe, para o caso 'sem equipe correspondente'");

        await amb2.esperar(201, "POST", "/rh-simulado/gestao/funcionarios", { como: adm, json: novoCorpo("100231") });
        await amb2.esperar(201, "POST", "/rh-simulado/gestao/funcionarios", { como: adm, json: novoCorpo("adm") });
        assert.equal((await catalogo()).proxima_matricula, "100232", "matrícula não numérica não conta");
      } finally {
        await amb2.fechar();
      }
    });
  });

  describe("gerador aleatório", () => {
    const base = { matriculaInicial: 100001, emailsEmUso: new Set<string>(), hoje: new Date("2026-10-14T12:00:00Z") };

    it("respeita quantidade, setor, cargo e situação dos lotes, com matrículas e e-mails únicos", () => {
      const f = gerarFuncionarios(
        [
          { quantidade: 10, centro_trabalho: "SERV_ESP", cargo: "Mecânico" },
          { quantidade: 5, centro_trabalho: "INSTRUM", situacao: "afastado" },
          { quantidade: 30 },
        ],
        { ...base, sorteio: sorteioComSemente(7) },
      );
      assert.equal(f.length, 45);
      assert.ok(f.slice(0, 10).every((x) => x.cargo === "Mecânico" && x.centroTrabalho === "SERV_ESP" && x.setor === "Serviços Especiais" && x.situacao === "ativo"));
      assert.ok(f.slice(10, 15).every((x) => x.centroTrabalho === "INSTRUM" && x.situacao === "afastado"));
      assert.equal(new Set(f.map((x) => x.matricula)).size, 45);
      assert.equal(f[0]!.matricula, "100001");
      assert.equal(f[44]!.matricula, "100045");
      assert.equal(new Set(f.map((x) => x.email)).size, 45, "mesmo com homônimos, o e-mail é único");
      assert.ok(f.every((x) => /^[a-z]+\.[a-z]+\d*@empresa\.com\.br$/.test(x.email)), f.map((x) => x.email).join(", "));
    });

    it("o cargo é coerente com o setor e o CREA só existe em cargo de engenharia", () => {
      const f = gerarFuncionarios([{ quantidade: 200 }], { ...base, sorteio: sorteioComSemente(11) });
      for (const x of f) {
        const setor = SETORES.find((s) => s.centro === x.centroTrabalho)!;
        assert.ok(setor.cargos.includes(x.cargo), `${x.cargo} não é de ${setor.nome}`);
        assert.equal(Boolean(x.registroProfissional), cargoDeEngenharia(x.cargo), x.cargo);
        if (x.registroProfissional) assert.match(x.registroProfissional, /^CREA ES-0\d{5}\/D$/);
      }
      assert.ok(f.some((x) => x.registroProfissional), "alguém de engenharia saiu");
    });

    it("datas plausíveis: admissão nos últimos 20 anos, idade entre 20 e 60 anos, e ninguém admitido antes dos 18", () => {
      const f = gerarFuncionarios([{ quantidade: 200 }], { ...base, sorteio: sorteioComSemente(3) });
      const ANO = 365.25 * 24 * 3600_000;
      for (const x of f) {
        const idade = (base.hoje.getTime() - new Date(x.dataNascimento!).getTime()) / ANO;
        const casa = (base.hoje.getTime() - new Date(x.dataAdmissao!).getTime()) / ANO;
        assert.ok(idade >= 19.9 && idade <= 61.1, `idade ${idade}`);
        assert.ok(casa >= 0 && casa <= 21.1, `tempo de casa ${casa}`);
        assert.ok(idade - casa >= 17.5, `admitido com ${idade - casa} anos`);
      }
    });

    it("é reproduzível com o mesmo sorteio e respeita e-mails já em uso", () => {
      const a = gerarFuncionarios([{ quantidade: 20 }], { ...base, sorteio: sorteioComSemente(42) });
      const b = gerarFuncionarios([{ quantidade: 20 }], { ...base, sorteio: sorteioComSemente(42) });
      assert.deepEqual(a, b);
      const usados = new Set(a.map((x) => x.email));
      const c = gerarFuncionarios([{ quantidade: 20 }], { ...base, sorteio: sorteioComSemente(42), emailsEmUso: usados });
      assert.ok(c.every((x) => !usados.has(x.email)));
    });

    it("recusa mais de 200 por envio e setor desconhecido", () => {
      assert.throws(() => gerarFuncionarios([{ quantidade: 150 }, { quantidade: 51 }], base), /No máximo 200/);
      assert.throws(() => gerarFuncionarios([{ quantidade: 1, centro_trabalho: "XXX" }], base), /Setor desconhecido/);
      assert.equal(LIMITE_POR_ENVIO, 200);
    });

    it("POST /gestao/funcionarios/aleatorios cria em lotes, e 422 acima do limite", async () => {
      const antes = (await lista()).total;
      const r = await amb.esperar(201, "POST", "/rh-simulado/gestao/funcionarios/aleatorios", {
        como: admin,
        json: { lotes: [{ quantidade: 10, centro_trabalho: "SERV_ESP", cargo: "Mecânico" }, { quantidade: 5, centro_trabalho: "INSTRUM", cargo: "Instrumentista" }] },
      });
      assert.equal(r.criados, 15);
      const depois = await lista();
      assert.equal(depois.total, antes + 15);
      assert.equal(depois.funcionarios.filter((f: any) => f.cargo === "Mecânico").length >= 10, true);

      const demais = await amb.req("POST", "/rh-simulado/gestao/funcionarios/aleatorios", { como: admin, json: { lotes: [{ quantidade: 150 }, { quantidade: 60 }] } });
      assert.equal(demais.status, 422);
      assert.equal(demais.corpo.erro.codigo, "limite_excedido");
      assert.equal((await amb.req("POST", "/rh-simulado/gestao/funcionarios/aleatorios", { como: admin, json: { lotes: [{ quantidade: 201 }] } })).status, 422);
      assert.equal((await amb.req("POST", "/rh-simulado/gestao/funcionarios/aleatorios", { como: admin, json: { lotes: [] } })).status, 422);
      assert.equal((await lista()).total, antes + 15, "nada foi criado nas recusas");
    });
  });

  describe("lista, busca e contador", () => {
    it("busca por nome, e-mail ou matrícula sem diferenciar acento, pagina e conta por situação", async () => {
      await criar("L1", { nome: "João Ação", email: "joao.acao@empresa.com.br", situacao: "afastado" });
      await criar("L2", { nome: "Maria Silva", email: "maria.silva@empresa.com.br", situacao: "desligado" });
      const porNome = await lista({ busca: "joao acao" });
      assert.deepEqual(porNome.funcionarios.map((f: any) => f.matricula), ["L1"]);
      assert.equal(porNome.total, 1);
      assert.deepEqual((await lista({ busca: "MARIA.SILVA@" })).funcionarios.map((f: any) => f.matricula), ["L2"]);
      assert.deepEqual((await lista({ busca: "l2" })).funcionarios.map((f: any) => f.matricula), ["L2"]);

      const pagina = await lista({ tamanho: 2, pagina: 2 });
      assert.equal(pagina.funcionarios.length, 2);
      assert.equal(pagina.pagina, 2);
      assert.ok(pagina.total > 4);
      const { contagem, total } = await lista({ busca: "joao acao" });
      assert.equal(contagem.ativo + contagem.afastado + contagem.desligado, (await lista()).total, "o contador é de todos, não só da busca");
      assert.ok(contagem.afastado >= 1 && contagem.desligado >= 1);
      assert.equal(total, 1);
    });

    it("mostra a conta no DAPROM (perfil, equipe e se está ativa) ou null", async () => {
      const equipe = await amb.criarEquipe();
      const conta = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipe.id, matricula: "CONTA1" });
      await criar("CONTA1", { email: conta.email });
      await criar("SEM_CONTA1");
      const r = await lista({ busca: "conta1" });
      const com = r.funcionarios.find((f: any) => f.matricula === "CONTA1");
      assert.deepEqual(com.conta_no_daprom, { id: conta.id, perfil: "tecnico", equipe_id: equipe.id, ativo: true, liberacao: "liberado" });
      const sem = (await lista({ busca: "sem_conta1" })).funcionarios.find((f: any) => f.matricula === "SEM_CONTA1");
      assert.equal(sem.conta_no_daprom, null);
    });
  });

  describe("edição", () => {
    it("muda os campos, menos a matrícula (que é recusada, não ignorada); o setor atualiza o nome do setor", async () => {
      await criar("E1");
      const r = await amb.esperar(200, "PATCH", "/rh-simulado/gestao/funcionarios/E1", { como: admin, json: { nome: "Novo Nome", cargo: "Mecânico", centro_trabalho: "MAN_MEC", telefone: "(27) 1", registro_profissional: null } });
      assert.equal(r.funcionario.nome, "Novo Nome");
      assert.equal(r.funcionario.setor, "Manutenção Mecânica");
      assert.equal(r.funcionario.matricula, "E1");
      const matricula = await amb.req("PATCH", "/rh-simulado/gestao/funcionarios/E1", { como: admin, json: { matricula: "E1X" } });
      assert.equal(matricula.status, 422);
      assert.equal((await contrato("/funcionarios/E1")).corpo.nome, "Novo Nome");
      assert.equal((await amb.req("PATCH", "/rh-simulado/gestao/funcionarios/NAO", { como: admin, json: { nome: "x" } })).status, 404);
      await criar("E2");
      assert.equal((await amb.req("PATCH", "/rh-simulado/gestao/funcionarios/E1", { como: admin, json: { email: "fulano.e2@empresa.com.br" } })).status, 409);
      assert.equal((await amb.req("PATCH", "/rh-simulado/gestao/funcionarios/E1", { como: admin, json: { centro_trabalho: "XXX" } })).status, 422);
      assert.equal((await amb.req("PATCH", "/rh-simulado/gestao/funcionarios/E1", { como: admin, json: { email: "fulano.e1@empresa.com.br" } })).status, 200, "o próprio e-mail não conflita consigo");
    });

    it("passar para desligado avisa o DAPROM; outras mudanças e repetir o desligamento, não", async () => {
      await criar("E3");
      amb.avisosRh.length = 0;
      await amb.esperar(200, "PATCH", "/rh-simulado/gestao/funcionarios/E3", { como: admin, json: { situacao: "afastado" } });
      await amb.esperar(200, "PATCH", "/rh-simulado/gestao/funcionarios/E3", { como: admin, json: { nome: "Outro" } });
      assert.deepEqual(amb.avisosRh, []);
      await amb.esperar(200, "PATCH", "/rh-simulado/gestao/funcionarios/E3", { como: admin, json: { situacao: "desligado" } });
      assert.deepEqual(amb.avisosRh, [["E3"]]);
      await amb.esperar(200, "PATCH", "/rh-simulado/gestao/funcionarios/E3", { como: admin, json: { situacao: "desligado" } });
      assert.equal(amb.avisosRh.length, 1, "já estava desligado");
    });

    it("de ponta a ponta: desligar na tela desativa a conta no DAPROM em segundos (aviso → tarefa → conferência)", async () => {
      const conta = await amb.criarUsuario({ perfil: "tecnico", matricula: "FIM1" });
      await criar("FIM1", { email: conta.email });
      await amb.esperar(200, "GET", "/equipes", { como: conta });
      // O consultor do DAPROM fala com o simulador de verdade (o cliente HTTP, não o de memória).
      const buscarNaApp: typeof fetch = async (entrada, init) => amb.app.request(new URL(String(entrada)).pathname + new URL(String(entrada)).search, init);
      const deps = { ...amb.deps, rh: new ClienteRhHttp("http://rh.local/rh-simulado", configDeTeste.rhApiToken, buscarNaApp) };
      amb.rhSimulador.encaminhar = true;
      try {
        await amb.esperar(200, "PATCH", "/rh-simulado/gestao/funcionarios/FIM1", { como: admin, json: { situacao: "desligado" } });
      } finally {
        amb.rhSimulador.encaminhar = false;
      }
      assert.equal(await executarTarefasPendentes(deps) >= 1, true);
      const r = await amb.req("GET", "/equipes", { como: conta });
      assert.equal(r.status, 401);
      assert.equal(r.corpo.erro.codigo, "acesso_revogado");
      const [u] = await amb.sql<any>("select ativo, situacao_registro from usuario where id = $1", [conta.id]);
      assert.deepEqual(u, { ativo: false, situacao_registro: "desligado" });
    });
  });

  describe("exclusão", () => {
    it("exclui quem não tem conta; quem tem deve ser desligado (409 funcionario_com_conta)", async () => {
      await criar("X1");
      await amb.esperar(200, "DELETE", "/rh-simulado/gestao/funcionarios/X1", { como: admin });
      assert.equal((await contrato("/funcionarios/X1")).status, 404);
      assert.equal((await amb.req("DELETE", "/rh-simulado/gestao/funcionarios/X1", { como: admin })).status, 404);

      const conta = await amb.criarUsuario({ perfil: "tecnico", matricula: "X2" });
      await criar("X2", { email: conta.email });
      const r = await amb.req("DELETE", "/rh-simulado/gestao/funcionarios/X2", { como: admin });
      assert.equal(r.status, 409);
      assert.equal(r.corpo.erro.codigo, "funcionario_com_conta");
      assert.match(r.corpo.erro.mensagem, /Desligue o funcionário em vez de excluir/);
      assert.equal((await contrato("/funcionarios/X2")).status, 200, "continua no registro");
    });
  });

  describe("ações em massa", () => {
    it("excluir: exclui quem pode e devolve os recusados (com conta, ou que não existe)", async () => {
      const conta = await amb.criarUsuario({ perfil: "tecnico", matricula: "G2" });
      await criar("G1");
      await criar("G2", { email: conta.email });
      await criar("G3");
      const r = await emMassa({ matriculas: ["G1", "G2", "G3", "G_NAO_EXISTE"], acao: "excluir" });
      assert.equal(r.afetados, 2);
      assert.deepEqual(
        r.recusados.map((x: any) => x.matricula).sort(),
        ["G2", "G_NAO_EXISTE"],
      );
      assert.match(r.recusados.find((x: any) => x.matricula === "G2").motivo, /Desligue o funcionário em vez de excluir/);
      assert.equal((await contrato("/funcionarios/G1")).status, 404);
      assert.equal((await contrato("/funcionarios/G2")).status, 200);
    });

    it("mudar_setor: muda o setor de todos; setor inexistente ou ausente é 422", async () => {
      await criar("S1");
      await criar("S2");
      const r = await emMassa({ matriculas: ["S1", "S2"], acao: "mudar_setor", valor: "LAB_QUI" });
      assert.equal(r.afetados, 2);
      assert.equal((await contrato("/funcionarios/S1")).corpo.setor, "Laboratório Químico");
      assert.equal((await contrato("/funcionarios/S2")).corpo.centro_trabalho, "LAB_QUI");
      assert.equal((await amb.req("POST", "/rh-simulado/gestao/funcionarios/em-massa", { como: admin, json: { matriculas: ["S1"], acao: "mudar_setor", valor: "XXX" } })).status, 422);
      assert.equal((await amb.req("POST", "/rh-simulado/gestao/funcionarios/em-massa", { como: admin, json: { matriculas: ["S1"], acao: "mudar_setor" } })).status, 422);
    });

    it("mudar_situacao: desligar avisa o DAPROM só das matrículas que passaram a desligado agora", async () => {
      await criar("D1");
      await criar("D2", { situacao: "desligado" });
      await criar("D3");
      amb.avisosRh.length = 0;
      const r = await emMassa({ matriculas: ["D1", "D2", "D3"], acao: "mudar_situacao", valor: "desligado" });
      assert.equal(r.afetados, 3);
      assert.deepEqual(amb.avisosRh, [["D1", "D3"]], "um aviso só, sem D2 (já estava desligado)");
      assert.equal((await contrato("/funcionarios/D1")).corpo.situacao, "desligado");

      amb.avisosRh.length = 0;
      await emMassa({ matriculas: ["D1"], acao: "mudar_situacao", valor: "ativo" });
      assert.deepEqual(amb.avisosRh, [], "reativar no registro não avisa");
      assert.equal((await amb.req("POST", "/rh-simulado/gestao/funcionarios/em-massa", { como: admin, json: { matriculas: ["D1"], acao: "mudar_situacao", valor: "demitido" } })).status, 422);
    });

    it("todos_da_busca age sobre tudo o que a busca encontra, não só a página; sem matrículas nem a marca é 422", async () => {
      for (let i = 1; i <= 5; i++) await criar(`T${i}`, { nome: `Tadeu Massa ${i}`, email: `tadeu.massa${i}@empresa.com.br` });
      const antes = (await lista()).total;
      const r = await emMassa({ todos_da_busca: true, busca: "tadeu massa", acao: "excluir" });
      assert.equal(r.afetados, 5);
      assert.equal((await lista()).total, antes - 5);
      assert.equal((await amb.req("POST", "/rh-simulado/gestao/funcionarios/em-massa", { como: admin, json: { acao: "excluir" } })).status, 422);
      assert.equal((await amb.req("POST", "/rh-simulado/gestao/funcionarios/em-massa", { como: admin, json: { matriculas: ["T1"], todos_da_busca: true, acao: "excluir" } })).status, 422);
      assert.equal((await amb.req("POST", "/rh-simulado/gestao/funcionarios/em-massa", { como: admin, json: { matriculas: ["T1"], acao: "inventada" } })).status, 422);
    });
  });

  describe("aviso de saída", () => {
    it("se o envio ao DAPROM falhar, o simulador só registra no log e a edição vale", async () => {
      const { avisoPorHttp } = await import("../src/rotas/rh-simulado");
      const chamadas: string[] = [];
      const falha: typeof fetch = async (url, init) => {
        chamadas.push(`${String(url)} ${(init?.headers as Record<string, string>).Authorization}`);
        throw new Error("DAPROM fora do ar");
      };
      const avisar = avisoPorHttp(amb.deps, falha);
      const aviso = console.warn;
      const logs: string[] = [];
      console.warn = (m: string) => void logs.push(m);
      try {
        await avisar(["Q1"]);
        await avisar([]);
      } finally {
        console.warn = aviso;
      }
      assert.deepEqual(chamadas, [`http://api.local/rh/avisos Bearer ${configDeTeste.rhAvisoToken}`]);
      assert.equal(logs.length, 1);
      assert.match(logs[0]!, /DAPROM fora do ar/);
    });
  });

  describe("carga do registro a partir dos usuários (modo local, demonstração e banco publicado)", () => {
    it("cria um funcionário ativo para cada usuário, com os mesmos dados e o setor da equipe, e não duplica", async () => {
      const amb2 = await criarAmbiente();
      try {
        const eq = await amb2.criarEquipe({ nome: "Serviços Especiais", centroTrabalho: "SERV_ESP" });
        const adm = await amb2.criarUsuario({ perfil: "admin", nome: "Ana Admin" });
        const tec = await amb2.criarUsuario({ perfil: "tecnico", equipeId: eq.id, nome: "Tiago Técnico" });
        const r = await carregarRegistroDosUsuarios(amb2.db, { sorteio: sorteioComSemente(1) });
        assert.equal(r.criados, 2);
        assert.equal(r.aleatorios, 0);
        const [f] = await amb2.sql<any>("select * from funcionario_simulado where matricula = $1", [tec.matricula]);
        assert.equal(f.nome, "Tiago Técnico");
        assert.equal(f.email, tec.email);
        assert.equal(f.centro_trabalho, "SERV_ESP");
        assert.equal(f.setor, "Serviços Especiais");
        assert.equal(f.situacao, "ativo");
        const [a] = await amb2.sql<any>("select centro_trabalho, setor from funcionario_simulado where matricula = $1", [adm.matricula]);
        assert.deepEqual(a, { centro_trabalho: "ADMIN", setor: "Administrativo" });

        const de_novo = await carregarRegistroDosUsuarios(amb2.db, { aleatorios: 30, sorteio: sorteioComSemente(2) });
        assert.equal(de_novo.criados, 0, "não duplica");
        assert.equal(de_novo.aleatorios, 30);
        assert.equal((await amb2.sql<any>("select count(*)::int n from funcionario_simulado"))[0].n, 32);
        // Os sem conta existem para demonstrar o cadastro.
        assert.equal((await amb2.sql<any>("select count(*)::int n from funcionario_simulado f where not exists (select 1 from usuario u where lower(u.matricula) = lower(f.matricula))"))[0].n, 30);
      } finally {
        await amb2.fechar();
      }
    });
  });
});
