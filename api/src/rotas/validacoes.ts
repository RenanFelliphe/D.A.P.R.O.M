import { Hono } from "hono";
import type { Deps } from "../deps";
import { minhasValidacoes } from "../dominio/validacoes";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { responder } from "../http/resposta";

/**
 * A página "Validações" do supervisor (`docs/pessoas-e-equipes.md`, seção 5): a fila de tudo o que espera a decisão ou a assinatura
 * dele, reunida de fontes que já existiam. Só quem supervisiona uma equipe (titular ou representante); o admin recebe `403`.
 */
export function rotasValidacoes(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();

  r.get("/me/validacoes", autenticar(), exigirPerfil("supervisor"), async (c) => {
    return responder(c, await minhasValidacoes(deps.db, c.get("usuario"), deps.agora()));
  });

  return r;
}
