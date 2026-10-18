import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { SENHA_PADRAO, arquivoDeImagem, criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

describe("Plataforma, usuários e equipes", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;
  let equipeId: string;

  before(async () => {
    amb = await criarAmbiente();
    equipeId = (await amb.criarEquipe()).id;
    admin = await amb.criarUsuario({ perfil: "admin" });
    // A equipe tem supervisor: sem ele, o técnico seria o representante no comando (equipe sem supervisor) e deixaria de ser um técnico comum.
    await amb.criarUsuario({ perfil: "tecnico", equipeId, supervisor: true, nome: "Supervisor da Equipe" });
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId });
  });
  after(() => amb.fechar());

  it("GET /saude é pública e responde versão e banco", async () => {
    const c = await amb.esperar(200, "GET", "/saude");
    assert.deepEqual(c, { versao: "teste", banco: "ok" });
  });

  it("recusa sem token (401) e com token inválido (401)", async () => {
    assert.equal((await amb.req("GET", "/me")).status, 401);
    assert.equal((await amb.req("GET", "/me", { cabecalhos: { Authorization: "Bearer lixo" } })).status, 401);
  });

  it("recusa perfil sem permissão (403) e aceita o admin, que cadastra quem está no registro de funcionários", async () => {
    amb.registrarFuncionario({ matricula: "M900", nome: "Maria Souza", email: "maria.souza@empresa.com.br", cargo: "Eletricista" });
    const corpo = { matricula: "M900", email: "maria.souza@empresa.com.br", perfil: "tecnico", senha_inicial: "senha-inicial-1" };
    assert.equal((await amb.req("POST", "/usuarios", { como: tecnico, json: corpo })).status, 403);
    const criado = await amb.esperar(201, "POST", "/usuarios", { como: admin, json: corpo });
    assert.match(criado.id, /^[0-9a-f-]{36}$/);
    // Nome e cargo vieram do registro, que o corpo nem informa.
    const perfil = await amb.esperar(200, "GET", `/usuarios/${criado.id}`, { como: admin });
    assert.equal(perfil.usuario.nome, "Maria Souza");
    assert.equal(perfil.usuario.cargo, "Eletricista");
    assert.equal(perfil.usuario.situacao_registro, "ativo");
  });

  it("matrícula repetida é 409, sem diferenciar maiúsculas", async () => {
    amb.registrarFuncionario({ matricula: "m900", nome: "Outra Pessoa", email: "outra.pessoa@empresa.com.br" });
    const r = await amb.req("POST", "/usuarios", {
      como: admin,
      json: { matricula: "m900", email: "outra.pessoa@empresa.com.br", perfil: "tecnico", senha_inicial: "senha-inicial-1" },
    });
    assert.equal(r.status, 409);
    assert.equal(r.corpo.erro.codigo, "matricula_duplicada");
    assert.equal(r.corpo.erro.mensagem, "Matrícula já cadastrada");
  });

  it("e-mail repetido é 409, sem diferenciar maiúsculas", async () => {
    amb.registrarFuncionario({ matricula: "M901", nome: "Mariana Souza", email: "Maria.Souza@Empresa.com.br" });
    const r = await amb.req("POST", "/usuarios", {
      como: admin,
      json: { matricula: "M901", email: "Maria.Souza@Empresa.com.br", perfil: "tecnico", senha_inicial: "senha-inicial-1" },
    });
    assert.equal(r.status, 409);
    assert.equal(r.corpo.erro.codigo, "email_duplicado");
  });

  it("valida o corpo: o e-mail é obrigatório (inclusive do supervisor) e precisa ser um e-mail", async () => {
    const semEmail = await amb.req("POST", "/usuarios", { como: admin, json: { matricula: "S1", perfil: "tecnico", senha_inicial: "senha-inicial-1" } });
    assert.equal(semEmail.status, 422);
    assert.equal(semEmail.corpo.erro.codigo, "validacao");
    const ruim = await amb.req("POST", "/usuarios", { como: admin, json: { matricula: "S2", email: "isto não é e-mail", perfil: "tecnico", senha_inicial: "senha-inicial-1" } });
    assert.equal(ruim.status, 422);
    assert.equal(ruim.corpo.erro.codigo, "validacao");
    const semMatricula = await amb.req("POST", "/usuarios", { como: admin, json: { email: "s@empresa.com.br", perfil: "tecnico", senha_inicial: "senha-inicial-1" } });
    assert.equal(semMatricula.status, 422);
  });

  it("primeiro login com senha inicial: entra, mas só troca a senha", async () => {
    const login = await amb.esperar(200, "POST", "/auth/login", { json: { email: "maria.souza@empresa.com.br", senha: "senha-inicial-1" } });
    assert.equal(login.senha_provisoria, true);
    assert.equal(login.usuario.matricula, "M900");
    assert.equal(login.usuario.email, "maria.souza@empresa.com.br");
    const novo: UsuarioDeTeste = { ...tecnico, token: login.access_token };

    assert.equal((await amb.req("GET", "/equipes", { como: novo })).status, 403);
    assert.equal((await amb.req("GET", "/equipes", { como: novo })).corpo.erro.codigo, "senha_provisoria");
    await amb.esperar(200, "GET", "/me", { como: novo });

    const igual = await amb.req("POST", "/auth/trocar-senha", { como: novo, json: { senha_atual: "senha-inicial-1", senha_nova: "senha-inicial-1" } });
    assert.equal(igual.status, 422);
    const errada = await amb.req("POST", "/auth/trocar-senha", { como: novo, json: { senha_atual: "errada-errada", senha_nova: "outra-senha-9" } });
    assert.equal(errada.status, 422);
    assert.equal(errada.corpo.erro.codigo, "senha_atual_incorreta");
    await amb.esperar(200, "POST", "/auth/trocar-senha", { como: novo, json: { senha_atual: "senha-inicial-1", senha_nova: "outra-senha-9" } });

    // Cadastrado pelo admin e liberado, sem assinatura: ela vem antes de qualquer outra coisa (só ler o perfil e cadastrá-la passam).
    const semAssinatura = await amb.req("GET", "/equipes", { como: novo });
    assert.equal(semAssinatura.status, 403);
    assert.equal(semAssinatura.corpo.erro.codigo, "assinatura_pendente");
    await amb.esperar(200, "GET", "/me", { como: novo });
    await amb.cadastrarAssinatura(novo);
    await amb.esperar(200, "GET", "/equipes", { como: novo });
    assert.equal((await amb.req("POST", "/auth/login", { json: { email: "maria.souza@empresa.com.br", senha: "senha-inicial-1" } })).status, 401);
    const de_novo = await amb.esperar(200, "POST", "/auth/login", { json: { email: "Maria.Souza@empresa.com.br", senha: "outra-senha-9" } });
    assert.equal(de_novo.senha_provisoria, false);
  });

  it("login: e-mail não cadastrado é `usuario_inexistente`, senha errada é `senha_incorreta` (ambos 401); a matrícula não é login", async () => {
    const semUsuario = await amb.req("POST", "/auth/login", { json: { email: "nao.existe@empresa.com.br", senha: "x" } });
    assert.equal(semUsuario.status, 401);
    assert.equal(semUsuario.corpo.erro.codigo, "usuario_inexistente");
    const senhaErrada = await amb.req("POST", "/auth/login", { json: { email: tecnico.email, senha: "nao-e-essa" } });
    assert.equal(senhaErrada.status, 401);
    assert.equal(senhaErrada.corpo.erro.codigo, "senha_incorreta");
    assert.equal((await amb.req("POST", "/auth/login", { json: { email: tecnico.matricula, senha: SENHA_PADRAO } })).status, 422);
  });

  it("PATCH /usuarios: nome, e-mail, cargo e registro profissional não se editam (vêm do registro de funcionários)", async () => {
    const alvo = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    for (const campo of [{ nome: "Outro Nome" }, { email: "outro@empresa.com.br" }, { cargo: "Chefe" }, { registro_profissional: "CREA 1" }]) {
      const r = await amb.req("PATCH", `/usuarios/${alvo.id}`, { como: admin, json: campo });
      assert.equal(r.status, 422, JSON.stringify(campo));
      assert.equal(r.corpo.erro.codigo, "validacao");
    }
    await amb.esperar(200, "PATCH", `/usuarios/${alvo.id}`, { como: admin, json: { perfil: "tecnico", equipe_id: equipeId } });
  });

  it("POST /usuarios/{id}/atualizar-do-registro: copia os dados do registro; trocar o e-mail muda o login e mantém a senha; só o admin", async () => {
    const alvo = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    const novo = `${alvo.matricula.toLowerCase()}.novo@empresa.com.br`;
    amb.registrarFuncionario({ matricula: alvo.matricula, nome: "Nome Atualizado", email: novo, cargo: "Eletricista", registro_profissional: "CREA ES-050003/D" });
    assert.equal((await amb.req("POST", `/usuarios/${alvo.id}/atualizar-do-registro`, { como: tecnico })).status, 403);
    assert.equal((await amb.req("POST", `/usuarios/${crypto.randomUUID()}/atualizar-do-registro`, { como: admin })).status, 404);

    const r = await amb.esperar(200, "POST", `/usuarios/${alvo.id}/atualizar-do-registro`, { como: admin });
    assert.equal(r.situacao_registro, "ativo");
    assert.equal(r.atualizado, true);
    assert.equal(r.desativado, false);
    const { usuario } = await amb.esperar(200, "GET", `/usuarios/${alvo.id}`, { como: admin });
    assert.equal(usuario.nome, "Nome Atualizado");
    assert.equal(usuario.cargo, "Eletricista");
    assert.equal(usuario.registro_profissional, "CREA ES-050003/D");
    assert.equal((await amb.req("POST", "/auth/login", { json: { email: alvo.email, senha: SENHA_PADRAO } })).status, 401);
    const login = await amb.esperar(200, "POST", "/auth/login", { json: { email: novo, senha: SENHA_PADRAO } });
    assert.equal(login.usuario.email, novo);

    // Registro fora do ar: 503 e nada muda.
    amb.rh.falhar = true;
    assert.equal((await amb.req("POST", `/usuarios/${alvo.id}/atualizar-do-registro`, { como: admin })).status, 503);
    amb.rh.falhar = false;
  });

  it("DELETE /usuarios: só o admin remove; some do banco e do login; não remove a si mesmo", async () => {
    const alvo = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    assert.equal((await amb.req("DELETE", `/usuarios/${alvo.id}`, { como: tecnico })).status, 403);
    assert.equal((await amb.req("DELETE", `/usuarios/${admin.id}`, { como: admin })).status, 422);
    assert.equal((await amb.req("DELETE", `/usuarios/${crypto.randomUUID()}`, { como: admin })).status, 404);

    await amb.esperar(200, "DELETE", `/usuarios/${alvo.id}`, { como: admin });
    const lista = await amb.esperar(200, "GET", "/usuarios", { como: admin, consulta: { tamanho: 200 } });
    assert.ok(!lista.usuarios.some((u: any) => u.id === alvo.id));
    const login = await amb.req("POST", "/auth/login", { json: { email: alvo.email, senha: SENHA_PADRAO } });
    assert.equal(login.corpo.erro.codigo, "usuario_inexistente");
    assert.equal(await amb.auth.entrar(alvo.email, SENHA_PADRAO), null, "a conta de acesso também foi removida");
  });

  it("DELETE /usuarios: quem já tem histórico (supervisor de equipe) não é removido: 409 e continua cadastrado", async () => {
    const equipe = await amb.criarEquipe();
    const sup = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipe.id });
    await amb.esperar(200, "PATCH", `/equipes/${equipe.id}`, { como: admin, json: { supervisor_id: sup.id } });
    const r = await amb.req("DELETE", `/usuarios/${sup.id}`, { como: admin });
    assert.equal(r.status, 409);
    assert.equal(r.corpo.erro.codigo, "usuario_com_historico");
    await amb.esperar(200, "POST", "/auth/login", { json: { email: sup.email, senha: SENHA_PADRAO } });
  });

  it("refresh devolve novo token", async () => {
    const login = await amb.esperar(200, "POST", "/auth/login", { json: { email: tecnico.email, senha: SENHA_PADRAO } });
    const novo = await amb.esperar(200, "POST", "/auth/refresh", { json: { refresh_token: login.refresh_token } });
    assert.ok(novo.access_token);
    assert.equal((await amb.req("POST", "/auth/refresh", { json: { refresh_token: "invalido" } })).status, 401);
  });

  it("GET /me devolve usuário e equipe; respostas em snake_case", async () => {
    const eu = await amb.esperar(200, "GET", "/me", { como: tecnico });
    assert.equal(eu.usuario.id, tecnico.id);
    assert.equal(eu.usuario.equipe_id, equipeId);
    assert.equal(eu.equipe.id, equipeId);
    assert.ok("centro_trabalho" in eu.equipe);
    assert.deepEqual(eu.equipes_supervisionadas, []);
  });

  it("admin cria e edita equipes; centro de trabalho repetido é 409; supervisor é qualquer usuário ativo, de qualquer perfil", async () => {
    const criada = await amb.esperar(201, "POST", "/equipes", { como: admin, json: { nome: "Instrumentação", centro_trabalho: "INSTR" } });
    const dup = await amb.req("POST", "/equipes", { como: admin, json: { nome: "Outra", centro_trabalho: "INSTR" } });
    assert.equal(dup.status, 409);
    assert.equal((await amb.req("POST", "/equipes", { como: tecnico, json: { nome: "X", centro_trabalho: "X" } })).status, 403);

    const inativo = await amb.criarUsuario({ perfil: "tecnico", ativo: false });
    assert.equal((await amb.req("PATCH", `/equipes/${criada.id}`, { como: admin, json: { supervisor_id: inativo.id } })).status, 422);
    assert.equal((await amb.req("PATCH", `/equipes/${criada.id}`, { como: admin, json: { supervisor_id: "nao-e-uuid" } })).status, 422);
    const sup = await amb.criarUsuario({ perfil: "tecnico", equipeId: criada.id });
    await amb.esperar(200, "PATCH", `/equipes/${criada.id}`, { como: admin, json: { nome: "Instrumentação 2", supervisor_id: sup.id } });
    const lista = await amb.esperar(200, "GET", "/equipes", { como: tecnico });
    const e = lista.equipes.find((x: any) => x.id === criada.id);
    assert.equal(e.nome, "Instrumentação 2");
    assert.equal(e.supervisor_id, sup.id);
    assert.equal((await amb.req("PATCH", `/equipes/nao-e-uuid`, { como: admin, json: {} })).status, 404);
  });

  it("GET /usuarios: admin filtra e pagina; técnico vê só colegas ativos, sem e-mail", async () => {
    const colega = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Colega" });
    await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Inativo", ativo: false });
    const outraEquipe = await amb.criarEquipe();
    await amb.criarUsuario({ perfil: "tecnico", equipeId: outraEquipe.id, nome: "De fora" });

    const doAdmin = await amb.esperar(200, "GET", "/usuarios", { como: admin, consulta: { equipe_id: equipeId, ativo: false } });
    assert.deepEqual(doAdmin.usuarios.map((u: any) => u.nome), ["Inativo"]);
    const pag = await amb.esperar(200, "GET", "/usuarios", { como: admin, consulta: { tamanho: 2, pagina: 1 } });
    assert.equal(pag.usuarios.length, 2);
    assert.ok(pag.total > 2);

    const doTecnico = await amb.esperar(200, "GET", "/usuarios", { como: tecnico, consulta: { equipe_id: outraEquipe.id } });
    const nomes = doTecnico.usuarios.map((u: any) => u.nome);
    assert.ok(nomes.includes("Colega") && !nomes.includes("Inativo") && !nomes.includes("De fora"));
    assert.ok(doTecnico.usuarios.every((u: any) => !("email" in u)));
    assert.ok(colega.id);
  });

  it("GET /usuarios?busca: acha por nome, matrícula ou e-mail (o técnico também, sem receber o e-mail) e respeita o escopo do técnico", async () => {
    const alvo = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Zeferino Buscável" });
    const porNome = await amb.esperar(200, "GET", "/usuarios", { como: admin, consulta: { busca: "zeferino" } });
    assert.deepEqual(porNome.usuarios.map((u: any) => u.id), [alvo.id]);
    const porMatricula = await amb.esperar(200, "GET", "/usuarios", { como: admin, consulta: { busca: alvo.matricula } });
    assert.ok(porMatricula.usuarios.some((u: any) => u.id === alvo.id));
    const porEmail = await amb.esperar(200, "GET", "/usuarios", { como: admin, consulta: { busca: alvo.email } });
    assert.ok(porEmail.usuarios.some((u: any) => u.id === alvo.id));
    // o curinga do ilike não vaza: "%" é buscado como texto
    assert.equal((await amb.esperar(200, "GET", "/usuarios", { como: admin, consulta: { busca: "%" } })).usuarios.length, 0);
    // o técnico acha o colega pelo e-mail, mas a resposta continua sem e-mail
    const doTecnico = await amb.esperar(200, "GET", "/usuarios", { como: tecnico, consulta: { busca: alvo.email } });
    assert.deepEqual(doTecnico.usuarios.map((u: any) => u.id), [alvo.id]);
    assert.ok(!("email" in doTecnico.usuarios[0]));
    // de outra equipe, nem pelo e-mail
    const deFora = await amb.criarUsuario({ perfil: "tecnico", equipeId: (await amb.criarEquipe()).id });
    assert.equal((await amb.esperar(200, "GET", "/usuarios", { como: tecnico, consulta: { busca: deFora.email } })).usuarios.length, 0);
  });

  it("GET /usuarios/{id}: perfil com equipe e membros; e-mail e contas inativas só para o admin; fora do escopo é 404", async () => {
    const colega = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Colega de Perfil" });
    const inativo = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Perfil Inativo", ativo: false });
    const outraEquipe = await amb.criarEquipe();
    const de_fora = await amb.criarUsuario({ perfil: "tecnico", equipeId: outraEquipe.id, nome: "Perfil de Fora" });

    const doAdmin = await amb.esperar(200, "GET", `/usuarios/${colega.id}`, { como: admin });
    assert.equal(doAdmin.usuario.id, colega.id);
    assert.ok(doAdmin.usuario.email);
    assert.equal(doAdmin.equipe.id, equipeId);
    assert.ok(doAdmin.membros.some((m: any) => m.id === colega.id));
    assert.ok(Array.isArray(doAdmin.execucoes));
    assert.equal(doAdmin.resumo.os_encerradas, 0);
    await amb.esperar(200, "GET", `/usuarios/${inativo.id}`, { como: admin });

    const doTecnico = await amb.esperar(200, "GET", `/usuarios/${colega.id}`, { como: tecnico });
    assert.ok(!("email" in doTecnico.usuario));
    // O desempenho de um colega (OS encerradas, tempo) não aparece para um técnico comum; o dele mesmo, sim.
    assert.equal(doTecnico.resumo, null);
    assert.deepEqual(doTecnico.execucoes, []);
    assert.ok((await amb.esperar(200, "GET", `/usuarios/${tecnico.id}`, { como: tecnico })).resumo);
    assert.equal((await amb.req("GET", `/usuarios/${inativo.id}`, { como: tecnico })).status, 404);
    assert.equal((await amb.req("GET", `/usuarios/${de_fora.id}`, { como: tecnico })).status, 404);
    assert.equal((await amb.req("GET", `/usuarios/${crypto.randomUUID()}`, { como: admin })).status, 404);
  });

  it("GET /equipes/{id}: perfil da equipe com supervisor, membros e OS; técnico de outra equipe leva 404", async () => {
    const outra = await amb.criarEquipe();
    const dela = await amb.criarUsuario({ perfil: "tecnico", equipeId: outra.id, nome: "Membro da Outra" });
    const inativo = await amb.criarUsuario({ perfil: "tecnico", equipeId: outra.id, nome: "Membro Inativo", ativo: false });

    const doAdmin = await amb.esperar(200, "GET", `/equipes/${outra.id}`, { como: admin });
    assert.equal(doAdmin.equipe.id, outra.id);
    const idsDoAdmin = doAdmin.membros.map((m: any) => m.id);
    assert.ok(idsDoAdmin.includes(dela.id) && idsDoAdmin.includes(inativo.id));
    assert.ok(Array.isArray(doAdmin.os_recentes));
    assert.equal(typeof doAdmin.total_os, "number");
    assert.ok("liberada" in doAdmin.contagem_por_status);

    const propria = await amb.esperar(200, "GET", `/equipes/${equipeId}`, { como: tecnico });
    assert.equal(propria.equipe.id, equipeId);
    assert.equal((await amb.req("GET", `/equipes/${outra.id}`, { como: tecnico })).status, 404);
    assert.equal((await amb.req("GET", `/equipes/${crypto.randomUUID()}`, { como: admin })).status, 404);
  });

  it("GET /equipes?busca: acha por nome ou centro de trabalho, com membros; técnico só vê a própria equipe", async () => {
    const [propria] = (await amb.esperar(200, "GET", "/equipes", { como: admin, consulta: { tamanho: 200 } })).equipes.filter((e: any) => e.id === equipeId);
    const doAdmin = await amb.esperar(200, "GET", "/equipes", { como: admin, consulta: { busca: propria.nome } });
    const achada = doAdmin.equipes.find((e: any) => e.id === equipeId);
    assert.ok(achada);
    assert.equal(typeof achada.total_membros, "number");
    assert.ok("supervisor_nome" in achada);
    const porCentro = await amb.esperar(200, "GET", "/equipes", { como: admin, consulta: { busca: propria.centro_trabalho } });
    assert.ok(porCentro.equipes.some((e: any) => e.id === equipeId));
    assert.equal((await amb.esperar(200, "GET", "/equipes", { como: admin, consulta: { busca: "%" } })).equipes.length, 0);

    const doTecnico = await amb.esperar(200, "GET", "/equipes", { como: tecnico, consulta: { busca: propria.nome } });
    assert.deepEqual(doTecnico.equipes.map((e: any) => e.id), [equipeId]);
    const outra = await amb.criarEquipe();
    const semAcesso = await amb.esperar(200, "GET", "/equipes", { como: tecnico, consulta: { busca: outra.nome } });
    assert.equal(semAcesso.equipes.length, 0);

    // sem texto: `global=true` lista no modo da busca, e `id` restringe a uma equipe
    const lista = await amb.esperar(200, "GET", "/equipes", { como: admin, consulta: { global: true, id: equipeId } });
    assert.deepEqual(lista.equipes.map((e: any) => e.id), [equipeId]);
    const doTecnicoSemTexto = await amb.esperar(200, "GET", "/equipes", { como: tecnico, consulta: { global: true } });
    assert.deepEqual(doTecnicoSemTexto.equipes.map((e: any) => e.id), [equipeId]);
  });

  it("PATCH /usuarios: desativado perde o acesso na hora; admin não desativa a si mesmo; reativar restaura", async () => {
    const alvo = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    await amb.esperar(200, "GET", "/equipes", { como: alvo });
    await amb.esperar(200, "PATCH", `/usuarios/${alvo.id}`, { como: admin, json: { ativo: false } });
    const r = await amb.req("GET", "/equipes", { como: alvo });
    assert.equal(r.status, 401);
    assert.equal(r.corpo.erro.codigo, "acesso_revogado");
    assert.equal((await amb.req("POST", "/auth/login", { json: { email: alvo.email, senha: SENHA_PADRAO } })).status, 401);

    assert.equal((await amb.req("PATCH", `/usuarios/${admin.id}`, { como: admin, json: { ativo: false } })).status, 422);
    // Reativar consulta o registro: só vale se a pessoa está ativa lá.
    amb.registrarFuncionario({ matricula: alvo.matricula });
    await amb.esperar(200, "PATCH", `/usuarios/${alvo.id}`, { como: admin, json: { ativo: true } });
    await amb.esperar(200, "GET", "/equipes", { como: alvo });
    assert.equal((await amb.req("PATCH", `/usuarios/${crypto.randomUUID()}`, { como: admin, json: { perfil: "tecnico" } })).status, 404);
  });

  it("redefinir senha gera nova senha inicial e exige troca", async () => {
    const alvo = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    const { senha_inicial } = await amb.esperar(200, "POST", `/usuarios/${alvo.id}/redefinir-senha`, { como: admin });
    assert.ok(senha_inicial.length >= 8);
    assert.equal((await amb.req("POST", "/auth/login", { json: { email: alvo.email, senha: SENHA_PADRAO } })).status, 401);
    const login = await amb.esperar(200, "POST", "/auth/login", { json: { email: alvo.email, senha: senha_inicial } });
    assert.equal(login.senha_provisoria, true);
    assert.equal((await amb.req("POST", `/usuarios/${alvo.id}/redefinir-senha`, { como: tecnico })).status, 403);
  });

  it("arquivos: envio idempotente, conteúdo diferente com o mesmo id é 409, validações de tipo", async () => {
    const id = crypto.randomUUID();
    const form = (conteudo: string, tipo = "foto") => {
      const f = new FormData();
      f.set("arquivo", arquivoDeImagem(conteudo));
      f.set("tipo", tipo);
      return f;
    };
    const ok = await amb.esperar(200, "PUT", `/arquivos/${id}`, { como: tecnico, form: form("conteudo") });
    assert.equal(ok.id, id);
    await amb.esperar(200, "PUT", `/arquivos/${id}`, { como: tecnico, form: form("conteudo") });
    assert.equal((await amb.req("PUT", `/arquivos/${id}`, { como: tecnico, form: form("outro conteudo") })).status, 409);
    assert.equal((await amb.req("PUT", `/arquivos/${crypto.randomUUID()}`, { como: tecnico, form: form("x", "pdf") })).status, 422);
    assert.equal((await amb.req("PUT", `/arquivos/${crypto.randomUUID()}`, { como: tecnico })).status, 422);
    assert.equal((await amb.req("PUT", `/arquivos/${id}`, { form: form("conteudo") })).status, 401);
  });

  it("assinatura do perfil: exige o arquivo enviado; GET /arquivos/{id}/url respeita a equipe", async () => {
    const id = crypto.randomUUID();
    assert.equal((await amb.req("PUT", "/me/assinatura", { como: tecnico, json: { arquivo_id: id } })).status, 422);
    const f = new FormData();
    f.set("arquivo", arquivoDeImagem("rubrica"));
    f.set("tipo", "assinatura");
    await amb.esperar(200, "PUT", `/arquivos/${id}`, { como: tecnico, form: f });
    await amb.esperar(200, "PUT", "/me/assinatura", { como: tecnico, json: { arquivo_id: id } });

    const url = await amb.esperar(200, "GET", `/arquivos/${id}/url`, { como: tecnico });
    assert.match(url.url, /assinaturas/);
    const outraEquipe = await amb.criarEquipe();
    const intruso = await amb.criarUsuario({ perfil: "tecnico", equipeId: outraEquipe.id });
    assert.equal((await amb.req("GET", `/arquivos/${id}/url`, { como: intruso })).status, 403);
    await amb.esperar(200, "GET", `/arquivos/${id}/url`, { como: admin });
    assert.equal((await amb.req("GET", `/arquivos/${crypto.randomUUID()}/url`, { como: admin })).status, 404);
  });

  it("rota inexistente devolve o formato de erro padrão", async () => {
    const r = await amb.req("GET", "/nao-existe");
    assert.equal(r.status, 404);
    assert.equal(r.corpo.erro.codigo, "rota_inexistente");
  });
});
