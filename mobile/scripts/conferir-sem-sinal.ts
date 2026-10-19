/**
 * Confere o login sem sinal e a abertura do app sem sinal contra uma `api` de verdade (sem aparelho): faz o login com sinal, guarda o hash da
 * senha e o `GET /me` (o que o app grava), "sai" (apaga os tokens), liga o "modo avião" (um `fetch` que não chega a lugar nenhum) e confere
 * que a senha certa entra pela cópia do aparelho e devolve o mesmo `GET /me` do servidor, que a errada e a de outra conta não entram, e que
 * o que passou de 7 dias não vale. Usa o mesmo cliente e o mesmo código de `src/sessao/` e `src/offline/` do app. Pensado para a `api` local
 * em memória:
 *
 *   cd api && PORT=3399 pnpm dev:local          (em outro terminal)
 *   cd mobile && API_URL=http://localhost:3399 pnpm conferir:sem-sinal
 *
 * Nunca aponte para a `api` do Supabase compartilhado.
 */
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import type { RespostaMe } from "@shared/api/tipos";
import { criarClienteApi, type ArmazemDeTokens, type Tokens } from "../src/api/cliente";
import { ErroDaApi, ErroDeConexaoNecessaria, ErroDeRede } from "../src/api/erros";
import { criarBanco, type Banco, type Parametro } from "../src/offline/banco";
import { migrar } from "../src/offline/esquema";
import { guardarEu, lerEu } from "../src/offline/identidade";
import { criarCredenciais, ITERACOES_DA_SENHA, mensagemDaEntradaSemSinal, type ArmazemDeTexto } from "../src/sessao/credenciais";
import { derivarSenha } from "../src/sessao/derivar-senha";
import { criarCarregadorDoEu } from "../src/sessao/eu";
import { JANELA_SEM_SINAL_MS } from "../src/sessao/janela";

const API_URL = process.env.API_URL ?? "http://localhost:3399";
const SENHA = "synqos123";
const ok = (msg: string) => console.log(`ok  ${msg}`);

async function novoBanco(): Promise<Banco> {
  const sqlite = new DatabaseSync(":memory:");
  const banco = criarBanco({
    exec: async (sql) => void sqlite.exec(sql),
    run: async (sql, p: Parametro[]) => void sqlite.prepare(sql).run(...p),
    all: async <T>(sql: string, p: Parametro[]) => sqlite.prepare(sql).all(...p) as T[],
  });
  await migrar(banco);
  return banco;
}

async function main() {
  const email = "tiago.tecnico@empresa.com.br";
  let tokens: Tokens | null = null;
  const armazemDeTokens: ArmazemDeTokens = { ler: async () => tokens, gravar: async (t) => void (tokens = t), apagar: async () => void (tokens = null) };
  let semSinal = false;
  let modoLocal = false;
  const fetchDoAparelho = ((...args: Parameters<typeof fetch>) => (semSinal ? Promise.reject(new TypeError("Network request failed")) : fetch(...args))) as typeof fetch;
  const cliente = criarClienteApi({ urlBase: API_URL, armazem: armazemDeTokens, fetch: fetchDoAparelho, modoLocal: () => modoLocal });

  let textoSeguro: string | null = null;
  const armazemSeguro: ArmazemDeTexto = { ler: async () => textoSeguro, gravar: async (t) => void (textoSeguro = t), apagar: async () => void (textoSeguro = null) };
  let agora = Date.now();
  let sal = 0;
  const credenciais = criarCredenciais({ armazem: armazemSeguro, derivar: derivarSenha, novoSal: () => (++sal).toString(16).padStart(32, "0"), agora: () => new Date(agora) });
  const banco = await novoBanco();

  // ================================================================ 1. login com sinal: o que o app guarda
  const login = await cliente.entrar(email, SENHA);
  const euDoServidor = await cliente.chamar<RespostaMe>("/me");
  const antes = Date.now();
  await credenciais.guardar({ usuarioId: String(login.usuario.id), email, senha: SENHA });
  const custo = Date.now() - antes;
  await guardarEu(banco, euDoServidor, new Date(agora));
  const guardado = textoSeguro as string | null;
  assert.ok(guardado && !guardado.includes(SENHA), "a senha não fica guardada, só o hash");
  ok(`o login com sinal guardou o hash da senha (${ITERACOES_DA_SENHA} iterações, ${custo} ms no Node) e o GET /me no SQLite`);

  // ================================================================ 2. "sair" e ficar sem sinal
  await cliente.sair();
  assert.equal(await cliente.temSessao(), false);
  semSinal = true;
  await assert.rejects(cliente.entrar(email, SENHA), ErroDeRede);
  ok("sem sinal, o login no servidor falha como falta de rede (é o que leva à conferência pelo hash)");

  // ================================================================ 3. login sem sinal
  const certa = await credenciais.verificar(email, SENHA);
  assert.equal(certa.ok, true);
  assert.deepEqual(await credenciais.verificar(email, "senha-errada"), { ok: false, motivo: "senha" });
  assert.deepEqual(await credenciais.verificar("tais.tecnica@empresa.com.br", SENHA), { ok: false, motivo: "sem-registro" });
  ok("a senha certa entra; a errada e a de outra conta (que nunca entrou neste aparelho) não");

  // Entrou: sem token, em "modo local". O GET /me vem da cópia do aparelho e é o mesmo que o servidor deu.
  modoLocal = true;
  const carregarEu = criarCarregadorDoEu({
    modoLocal: () => modoLocal,
    semConexao: () => semSinal,
    buscar: (o) => cliente.chamar<RespostaMe>("/me", o),
    lerGuardado: () => lerEu(banco, null),
    guardar: (eu) => guardarEu(banco, eu, new Date(agora)),
    agora: () => new Date(agora),
  });
  const aberto = await carregarEu();
  assert.equal(aberto.doAparelho, true);
  assert.deepEqual(aberto.eu, euDoServidor);
  await assert.rejects(cliente.chamar("/os"), ErroDeRede);
  ok("quem entrou sem sinal abre pelo GET /me guardado (igual ao do servidor) e nenhuma chamada autenticada sai do aparelho");

  // ================================================================ 4. o sinal volta: o app refaz o login com a senha digitada
  semSinal = false;
  modoLocal = false;
  await cliente.entrar(email, SENHA);
  const eu2 = await carregarEu();
  assert.equal(eu2.doAparelho, false);
  assert.equal((await lerEu(banco, null))!.eu.usuario.id, euDoServidor.usuario.id);
  ok("com o sinal de volta, o login refeito abre a sessão e o GET /me vem do servidor (e é guardado de novo)");

  // ================================================================ 5. abrir o app com a sessão aberta e sem sinal
  semSinal = true;
  const reaberto = await carregarEu();
  assert.equal(reaberto.doAparelho, true);
  assert.equal(reaberto.eu.usuario.id, euDoServidor.usuario.id);
  ok("com a sessão aberta e sem sinal, o app abre pelo GET /me guardado (e não pede para entrar de novo)");

  // ================================================================ 6. passaram 7 dias
  agora += JANELA_SEM_SINAL_MS + 60_000;
  assert.deepEqual(await credenciais.verificar(email, SENHA), { ok: false, motivo: "vencido" });
  await assert.rejects(carregarEu(), (e: unknown) => e instanceof ErroDeConexaoNecessaria);
  ok(`passados 7 dias: o login sem sinal diz "${mensagemDaEntradaSemSinal("vencido").slice(0, 60)}…" e o app aberto sem sinal pede conexão`);

  // ================================================================ 7. o servidor recusa: não cai para a cópia
  semSinal = false;
  tokens = { accessToken: "invalido", refreshToken: "invalido", expiraEm: new Date(agora - 1000).toISOString() };
  await assert.rejects(carregarEu(), (e: unknown) => e instanceof ErroDaApi && e.status === 401);
  ok("com sinal, a sessão que o servidor recusa é erro da api (volta para a entrada), nunca a cópia do aparelho");

  console.log("\nO login sem sinal funciona de ponta a ponta contra a api local.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
