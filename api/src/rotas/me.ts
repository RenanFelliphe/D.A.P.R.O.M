import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import { equipe, usuario } from "../db/schema";
import { equipeParaApi, usuarioParaApi } from "../dominio/usuarios";
import type { Autenticacao, Ambiente } from "../http/autenticacao";
import { invalido } from "../http/erros";
import { responder } from "../http/resposta";
import { lerCorpo, uuid } from "../http/validacao";

export function rotasMe(deps: Deps, { autenticar }: Autenticacao) {
  const r = new Hono<Ambiente>();

  /** Também com a senha inicial: é como a tela "Defina sua senha" sabe quem é o usuário. */
  r.get("/me", autenticar({ permitirSenhaProvisoria: true }), async (c) => {
    const eu = c.get("usuario");
    const [u] = await deps.db.select().from(usuario).where(eq(usuario.id, eu.id));
    const [e] = eu.equipeId ? await deps.db.select().from(equipe).where(eq(equipe.id, eu.equipeId)) : [];
    return responder(c, { usuario: usuarioParaApi(u!), equipe: e ? equipeParaApi(e) : null });
  });

  /**
   * Refazer a assinatura vale para as próximas: as já feitas guardam o caminho da imagem que usaram, e um arquivo
   * nunca é sobrescrito, então elas não mudam.
   */
  r.put("/me/assinatura", autenticar(), async (c) => {
    const eu = c.get("usuario");
    const { arquivo_id } = await lerCorpo(c, z.object({ arquivo_id: uuid }));
    if (!(await deps.armazenamento.existe("assinaturas", arquivo_id))) {
      throw invalido("arquivo_inexistente", "Envie a imagem da assinatura antes (PUT /arquivos/{id})");
    }
    await deps.db.update(usuario).set({ assinaturaPath: arquivo_id, assinaturaEm: deps.agora() }).where(eq(usuario.id, eu.id));
    return responder(c, { assinaturaPath: arquivo_id });
  });

  return r;
}
