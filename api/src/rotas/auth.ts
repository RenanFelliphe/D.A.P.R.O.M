import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { decodeJwt } from "jose";
import { z } from "zod";
import type { Deps } from "../deps";
import { usuario } from "../db/schema";
import { usuarioParaApi } from "../dominio/usuarios";
import type { Autenticacao, Ambiente } from "../http/autenticacao";
import { ErroApi, invalido } from "../http/erros";
import { responder } from "../http/resposta";
import { lerCorpo, textoObrigatorio } from "../http/validacao";
import { emailInterno } from "../servicos/auth";

export const senhaNova = z.string().min(8, "A senha precisa ter ao menos 8 caracteres").max(72);

const credenciaisInvalidas = () => new ErroApi(401, "credenciais_invalidas", "Matrícula ou senha inválida");

/** Login por matrícula (o Supabase Auth recebe o e-mail interno `<matrícula>@daprom.local`), renovação e troca de senha. */
export function rotasAuth(deps: Deps, { autenticar }: Autenticacao) {
  const r = new Hono<Ambiente>();

  r.post("/auth/login", async (c) => {
    const { matricula, senha } = await lerCorpo(c, z.object({ matricula: textoObrigatorio, senha: z.string().min(1) }));
    const [u] = await deps.db.select().from(usuario).where(eq(sql`lower(${usuario.matricula})`, matricula.toLowerCase())).limit(1);
    if (!u) throw credenciaisInvalidas();
    if (!u.ativo) throw new ErroApi(401, "acesso_revogado", "Acesso revogado");

    const sessao = await deps.auth.entrar(emailInterno(u.matricula), senha);
    if (!sessao) throw credenciaisInvalidas();

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
    const [u] = id ? await deps.db.select({ id: usuario.id }).from(usuario).where(eq(usuario.id, id)).limit(1) : [];
    if (!u) throw new ErroApi(401, "nao_autenticado", "Sessão inválida ou expirada");
    return responder(c, { accessToken: sessao.accessToken, refreshToken: sessao.refreshToken, expiraEm: sessao.expiraEm });
  });

  r.post("/auth/trocar-senha", autenticar({ permitirSenhaProvisoria: true }), async (c) => {
    const eu = c.get("usuario");
    const { senha_atual, senha_nova } = await lerCorpo(c, z.object({ senha_atual: z.string().min(1), senha_nova: senhaNova }));
    if (senha_atual === senha_nova) throw invalido("senha_igual", "A senha nova precisa ser diferente da atual");

    const confere = await deps.auth.entrar(emailInterno(eu.matricula), senha_atual);
    if (!confere) throw invalido("senha_atual_incorreta", "Senha atual incorreta");

    await deps.auth.definirSenha(eu.id, senha_nova);
    await deps.db.update(usuario).set({ senhaProvisoria: false }).where(eq(usuario.id, eu.id));
    return responder(c, {});
  });

  return r;
}
