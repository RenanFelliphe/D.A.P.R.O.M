import { eq } from "drizzle-orm";
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from "jose";
import type { MiddlewareHandler } from "hono";
import type { Deps } from "../deps";
import { usuario, type Perfil } from "../db/schema";
import { ErroApi, naoAutenticado, proibido } from "./erros";

export interface UsuarioAutenticado {
  id: string;
  nome: string;
  matricula: string;
  email: string | null;
  perfil: Perfil;
  equipeId: string | null;
  ativo: boolean;
  senhaProvisoria: boolean;
  assinaturaPath: string | null;
}

/** Tipo do contexto do Hono em toda rota autenticada: `new Hono<Ambiente>()`. */
export type Ambiente = { Variables: { usuario: UsuarioAutenticado } };

/** Perfis que enxergam todas as equipes (técnico e supervisor só veem a própria). */
export const veTodasAsEquipes = (u: UsuarioAutenticado) => u.perfil === "analista" || u.perfil === "seguranca" || u.perfil === "admin";

/** `equipe_id` a que a consulta deve se limitar: a do usuário, ou `null` quando ele vê todas. */
export const equipeDoEscopo = (u: UsuarioAutenticado) => (veTodasAsEquipes(u) ? null : u.equipeId);

/** Técnico e supervisor sem equipe não enxergam nada; os demais perfis enxergam qualquer equipe. */
export const podeVerEquipe = (u: UsuarioAutenticado, equipeId: string) => veTodasAsEquipes(u) || (u.equipeId !== null && u.equipeId === equipeId);

export interface OpcoesAutenticacao {
  /**
   * Usuário desativado ainda pode enviar a fila offline pendente (arquivos e eventos); depois a `api` revoga a
   * sessão. Só essas rotas ligam esta opção.
   */
  permitirDesativado?: boolean;
  /** Com a senha inicial, só a troca de senha (e a leitura de `/me`) passa. */
  permitirSenhaProvisoria?: boolean;
}

export function criarAutenticacao(deps: Deps) {
  const segredo = new TextEncoder().encode(deps.config.supabaseJwtSecret);
  // Projetos novos do Supabase assinam o JWT com chave assimétrica (ES256/RS256); as chaves públicas ficam no JWKS do projeto.
  let chavesPublicas: ReturnType<typeof createRemoteJWKSet> | undefined;
  const jwks = () => (chavesPublicas ??= createRemoteJWKSet(new URL(`${deps.config.supabaseUrl}/auth/v1/.well-known/jwks.json`), {
      // O endpoint de chaves públicas do Supabase exige o cabeçalho `apikey`.
      headers: { apikey: deps.config.supabaseServiceRoleKey },
    }));

  /** JWT válido (assinado pelo Supabase) + usuário cadastrado, ativo e sem senha provisória. 401 / 403 antes de qualquer leitura. */
  const autenticar = (opcoes: OpcoesAutenticacao = {}): MiddlewareHandler<Ambiente> => async (c, proximo) => {
    const cabecalho = c.req.header("Authorization") ?? "";
    const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7).trim() : "";
    if (!token) throw naoAutenticado();

    let id: string;
    try {
      const hs = decodeProtectedHeader(token).alg === "HS256";
      if (hs && !deps.config.supabaseJwtSecret) throw new Error("sem segredo HS256");
      const opcoes = { currentDate: deps.agora() };
      const { payload } = hs
        ? await jwtVerify(token, segredo, { ...opcoes, algorithms: ["HS256"] })
        : await jwtVerify(token, jwks(), { ...opcoes, algorithms: ["ES256", "RS256", "EdDSA"] });
      if (!payload.sub) throw new Error("sem sub");
      id = payload.sub;
    } catch {
      throw naoAutenticado();
    }

    const [linha] = await deps.db.select().from(usuario).where(eq(usuario.id, id)).limit(1);
    if (!linha) throw naoAutenticado();
    if (!linha.ativo && !opcoes.permitirDesativado) throw new ErroApi(401, "acesso_revogado", "Acesso revogado");
    if (linha.senhaProvisoria && !opcoes.permitirSenhaProvisoria) {
      throw new ErroApi(403, "senha_provisoria", "Defina sua senha antes de continuar");
    }

    c.set("usuario", {
      id: linha.id,
      nome: linha.nome,
      matricula: linha.matricula,
      email: linha.email,
      perfil: linha.perfil,
      equipeId: linha.equipeId,
      ativo: linha.ativo,
      senhaProvisoria: linha.senhaProvisoria,
      assinaturaPath: linha.assinaturaPath,
    });
    await proximo();
  };

  /** Depois de `autenticar`: `403` se o perfil não está na lista. */
  const exigirPerfil = (...perfis: Perfil[]): MiddlewareHandler<Ambiente> => async (c, proximo) => {
    if (!perfis.includes(c.get("usuario").perfil)) throw proibido();
    await proximo();
  };

  return { autenticar, exigirPerfil };
}

export type Autenticacao = ReturnType<typeof criarAutenticacao>;
