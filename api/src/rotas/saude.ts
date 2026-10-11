import { sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Deps } from "../deps";
import { responder } from "../http/resposta";

/** `GET /saude` → `200` `{versao, banco}`; é pública e só responde depois das migrações (o servidor abre a porta no fim). */
export function rotasSaude(deps: Deps) {
  const r = new Hono();
  r.get("/saude", async (c) => {
    try {
      await deps.db.execute(sql`select 1`);
      return responder(c, { versao: deps.config.versao, banco: "ok" });
    } catch {
      return responder(c, { versao: deps.config.versao, banco: "indisponivel" }, 503);
    }
  });
  return r;
}
