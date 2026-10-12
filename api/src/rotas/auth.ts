import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { decodeJwt } from "jose";
import { z } from "zod";
import type { Deps } from "../deps";
import { usuario } from "../db/schema";
import { usuarioParaApi } from "../dominio/usuarios";
import type { Autenticacao, Ambiente } from "../http/autenticacao";
import { ErroApi, invalido } from "../http/erros";
import { responder } from "../http/resposta";
import { emailInstitucional, lerCorpo } from "../http/validacao";

export const senhaNova = z.string().min(8, "A senha precisa ter ao menos 8 caracteres").max(72);

const usuarioInexistente = () => new ErroApi(401, "usuario_inexistente", "Usuário inexistente: esse e-mail não está cadastrado");
const senhaIncorreta = () => new ErroApi(401, "senha_incorreta", "Senha incorreta");

/** Login pelo e-mail institucional (o mesmo e-mail da conta no Supabase Auth), renovação e troca de senha. */
export function rotasAuth(deps: Deps, { autenticar }: Autenticacao) {
  const r = new Hono<Ambiente>();

  r.post("/auth/login", async (c) => {
    const { email, senha } = await lerCorpo(c, z.object({ email: emailInstitucional, senha: z.string().min(1) }));
    const [u] = await deps.db.select().from(usuario).where(eq(usuario.email, email)).limit(1);
    if (!u) throw usuarioInexistente();
    if (u.liberacao === "recusado") {
      throw new ErroApi(403, "acesso_recusado", `Seu acesso foi recusado por um administrador${u.recusaMotivo ? `: ${u.recusaMotivo}` : ""}`);
    }
    if (!u.ativo) throw new ErroApi(401, "acesso_revogado", "Acesso revogado");

    const sessao = await deps.auth.entrar(u.email, senha);
    if (!sessao) throw senhaIncorreta();

    return responder(c, {
      accessToken: sessao.accessToken,
      refreshToken: sessao.refreshToken,
      expiraEm: sessao.expiraEm,
      usuario: usuarioParaApi(u),
      senhaProvisoria: u.senhaProvisoria,
    });
  });

  /** Vale também para usuário desativado: o app com fila offline precisa de token para enviá-la; a revogação vem depois. */
  r.post("/auth/refresh", async (c) => {
    const { refresh_token } = await lerCorpo(c, z.object({ refresh_token: z.string().min(1) }));
    const sessao = await deps.auth.renovar(refresh_token);
    if (!sessao) throw new ErroApi(401, "nao_autenticado", "Sessão inválida ou expirada");
    const id = decodeJwt(sessao.accessToken).sub;
    const [u] = id ? await deps.db.select({ id: usuario.id, liberacao: usuario.liberacao }).from(usuario).where(eq(usuario.id, id)).limit(1) : [];
    if (!u || u.liberacao === "recusado") throw new ErroApi(401, "nao_autenticado", "Sessão inválida ou expirada");
    return responder(c, { accessToken: sessao.accessToken, refreshToken: sessao.refreshToken, expiraEm: sessao.expiraEm });
  });

  /** O botão Sair: derruba as sessões da conta (o `refresh_token` não renova mais). Qualquer conta pode sair, em qualquer situação. */
  r.post("/auth/sair", autenticar({ permitirDesativado: true, permitirSenhaProvisoria: true, permitirPendente: true }), async (c) => {
    const token = (c.req.header("Authorization") ?? "").slice(7).trim();
    await deps.auth.encerrarSessoes(token, c.get("usuario").id);
    return responder(c, {});
  });

  r.post("/auth/trocar-senha", autenticar({ permitirSenhaProvisoria: true, permitirPendente: true }), async (c) => {
    const eu = c.get("usuario");
    const { senha_atual, senha_nova } = await lerCorpo(c, z.object({ senha_atual: z.string().min(1), senha_nova: senhaNova }));
    if (senha_atual === senha_nova) throw invalido("senha_igual", "A senha nova precisa ser diferente da atual");

    const confere = await deps.auth.entrar(eu.email, senha_atual);
    if (!confere) throw invalido("senha_atual_incorreta", "Senha atual incorreta");

    await deps.auth.definirSenha(eu.id, senha_nova);
    await deps.db.update(usuario).set({ senhaProvisoria: false }).where(eq(usuario.id, eu.id));
    return responder(c, {});
  });

  return r;
}
