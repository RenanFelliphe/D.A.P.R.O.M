import assert from "node:assert/strict";
import { pbkdf2Sync } from "node:crypto";
import { describe, it } from "node:test";
import type { RespostaMe } from "@shared/api/tipos";
import { criarClienteApi, type ArmazemDeTokens, type Tokens } from "../src/api/cliente";
import { ErroDaApi, ErroDeConexaoNecessaria, ErroDeRede } from "../src/api/erros";
import { definirUltimoUsuario, esquecerEu, guardarEu, lerEu } from "../src/offline/identidade";
import { faixaDaSincronizacao, rotuloDoIndicador } from "../src/offline/faixa";
import { criarCredenciais, mensagemDaEntradaSemSinal, type ArmazemDeTexto } from "../src/sessao/credenciais";
import { derivarSenha } from "../src/sessao/derivar-senha";
import { criarCarregadorDoEu, TEMPO_DO_ME_COM_COPIA_MS } from "../src/sessao/eu";
import { dentroDaJanela, JANELA_SEM_SINAL_MS } from "../src/sessao/janela";
import { mensagemDeSairComFila } from "../src/sessao/sair";
import { novoBancoDeTeste } from "./ajuda-offline";

const T0 = Date.parse("2026-10-19T12:00:00Z");
const dias = (n: number) => n * 86_400_000;

describe("janela de 7 dias sem sinal", () => {
  it("vale até 7 dias depois da confirmação e não depois", () => {
    const confirmado = new Date(T0).toISOString();
    assert.equal(dentroDaJanela(confirmado, new Date(T0)), true);
    assert.equal(dentroDaJanela(confirmado, new Date(T0 + dias(6))), true);
    assert.equal(dentroDaJanela(confirmado, new Date(T0 + JANELA_SEM_SINAL_MS)), true);
    assert.equal(dentroDaJanela(confirmado, new Date(T0 + JANELA_SEM_SINAL_MS + 1)), false);
  });
  it("relógio atrasado (a confirmação está no futuro) ou data ilegível não valem", () => {
    assert.equal(dentroDaJanela(new Date(T0 + dias(2)).toISOString(), new Date(T0)), false);
    assert.equal(dentroDaJanela(new Date(T0 + 30 * 60_000).toISOString(), new Date(T0)), true, "uma pequena diferença de relógio é tolerada");
    assert.equal(dentroDaJanela("ontem", new Date(T0)), false);
  });
});

describe("derivação da senha", () => {
  it("é o PBKDF2-HMAC-SHA256 padrão", async () => {
    const sal = "00112233445566778899aabbccddeeff";
    const esperado = pbkdf2Sync("synqos123", Buffer.from(sal, "hex"), 1000, 32, "sha256").toString("hex");
    assert.equal(await derivarSenha("synqos123", sal, 1000), esperado);
  });
  it("senhas com acento e espaço derivam diferente das parecidas", async () => {
    const sal = "ff".repeat(16);
    assert.notEqual(await derivarSenha("Coração 1", sal, 10), await derivarSenha("Coracao 1", sal, 10));
  });
});

function memoria(): ArmazemDeTexto & { texto(): string | null; gravacoes(): number } {
  let t: string | null = null;
  let gravacoes = 0;
  return {
    ler: async () => t,
    gravar: async (x) => {
      t = x;
      gravacoes++;
    },
    apagar: async () => void (t = null),
    texto: () => t,
    gravacoes: () => gravacoes,
  };
}

function credenciaisDeTeste(agora: { v: number }, armazem = memoria()) {
  let n = 0;
  const c = criarCredenciais({
    armazem,
    // A derivação de verdade, com poucas iterações (os testes não precisam do custo do aparelho).
    derivar: (senha, sal, it) => derivarSenha(senha, sal, it),
    novoSal: () => (++n).toString(16).padStart(32, "0"),
    agora: () => new Date(agora.v),
    iteracoes: 5,
  });
  return { c, armazem };
}

describe("credenciais do login sem sinal", () => {
  it("entra com o e-mail e a senha do último login com sinal", async () => {
    const agora = { v: T0 };
    const { c } = credenciaisDeTeste(agora);
    await c.guardar({ usuarioId: "u1", email: "Maria.Silva@empresa.com.br ", senha: "synqos123" });
    agora.v = T0 + dias(3);
    const r = await c.verificar("maria.silva@EMPRESA.com.br", "synqos123");
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.registro.usuarioId, "u1");
  });

  it("recusa a senha errada, o e-mail desconhecido e o que passou de 7 dias", async () => {
    const agora = { v: T0 };
    const { c } = credenciaisDeTeste(agora);
    await c.guardar({ usuarioId: "u1", email: "maria@empresa.com.br", senha: "synqos123" });
    assert.deepEqual(await c.verificar("maria@empresa.com.br", "outra-senha"), { ok: false, motivo: "senha" });
    assert.deepEqual(await c.verificar("joao@empresa.com.br", "synqos123"), { ok: false, motivo: "sem-registro" });
    agora.v = T0 + JANELA_SEM_SINAL_MS + 60_000;
    assert.deepEqual(await c.verificar("maria@empresa.com.br", "synqos123"), { ok: false, motivo: "vencido" });
  });

  it("guarda o hash, nunca a senha, e cada guarda usa um sal novo", async () => {
    const agora = { v: T0 };
    const { c, armazem } = credenciaisDeTeste(agora);
    await c.guardar({ usuarioId: "u1", email: "maria@empresa.com.br", senha: "synqos123" });
    const primeiro = await c.registroDe("u1");
    assert.ok(!armazem.texto()!.includes("synqos123"));
    await c.guardar({ usuarioId: "u1", email: "maria@empresa.com.br", senha: "synqos123" });
    const segundo = await c.registroDe("u1");
    assert.notEqual(primeiro!.sal, segundo!.sal);
    assert.notEqual(primeiro!.hash, segundo!.hash);
    assert.equal(primeiro!.hash.length, 64);
  });

  it("a senha trocada no app vale no lugar da antiga; a antiga deixa de entrar", async () => {
    const agora = { v: T0 };
    const { c } = credenciaisDeTeste(agora);
    await c.guardar({ usuarioId: "u1", email: "maria@empresa.com.br", senha: "senha-antiga" });
    await c.guardar({ usuarioId: "u1", email: "maria@empresa.com.br", senha: "senha-nova-1" });
    assert.equal((await c.verificar("maria@empresa.com.br", "senha-nova-1")).ok, true);
    assert.deepEqual(await c.verificar("maria@empresa.com.br", "senha-antiga"), { ok: false, motivo: "senha" });
  });

  it("cada pessoa tem o seu registro; esquecer uma não mexe na outra", async () => {
    const agora = { v: T0 };
    const { c } = credenciaisDeTeste(agora);
    await c.guardar({ usuarioId: "u1", email: "maria@empresa.com.br", senha: "senha-da-maria" });
    await c.guardar({ usuarioId: "u2", email: "joao@empresa.com.br", senha: "senha-do-joao" });
    assert.equal((await c.verificar("maria@empresa.com.br", "senha-da-maria")).ok, true);
    assert.equal((await c.verificar("joao@empresa.com.br", "senha-do-joao")).ok, true);
    await c.esquecer("u1");
    assert.deepEqual(await c.verificar("maria@empresa.com.br", "senha-da-maria"), { ok: false, motivo: "sem-registro" });
    assert.equal((await c.verificar("joao@empresa.com.br", "senha-do-joao")).ok, true);
  });

  it("o servidor confirmar a conta de novo recomeça os 7 dias", async () => {
    const agora = { v: T0 };
    const { c } = credenciaisDeTeste(agora);
    await c.guardar({ usuarioId: "u1", email: "maria@empresa.com.br", senha: "synqos123" });
    agora.v = T0 + dias(6);
    await c.confirmar("u1");
    agora.v = T0 + dias(12);
    assert.equal((await c.verificar("maria@empresa.com.br", "synqos123")).ok, true, "12 dias depois do primeiro login, mas 6 da última confirmação");
  });

  it("não regrava a cada confirmação (só depois de uma hora)", async () => {
    const agora = { v: T0 };
    const { c, armazem } = credenciaisDeTeste(agora);
    await c.guardar({ usuarioId: "u1", email: "maria@empresa.com.br", senha: "synqos123" });
    const antes = armazem.gravacoes();
    agora.v = T0 + 10 * 60_000;
    await c.confirmar("u1");
    assert.equal(armazem.gravacoes(), antes);
    agora.v = T0 + 2 * 3_600_000;
    await c.confirmar("u1");
    assert.equal(armazem.gravacoes(), antes + 1);
  });

  it("o registro vencido sai do armazenamento na gravação seguinte", async () => {
    const agora = { v: T0 };
    const { c, armazem } = credenciaisDeTeste(agora);
    await c.guardar({ usuarioId: "u1", email: "maria@empresa.com.br", senha: "synqos123" });
    agora.v = T0 + dias(20);
    await c.guardar({ usuarioId: "u2", email: "joao@empresa.com.br", senha: "outra-senha-1" });
    assert.ok(!armazem.texto()!.includes("maria@empresa.com.br"));
    assert.equal((await c.verificar("joao@empresa.com.br", "outra-senha-1")).ok, true);
  });

  it("texto corrompido no armazenamento é como não ter nada", async () => {
    const agora = { v: T0 };
    const armazem = memoria();
    await armazem.gravar("{isto não é json");
    const { c } = credenciaisDeTeste(agora, armazem);
    assert.deepEqual(await c.verificar("maria@empresa.com.br", "x"), { ok: false, motivo: "sem-registro" });
    await c.guardar({ usuarioId: "u1", email: "maria@empresa.com.br", senha: "synqos123" });
    assert.equal((await c.verificar("maria@empresa.com.br", "synqos123")).ok, true);
  });

  it("duas gravações ao mesmo tempo não se perdem", async () => {
    const agora = { v: T0 };
    const { c } = credenciaisDeTeste(agora);
    await Promise.all([c.guardar({ usuarioId: "u1", email: "a@empresa.com.br", senha: "senha-a-1" }), c.guardar({ usuarioId: "u2", email: "b@empresa.com.br", senha: "senha-b-1" })]);
    assert.equal((await c.verificar("a@empresa.com.br", "senha-a-1")).ok, true);
    assert.equal((await c.verificar("b@empresa.com.br", "senha-b-1")).ok, true);
  });

  it("as mensagens explicam o que fazer", () => {
    assert.match(mensagemDaEntradaSemSinal("vencido"), /7 dias/);
    assert.match(mensagemDaEntradaSemSinal("sem-registro"), /conecte-se/i);
    assert.match(mensagemDaEntradaSemSinal("senha"), /último acesso/);
  });
});

const euDe = (id: string, extra: Partial<RespostaMe["usuario"]> = {}) => ({ usuario: { id, nome: "Maria", perfil: "tecnico", ...extra }, equipe: null, equipes_supervisionadas: [] }) as unknown as RespostaMe;

describe("o último GET /me guardado no aparelho", () => {
  it("guarda e lê por pessoa, e a última a usar o aparelho é a padrão", async () => {
    const banco = await novoBancoDeTeste();
    assert.equal(await lerEu(banco, null), null);
    await guardarEu(banco, euDe("u1"), new Date(T0));
    await guardarEu(banco, euDe("u2", { nome: "João" }), new Date(T0 + 1000));
    assert.equal((await lerEu(banco, null))!.eu.usuario.id, "u2");
    assert.equal((await lerEu(banco, "u1"))!.eu.usuario.nome, "Maria");
    assert.equal((await lerEu(banco, "u1"))!.confirmadoEm, new Date(T0).toISOString());
    await definirUltimoUsuario(banco, "u1");
    assert.equal((await lerEu(banco, null))!.eu.usuario.id, "u1");
  });

  it("esquecer apaga a pessoa e, se ela era a última, o apontamento", async () => {
    const banco = await novoBancoDeTeste();
    await guardarEu(banco, euDe("u1"), new Date(T0));
    await esquecerEu(banco, "u1");
    assert.equal(await lerEu(banco, "u1"), null);
    assert.equal(await lerEu(banco, null), null);
  });
});

function carregador(opcoes: { modoLocal?: boolean; semConexao?: boolean; guardado?: { eu: RespostaMe; confirmadoEm: string } | null; buscar?: (o: { tempoLimiteMs?: number }) => Promise<RespostaMe>; agora?: number } = {}) {
  const chamadas: { tempoLimiteMs?: number }[] = [];
  const guardados: RespostaMe[] = [];
  const carregar = criarCarregadorDoEu({
    modoLocal: () => opcoes.modoLocal ?? false,
    semConexao: () => opcoes.semConexao ?? false,
    buscar: async (o) => {
      chamadas.push(o);
      if (!opcoes.buscar) throw new Error("não devia chamar o servidor");
      return opcoes.buscar(o);
    },
    lerGuardado: async () => opcoes.guardado ?? null,
    guardar: async (eu) => void guardados.push(eu),
    agora: () => new Date(opcoes.agora ?? T0),
  });
  return { carregar, chamadas, guardados };
}

const guardadoHa = (n: number, eu = euDe("u1")) => ({ eu, confirmadoEm: new Date(T0 - dias(n)).toISOString() });

describe("abrir o app: o GET /me com e sem sinal", () => {
  it("com sinal, pergunta ao servidor e guarda a resposta", async () => {
    const { carregar, guardados } = carregador({ buscar: async () => euDe("u1") });
    const r = await carregar();
    assert.equal(r.doAparelho, false);
    assert.equal(guardados.length, 1);
  });

  it("com sinal e uma cópia à mão, o servidor tem tempo curto; sem cópia, o tempo normal", async () => {
    const comCopia = carregador({ guardado: guardadoHa(1), buscar: async () => euDe("u1") });
    await comCopia.carregar();
    assert.equal(comCopia.chamadas[0]!.tempoLimiteMs, TEMPO_DO_ME_COM_COPIA_MS);
    const semCopia = carregador({ buscar: async () => euDe("u1") });
    await semCopia.carregar();
    assert.equal(semCopia.chamadas[0]!.tempoLimiteMs, undefined);
  });

  it("sem conexão, abre pela cópia guardada há menos de 7 dias, sem chamar o servidor", async () => {
    const { carregar, chamadas } = carregador({ semConexao: true, guardado: guardadoHa(3) });
    const r = await carregar();
    assert.equal(r.doAparelho, true);
    assert.equal(r.eu.usuario.id, "u1");
    assert.equal(chamadas.length, 0);
  });

  it("o servidor não responder (falta de rede) cai para a cópia", async () => {
    const { carregar } = carregador({ guardado: guardadoHa(1), buscar: async () => Promise.reject(new ErroDeRede()) });
    assert.equal((await carregar()).doAparelho, true);
  });

  it("quem entrou só pela senha guardada usa a cópia mesmo com sinal (ainda não há sessão)", async () => {
    const { carregar, chamadas } = carregador({ modoLocal: true, guardado: guardadoHa(2) });
    assert.equal((await carregar()).doAparelho, true);
    assert.equal(chamadas.length, 0);
  });

  it("cópia com mais de 7 dias: precisa se conectar", async () => {
    const { carregar } = carregador({ semConexao: true, guardado: guardadoHa(8) });
    await assert.rejects(carregar(), (e: unknown) => e instanceof ErroDeConexaoNecessaria && /7 dias/.test(e.message));
  });

  it("sem cópia nenhuma: precisa se conectar", async () => {
    const { carregar } = carregador({ semConexao: true, guardado: null });
    await assert.rejects(carregar(), (e: unknown) => e instanceof ErroDeConexaoNecessaria);
    const semRede = carregador({ guardado: null, buscar: async () => Promise.reject(new ErroDeRede()) });
    await assert.rejects(semRede.carregar(), (e: unknown) => e instanceof ErroDeConexaoNecessaria);
  });

  it("o erro da api (conta desativada, sessão vencida) nunca cai para a cópia", async () => {
    const { carregar } = carregador({ guardado: guardadoHa(1), buscar: async () => Promise.reject(new ErroDaApi(401, "acesso_revogado", "Acesso revogado")) });
    await assert.rejects(carregar(), (e: unknown) => e instanceof ErroDaApi && e.codigo === "acesso_revogado");
  });

  it("não conseguir guardar a resposta não derruba a abertura", async () => {
    const carregar = criarCarregadorDoEu({
      modoLocal: () => false,
      semConexao: () => false,
      buscar: async () => euDe("u1"),
      lerGuardado: async () => null,
      guardar: async () => Promise.reject(new Error("disco cheio")),
      agora: () => new Date(T0),
    });
    assert.equal((await carregar()).eu.usuario.id, "u1");
  });
});

describe("cliente da api no modo local e com tempo limite por chamada", () => {
  const armazem = (t: Tokens | null): ArmazemDeTokens => ({ ler: async () => t, gravar: async () => undefined, apagar: async () => undefined });
  const tokens: Tokens = { accessToken: "AT", refreshToken: "RT", expiraEm: "2099-01-01T00:00:00Z" };

  it("com o modo local ligado, a chamada autenticada vira falta de rede sem sair do aparelho", async () => {
    let chamou = 0;
    const c = criarClienteApi({ urlBase: "http://x", armazem: armazem(null), modoLocal: () => true, fetch: (async () => void chamou++) as unknown as typeof fetch });
    await assert.rejects(c.chamar("/os"), ErroDeRede);
    await assert.rejects(c.autorizacao(), ErroDeRede);
    assert.equal(chamou, 0);
  });

  it("o login segue funcionando no modo local (ele não usa token)", async () => {
    const corpo = JSON.stringify({ access_token: "A", refresh_token: "R", expira_em: "2099-01-01T00:00:00Z", usuario: { id: "u1" }, senha_provisoria: false });
    const c = criarClienteApi({ urlBase: "http://x", armazem: armazem(null), modoLocal: () => true, fetch: (async () => new Response(corpo, { status: 200 })) as unknown as typeof fetch });
    const r = await c.entrar("maria@empresa.com.br", "synqos123");
    assert.equal(r.usuario.id, "u1");
  });

  it("o tempo limite da chamada vale no lugar do padrão", async () => {
    const preso = (async (_url: unknown, init?: RequestInit) =>
      new Promise((_, rejeitar) => init?.signal?.addEventListener("abort", () => rejeitar(new Error("abortado"))))) as unknown as typeof fetch;
    const c = criarClienteApi({ urlBase: "http://x", armazem: armazem(tokens), fetch: preso, tempoLimiteMs: 60_000 });
    const inicio = Date.now();
    await assert.rejects(c.chamar("/me", { tempoLimiteMs: 30 }), ErroDeRede);
    assert.ok(Date.now() - inicio < 5_000, "não esperou o tempo padrão");
  });
});

describe("Sair com registro esperando", () => {
  it("a mensagem diz quantos registros e o que fazer", () => {
    assert.match(mensagemDeSairComFila(1), /1 registro de campo que ainda não subiu/);
    assert.match(mensagemDeSairComFila(3), /3 registros de campo que ainda não subiram/);
    assert.match(mensagemDeSairComFila(3), /Sincronizar/);
  });
});

describe("faixa e indicador da sincronização", () => {
  const base = { aplicavel: true, pendentes: 0, sincronizando: false, erro: null, semSinal: false };

  it("sem sinal: 'Sem conexão — N registros pendentes'", () => {
    assert.deepEqual(faixaDaSincronizacao({ ...base, pendentes: 3 }, false), { tom: "al", texto: "Sem conexão — 3 registros pendentes" });
    assert.deepEqual(faixaDaSincronizacao({ ...base, pendentes: 1 }, false), { tom: "al", texto: "Sem conexão — 1 registro pendente" });
    assert.match(faixaDaSincronizacao(base, false)!.texto, /fica guardado/);
  });
  it("o servidor não respondeu (rede diz que há sinal): também é 'Sem conexão'", () => {
    assert.equal(faixaDaSincronizacao({ ...base, pendentes: 2, semSinal: true }, true)!.texto, "Sem conexão — 2 registros pendentes");
  });
  it("com sinal e fila: avisa que está enviando; tudo em dia: nada", () => {
    assert.equal(faixaDaSincronizacao({ ...base, pendentes: 2 }, true)!.texto, "2 registros pendentes");
    assert.equal(faixaDaSincronizacao({ ...base, pendentes: 2, sincronizando: true }, true)!.texto, "Enviando 2 registros pendentes…");
    assert.equal(faixaDaSincronizacao(base, true), null);
  });
  it("o erro que a pessoa precisa resolver aparece, com ou sem fila", () => {
    assert.deepEqual(faixaDaSincronizacao({ ...base, erro: "Sua sessão terminou." }, true), { tom: "blq", texto: "Sua sessão terminou." });
    assert.equal(faixaDaSincronizacao({ ...base, pendentes: 1, erro: "Cadastre a sua assinatura." }, true)!.texto, "1 registro pendente — Cadastre a sua assinatura.");
  });
  it("quem não tem fila (admin, sem equipe) não vê faixa", () => {
    assert.equal(faixaDaSincronizacao({ ...base, aplicavel: false, pendentes: 5 }, false), null);
  });
  it("o indicador: Sem conexão, Sincronizado hh:mm ou Online", () => {
    assert.equal(rotuloDoIndicador(false, "2026-10-19T15:32:00Z", true), "Sem conexão");
    assert.equal(rotuloDoIndicador(true, "2026-10-19T15:32:00Z", true), "Sincronizado 12:32");
    assert.equal(rotuloDoIndicador(true, null, true), "Online");
    assert.equal(rotuloDoIndicador(true, "2026-10-19T15:32:00Z", false), "Online");
  });
});
