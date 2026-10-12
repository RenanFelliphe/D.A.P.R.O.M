import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import { achadoExato } from "../dominio/busca";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { responder } from "../http/resposta";
import { lerConsulta } from "../http/validacao";

/**
 * Busca global. As listas de resultados vêm de `GET /usuarios`, `/equipes` e `/os` com `busca`; aqui fica só a pergunta
 * "o texto é exatamente um usuário, uma equipe ou uma OS?", que decide se a busca abre direto a página do item ou a
 * página de resultados.
 */
export function rotasBusca(deps: Deps, { autenticar }: Autenticacao) {
  const r = new Hono<Ambiente>();

  /** `{achado: {tipo: "usuario" | "equipe" | "os", id}}` quando um só item casa por inteiro com `q`; senão `{achado: null}`. */
  r.get("/busca/exata", autenticar(), async (c) => {
    const { q } = lerConsulta(c, z.object({ q: z.string().trim().min(1) }));
    return responder(c, { achado: await achadoExato(deps.db, c.get("usuario"), q) });
  });

  return r;
}
