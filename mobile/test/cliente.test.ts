import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { criarClienteApi, type ArmazemDeTokens, type Tokens } from "../src/api/cliente";
import { ErroDaApi, ErroDeRede, encerraASessao, mensagemDoErro } from "../src/api/erros";

const AGORA = Date.parse("2026-10-19T12:00:00Z");
const DEPOIS = "2026-10-19T13:00:00Z";
const ANTES = "2026-10-19T11:00:00Z";

function armazemEmMemoria(inicial: Tokens | null) {
  let tokens = inicial;
  const armazem: ArmazemDeTokens = {
    async ler() {
      return tokens;
    },
    async gravar(t) {
      tokens = t;
    },
    async apagar() {
      tokens = null;
    },
  };
  return { armazem, atual: () => tokens };
}

const json = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

interface Chamada {
  url: string;
  metodo: string;
  autorizacao: string | null;
  corpo: string | null;
}

/** `fetch` falso: cada chamada responde o próximo item da fila (uma função recebe a chamada; um `Error` simula a falta de rede). */
function fetchFalso(respostas: (Response | Error | ((c: Chamada) => Response))[]) {
  const chamadas: Chamada[] = [];
  const fn = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const cabecalhos = new Headers(init?.headers);
    const chamada: Chamada = { url: String(entrada), metodo: init?.method ?? "GET", autorizacao: cabecalhos.get("Authorization"), corpo: typeof init?.body === "string" ? init.body : null };
    chamadas.push(chamada);
    const proxima = respostas.shift();
    if (!proxima) throw new Error(`chamada inesperada: ${chamada.metodo} ${chamada.url}`);
    if (proxima instanceof Error) throw proxima;
    return typeof proxima === "function" ? proxima(chamada) : proxima;
  }) as typeof fetch;
  return { fn, chamadas };
}

const valido: Tokens = { accessToken: "AT1", refreshToken: "RT1", expiraEm: DEPOIS };
const renovado = { access_token: "AT2", refresh_token: "RT2", expira_em: "2026-10-19T14:00:00Z" };

function cliente(tokens: Tokens | null, respostas: Parameters<typeof fetchFalso>[0], extra: { aoSessaoEncerrada?: () => void } = {}) {
  const mem = armazemEmMemoria(tokens);
  const f = fetchFalso(respostas);
  const c = criarClienteApi({ urlBase: "http://api.local:3333/", armazem: mem.armazem, fetch: f.fn, agora: () => AGORA, ...extra });
  return { c, mem, f };
}

describe("cliente da api", () => {
  it("manda o Bearer, monta a query sem valores vazios e devolve o JSON", async () => {
    const { c, f } = cliente(valido, [json(200, { os: [], total: 0 })]);
    const r = await c.chamar<{ total: number }>("/os", { consulta: { busca: "bomba", status: undefined, pagina: 2, vazio: "" } });
    assert.equal(r.total, 0);
    assert.equal(f.chamadas[0]!.url, "http://api.local:3333/os?busca=bomba&pagina=2");
    assert.equal(f.chamadas[0]!.autorizacao, "Bearer AT1");
  });

  it("envia o corpo como JSON com POST quando há corpo", async () => {
    const { c, f } = cliente(valido, [json(200, {})]);
    await c.chamar("/auth/trocar-senha", { corpo: { senha_atual: "a", senha_nova: "b" } });
    assert.equal(f.chamadas[0]!.metodo, "POST");
    assert.deepEqual(JSON.parse(f.chamadas[0]!.corpo!), { senha_atual: "a", senha_nova: "b" });
  });

  it("com o token vencido (401) renova sozinho, guarda os novos tokens e repete a chamada", async () => {
    const { c, mem, f } = cliente(valido, [json(401, { erro: { codigo: "nao_autenticado", mensagem: "Token expirado" } }), json(200, renovado), json(200, { ok: true })]);
    const r = await c.chamar<{ ok: boolean }>("/me");
    assert.equal(r.ok, true);
    assert.deepEqual(
      f.chamadas.map((x) => `${x.metodo} ${x.url.replace("http://api.local:3333", "")} ${x.autorizacao ?? "-"}`),
      ["GET /me Bearer AT1", "POST /auth/refresh -", "GET /me Bearer AT2"],
    );
    assert.deepEqual(JSON.parse(f.chamadas[1]!.corpo!), { refresh_token: "RT1" });
    assert.deepEqual(mem.atual(), { accessToken: "AT2", refreshToken: "RT2", expiraEm: "2026-10-19T14:00:00Z" });
  });

  it("renova antes de chamar quando o token vence em menos de 30 s", async () => {
    const { c, f } = cliente({ ...valido, expiraEm: "2026-10-19T12:00:10Z" }, [json(200, renovado), json(200, {})]);
    await c.chamar("/me");
    assert.equal(f.chamadas[0]!.url.endsWith("/auth/refresh"), true);
    assert.equal(f.chamadas[1]!.autorizacao, "Bearer AT2");
  });

  it("várias chamadas ao mesmo tempo com o token vencido fazem uma só renovação", async () => {
    const { c, f } = cliente({ ...valido, expiraEm: ANTES }, [json(200, renovado), json(200, { n: 1 }), json(200, { n: 2 }), json(200, { n: 3 })]);
    await Promise.all([c.chamar("/os"), c.chamar("/me"), c.chamar("/me/aprs-para-assinar")]);
    assert.equal(f.chamadas.filter((x) => x.url.endsWith("/auth/refresh")).length, 1);
  });

  it("renovação recusada apaga os tokens, avisa o app e lança nao_autenticado", async () => {
    let avisos = 0;
    const { c, mem } = cliente(valido, [json(401, { erro: { codigo: "nao_autenticado", mensagem: "x" } }), json(401, { erro: { codigo: "nao_autenticado", mensagem: "Sessão inválida ou expirada" } })], { aoSessaoEncerrada: () => avisos++ });
    await assert.rejects(c.chamar("/me"), (e: unknown) => e instanceof ErroDaApi && e.codigo === "nao_autenticado");
    assert.equal(mem.atual(), null);
    assert.equal(avisos, 1);
  });

  it("sem sinal na renovação mantém os tokens (o login sem sinal e a fila precisam deles) e lança ErroDeRede", async () => {
    const { c, mem } = cliente(valido, [json(401, { erro: { codigo: "nao_autenticado", mensagem: "x" } }), new Error("Network request failed")]);
    await assert.rejects(c.chamar("/me"), ErroDeRede);
    assert.deepEqual(mem.atual(), valido);
  });

  it("erro 5xx na renovação não derruba a sessão", async () => {
    const { c, mem } = cliente(valido, [json(401, { erro: { codigo: "nao_autenticado", mensagem: "x" } }), json(503, { erro: { codigo: "indisponivel", mensagem: "Servidor ocupado" } })]);
    await assert.rejects(c.chamar("/me"), (e: unknown) => e instanceof ErroDaApi && e.status === 503);
    assert.deepEqual(mem.atual(), valido);
  });

  it("o erro da api vira ErroDaApi com código, mensagem e os campos a mais", async () => {
    const { c } = cliente(valido, [json(403, { erro: { codigo: "usuario_ausente", mensagem: "Você está ausente até 25/10/2026: o sistema fica só para consulta", retorno: "2026-10-25" } })]);
    await assert.rejects(c.chamar("/eventos", { corpo: {} }), (e: unknown) => {
      assert.ok(e instanceof ErroDaApi);
      assert.equal(e.status, 403);
      assert.equal(e.codigo, "usuario_ausente");
      assert.equal(e.detalhes.retorno, "2026-10-25");
      assert.match(mensagemDoErro(e), /ausente até 25\/10\/2026/);
      return true;
    });
  });

  it("falha do fetch (sem sinal) é ErroDeRede, com a mensagem em português", async () => {
    const { c } = cliente(valido, [new Error("Network request failed")]);
    await assert.rejects(c.chamar("/os"), (e: unknown) => e instanceof ErroDeRede && /Sem conexão/.test(e.message));
  });

  it("sem sessão nem chama a api: lança nao_autenticado", async () => {
    const { c, f } = cliente(null, []);
    await assert.rejects(c.chamar("/os"), (e: unknown) => e instanceof ErroDaApi && e.codigo === "nao_autenticado");
    assert.equal(f.chamadas.length, 0);
  });

  it("entrar guarda os tokens, normaliza o e-mail e devolve a senha provisória", async () => {
    const { c, mem, f } = cliente(null, [json(200, { access_token: "A", refresh_token: "R", expira_em: DEPOIS, usuario: { id: "u1" }, senha_provisoria: true })]);
    const r = await c.entrar("  Maria.Silva@Empresa.com.br ", "segredo");
    assert.equal(r.senhaProvisoria, true);
    assert.deepEqual(mem.atual(), { accessToken: "A", refreshToken: "R", expiraEm: DEPOIS });
    assert.equal(f.chamadas[0]!.autorizacao, null);
    assert.deepEqual(JSON.parse(f.chamadas[0]!.corpo!), { email: "maria.silva@empresa.com.br", senha: "segredo" });
  });

  it("senha errada no login mostra a mensagem da api e não guarda nada", async () => {
    const { c, mem } = cliente(null, [json(401, { erro: { codigo: "senha_incorreta", mensagem: "Senha incorreta" } })]);
    await assert.rejects(c.entrar("a@b.com", "x"), (e: unknown) => e instanceof ErroDaApi && mensagemDoErro(e) === "Senha incorreta");
    assert.equal(mem.atual(), null);
  });

  it("sair apaga os tokens mesmo com a api fora do ar", async () => {
    const { c, mem } = cliente(valido, [new Error("Network request failed")]);
    await c.sair();
    assert.equal(mem.atual(), null);
    assert.equal(await c.temSessao(), false);
  });

  it("encerraASessao reconhece os códigos que mandam o app para a entrada", () => {
    assert.equal(encerraASessao(new ErroDaApi(401, "nao_autenticado", "x")), true);
    assert.equal(encerraASessao(new ErroDaApi(401, "acesso_revogado", "x")), true);
    assert.equal(encerraASessao(new ErroDaApi(403, "assinatura_pendente", "x")), false);
    assert.equal(encerraASessao(new ErroDeRede()), false);
  });
});
