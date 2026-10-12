import { eq } from "drizzle-orm";
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from "jose";
import type { MiddlewareHandler } from "hono";
import type { Deps } from "../deps";
import { equipe, usuario, type Perfil } from "../db/schema";
import { ErroApi, naoAutenticado, proibido } from "./erros";

export interface UsuarioAutenticado {
  id: string;
  nome: string;
  matricula: string;
  email: string;
  perfil: Perfil;
  equipeId: string | null;
  /** Equipes de que a pessoa é supervisora (`equipe.supervisor_id`); todo supervisor é técnico. */
  equipesSupervisionadas: string[];
  ativo: boolean;
  senhaProvisoria: boolean;
  assinaturaPath: string | null;
}

/** Papel exigido por uma rota: um perfil, ou `supervisor` (a flag de quem supervisiona uma equipe). */
export type Papel = Perfil | "supervisor";

/** Tipo do contexto do Hono em toda rota autenticada: `new Hono<Ambiente>()`. */
export type Ambiente = { Variables: { usuario: UsuarioAutenticado } };

/** Só o administrador enxerga todas as equipes (técnico, supervisor ou não, só vê as suas). */
export const veTodasAsEquipes = (u: UsuarioAutenticado) => u.perfil === "admin";

/** Supervisor de ao menos uma equipe (`equipe.supervisor_id`): é um técnico com as ações de supervisão nas equipes que supervisiona. */
export const ehSupervisor = (u: UsuarioAutenticado) => u.equipesSupervisionadas.length > 0;

/** Equipes que a pessoa enxerga: `null` quando vê todas; senão a própria e as que supervisiona. */
export function equipesDoEscopo(u: UsuarioAutenticado): string[] | null {
  if (veTodasAsEquipes(u)) return null;
  return [...new Set([u.equipeId, ...u.equipesSupervisionadas].filter((id): id is string => id !== null))];
}

/** Quem não vê todas as equipes só enxerga as do próprio escopo; sem equipe nem supervisão, nenhuma. */
export const podeVerEquipe = (u: UsuarioAutenticado, equipeId: string) => equipesDoEscopo(u)?.includes(equipeId) ?? true;

/** Supervisão da equipe: quem é o supervisor dela e o administrador. */
export const podeSupervisionarEquipe = (u: UsuarioAutenticado, equipeId: string) =>
  veTodasAsEquipes(u) || u.equipesSupervisionadas.includes(equipeId);

export interface OpcoesAutenticacao {
  /**
   * Usuário desativado ainda pode enviar a fila offline pendente (arquivos e eventos); depois a `api` revoga a
   * sessão. Só essas rotas ligam esta opção.
   */
  permitirDesativado?: boolean;
  /** Com a senha inicial, só a troca de senha (e a leitura de `/me`) passa. */
  permitirSenhaProvisoria?: boolean;
  /**
   * Usuário `pendente` (aguarda a liberação de um admin) só passa nas rotas que ligam esta opção: as que ele precisa para
   * entrar, trocar a senha e fazer o Campo de treino. Nas demais, `403 aguardando_liberacao`.
   */
  permitirPendente?: boolean;
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
    // Recusado nunca passa, nem para enviar fila offline (quem nasce pendente não chega a ter fila).
    if (linha.liberacao === "recusado") throw new ErroApi(401, "acesso_revogado", "Acesso revogado");
    if (!linha.ativo && !opcoes.permitirDesativado) throw new ErroApi(401, "acesso_revogado", "Acesso revogado");
    if (linha.liberacao === "pendente" && !opcoes.permitirPendente) {
      throw new ErroApi(403, "aguardando_liberacao", "Seu acesso aguarda a liberação de um administrador");
    }
    if (linha.senhaProvisoria && !opcoes.permitirSenhaProvisoria) {
      throw new ErroApi(403, "senha_provisoria", "Defina sua senha antes de continuar");
    }

    const supervisionadas = await deps.db.select({ id: equipe.id }).from(equipe).where(eq(equipe.supervisorId, linha.id));

    c.set("usuario", {
      id: linha.id,
      nome: linha.nome,
      matricula: linha.matricula,
      email: linha.email,
      perfil: linha.perfil,
      equipeId: linha.equipeId,
      equipesSupervisionadas: supervisionadas.map((e) => e.id),
      ativo: linha.ativo,
      senhaProvisoria: linha.senhaProvisoria,
      assinaturaPath: linha.assinaturaPath,
    });
    await proximo();
  };

  /** Depois de `autenticar`: `403` se o perfil não está na lista. O papel `supervisor` casa com quem supervisiona ao menos uma equipe. */
  const exigirPerfil = (...papeis: Papel[]): MiddlewareHandler<Ambiente> => async (c, proximo) => {
    const eu = c.get("usuario");
    if (!papeis.includes(eu.perfil) && !(papeis.includes("supervisor") && ehSupervisor(eu))) throw proibido();
    await proximo();
  };

  return { autenticar, exigirPerfil };
}

export type Autenticacao = ReturnType<typeof criarAutenticacao>;
