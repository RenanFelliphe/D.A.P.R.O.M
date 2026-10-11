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

  it("recusa perfil sem permissão (403) e aceita o admin", async () => {
    const corpo = { nome: "Maria", matricula: "M900", perfil: "tecnico", senha_inicial: "senha-inicial-1" };
    assert.equal((await amb.req("POST", "/usuarios", { como: tecnico, json: corpo })).status, 403);
    const criado = await amb.esperar(201, "POST", "/usuarios", { como: admin, json: corpo });
    assert.match(criado.id, /^[0-9a-f-]{36}$/);
  });

  it("matrícula repetida é 409, sem diferenciar maiúsculas", async () => {
    const r = await amb.req("POST", "/usuarios", {
      como: admin,
      json: { nome: "Outra", matricula: "m900", perfil: "tecnico", senha_inicial: "senha-inicial-1" },
    });
    assert.equal(r.status, 409);
    assert.equal(r.corpo.erro.codigo, "matricula_duplicada");
    assert.equal(r.corpo.erro.mensagem, "Matrícula já cadastrada");
  });

  it("valida o corpo: supervisor sem e-mail e matrícula com caracteres inválidos", async () => {
    const semEmail = await amb.req("POST", "/usuarios", { como: admin, json: { nome: "S", matricula: "S1", perfil: "supervisor", senha_inicial: "senha-inicial-1" } });
    assert.equal(semEmail.status, 422);
    const ruim = await amb.req("POST", "/usuarios", { como: admin, json: { nome: "S", matricula: "a b@c", perfil: "tecnico", senha_inicial: "senha-inicial-1" } });
    assert.equal(ruim.status, 422);
    assert.equal(ruim.corpo.erro.codigo, "validacao");
  });

  it("primeiro login com senha inicial: entra, mas só troca a senha", async () => {
    const login = await amb.esperar(200, "POST", "/auth/login", { json: { matricula: "M900", senha: "senha-inicial-1" } });
    assert.equal(login.senha_provisoria, true);
    assert.equal(login.usuario.matricula, "M900");
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

    await amb.esperar(200, "GET", "/equipes", { como: novo });
    assert.equal((await amb.req("POST", "/auth/login", { json: { matricula: "M900", senha: "senha-inicial-1" } })).status, 401);
    const de_novo = await amb.esperar(200, "POST", "/auth/login", { json: { matricula: "m900", senha: "outra-senha-9" } });
    assert.equal(de_novo.senha_provisoria, false);
  });

  it("login com senha errada ou matrícula desconhecida é 401 com a mesma mensagem", async () => {
    const a = await amb.req("POST", "/auth/login", { json: { matricula: tecnico.matricula, senha: "nao-e-essa" } });
    const b = await amb.req("POST", "/auth/login", { json: { matricula: "naoexiste", senha: "x" } });
    assert.equal(a.status, 401);
    assert.deepEqual(a.corpo, b.corpo);
  });

  it("refresh devolve novo token", async () => {
    const login = await amb.esperar(200, "POST", "/auth/login", { json: { matricula: tecnico.matricula, senha: SENHA_PADRAO } });
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
  });

  it("admin cria e edita equipes; centro de trabalho repetido é 409; supervisor precisa ter perfil supervisor", async () => {
    const criada = await amb.esperar(201, "POST", "/equipes", { como: admin, json: { nome: "Instrumentação", centro_trabalho: "INSTR" } });
    const dup = await amb.req("POST", "/equipes", { como: admin, json: { nome: "Outra", centro_trabalho: "INSTR" } });
    assert.equal(dup.status, 409);
    assert.equal((await amb.req("POST", "/equipes", { como: tecnico, json: { nome: "X", centro_trabalho: "X" } })).status, 403);

    const naoSupervisor = await amb.req("PATCH", `/equipes/${criada.id}`, { como: admin, json: { supervisor_id: tecnico.id } });
    assert.equal(naoSupervisor.status, 422);
    const sup = await amb.criarUsuario({ perfil: "supervisor", equipeId: criada.id });
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

  it("PATCH /usuarios: desativado perde o acesso na hora; admin não desativa a si mesmo; reativar restaura", async () => {
    const alvo = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    await amb.esperar(200, "GET", "/equipes", { como: alvo });
    await amb.esperar(200, "PATCH", `/usuarios/${alvo.id}`, { como: admin, json: { ativo: false } });
    const r = await amb.req("GET", "/equipes", { como: alvo });
    assert.equal(r.status, 401);
    assert.equal(r.corpo.erro.codigo, "acesso_revogado");
    assert.equal((await amb.req("POST", "/auth/login", { json: { matricula: alvo.matricula, senha: SENHA_PADRAO } })).status, 401);

    assert.equal((await amb.req("PATCH", `/usuarios/${admin.id}`, { como: admin, json: { ativo: false } })).status, 422);
    await amb.esperar(200, "PATCH", `/usuarios/${alvo.id}`, { como: admin, json: { ativo: true, nome: "Reativado" } });
    await amb.esperar(200, "GET", "/equipes", { como: alvo });
    assert.equal((await amb.req("PATCH", `/usuarios/${crypto.randomUUID()}`, { como: admin, json: { nome: "x" } })).status, 404);
  });

  it("redefinir senha gera nova senha inicial e exige troca", async () => {
    const alvo = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    const { senha_inicial } = await amb.esperar(200, "POST", `/usuarios/${alvo.id}/redefinir-senha`, { como: admin });
    assert.ok(senha_inicial.length >= 8);
    assert.equal((await amb.req("POST", "/auth/login", { json: { matricula: alvo.matricula, senha: SENHA_PADRAO } })).status, 401);
    const login = await amb.esperar(200, "POST", "/auth/login", { json: { matricula: alvo.matricula, senha: senha_inicial } });
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
