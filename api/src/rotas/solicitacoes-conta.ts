import { Hono } from "hono";
import type { Deps } from "../deps";
import { descartarSolicitacao, equipesParaOPedido, esquemaSolicitacaoConta, listarSolicitacoes, solicitarConta } from "../dominio/solicitacao-conta";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { responder } from "../http/resposta";
import { lerCorpo, lerId } from "../http/validacao";

/**
 * O pedido de conta da tela de entrada (`funcionalidades/solicitacao-de-conta.md`). Duas rotas abertas, sem login: as equipes
 * para escolher e o pedido. As outras são de quem cadastra: os pedidos pendentes (o admin vê todos; quem responde por equipes,
 * os delas) e descartar um.
 */
export function rotasSolicitacoesConta(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();

  r.get("/solicitacoes-conta/equipes", async (c) => responder(c, { equipes: await equipesParaOPedido(deps.db) }));

  r.post("/solicitacoes-conta", async (c) => {
    const dados = await lerCorpo(c, esquemaSolicitacaoConta);
    await solicitarConta(deps.db, dados, deps.agora());
    return responder(c, { recebida: true }, 202);
  });

  r.get("/solicitacoes-conta", autenticar(), exigirPerfil("admin", "supervisor"), async (c) => responder(c, { solicitacoes: await listarSolicitacoes(deps.db, c.get("usuario")) }));

  r.post("/solicitacoes-conta/:id/descartar", autenticar(), exigirPerfil("admin", "supervisor"), async (c) => {
    await descartarSolicitacao(deps.db, c.get("usuario"), lerId(c), deps.agora());
    return responder(c, {});
  });

  return r;
}
