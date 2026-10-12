import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import { auditoria, AUDITORIA_ENTIDADES } from "../db/schema";
import { condicoesDaAuditoria, listarAuditoria } from "../dominio/auditoria";
import type { Autenticacao, Ambiente } from "../http/autenticacao";
import { contar, esquemaPaginacao, limiteEDeslocamento, meta } from "../http/paginacao";
import { responder } from "../http/resposta";
import { dataIso, lerConsulta, uuid } from "../http/validacao";

/** Trilha de auditoria (só leitura; os registros nascem nas próprias ações). Só o administrador. */
export function rotasAuditoria(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();

  r.get("/auditoria", autenticar(), exigirPerfil("admin"), async (c) => {
    const filtros = lerConsulta(
      c,
      esquemaPaginacao.extend({
        entidade: z.enum(AUDITORIA_ENTIDADES).optional(),
        ator_id: uuid.optional(),
        entidade_id: z.string().trim().min(1).optional(),
        busca: z.string().trim().min(1).optional(),
        de: dataIso.optional(),
        ate: dataIso.optional(),
      }),
    );
    const onde = condicoesDaAuditoria(filtros);
    const { limit, offset } = limiteEDeslocamento(filtros);
    const registros = await listarAuditoria(deps.db, onde, limit, offset);
    return responder(c, { registros, ...meta(filtros, await contar(deps.db, auditoria, onde)) });
  });

  return r;
}
