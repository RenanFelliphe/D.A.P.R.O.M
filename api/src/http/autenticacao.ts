import { and, desc, eq, lte } from "drizzle-orm";
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from "jose";
import type { MiddlewareHandler } from "hono";
import type { Deps } from "../deps";
import { ausencia, equipe, usuario, type Perfil } from "../db/schema";
import { equipesComRepresentacaoGravada, INTERVALO_DA_ATIVIDADE_MIN, representacoesEmVigor, sincronizarRepresentacao } from "../dominio/representacao";
import { diaDe, dataBr } from "../dominio/tempo";
import { ErroApi, naoAutenticado, proibido } from "./erros";

export interface UsuarioAutenticado {
  id: string;
  nome: string;
  matricula: string;
  email: string;
  perfil: Perfil;
  equipeId: string | null;
  /**
   * Equipes em que a pessoa exerce a supervisão: as que ela supervisiona (`equipe.supervisor_id`; todo supervisor é técnico) e as
   * que ela representa agora, porque o supervisor está ausente ou parado (`equipesRepresentadas`). É por aqui que passa toda
   * permissão de supervisão.
   */
  equipesSupervisionadas: string[];
  /** As equipes em que a pessoa está no comando como representante do supervisor (um subconjunto de `equipesSupervisionadas`). */
  equipesRepresentadas: string[];
  ativo: boolean;
  senhaProvisoria: boolean;
  assinaturaPath: string | null;
  /** A ausência que está valendo (em curso ou vencida); `null` quando a pessoa não está ausente. O ausente só visualiza. */
  ausencia: { id: string; inicio: string; retorno: string; situacao: "em_curso" | "vencida" } | null;
}

/** Papel exigido por uma rota: um perfil, ou `supervisor` (a flag de quem supervisiona uma equipe). */
export type Papel = Perfil | "supervisor";

/** Tipo do contexto do Hono em toda rota autenticada: `new Hono<Ambiente>()`. */
export type Ambiente = { Variables: { usuario: UsuarioAutenticado } };

/** Só o administrador enxerga todas as equipes (técnico, supervisor ou não, só vê as suas). */
export const veTodasAsEquipes = (u: UsuarioAutenticado) => u.perfil === "admin";

/** Supervisor de ao menos uma equipe (`equipe.supervisor_id`) ou representante no comando de uma: é um técnico com as ações de supervisão nas equipes que supervisiona. */
export const ehSupervisor = (u: UsuarioAutenticado) => u.equipesSupervisionadas.length > 0;

/** Supervisor de verdade (o titular de uma equipe), não o representante: só ele registra a própria ausência. */
export const ehSupervisorTitular = (u: UsuarioAutenticado) => u.equipesSupervisionadas.some((id) => !u.equipesRepresentadas.includes(id));

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

const MetodosDeLeitura = new Set(["GET", "HEAD", "OPTIONS"]);

export interface OpcoesAutenticacao {
  /**
   * Usuário desativado ainda pode enviar a fila offline pendente (arquivos e eventos); depois a `api` revoga a
   * sessão. Só essas rotas ligam esta opção.
   */
  permitirDesativado?: boolean;
  /** Com a senha inicial, só a troca de senha (e a leitura de `/me`) passa. */
  permitirSenhaProvisoria?: boolean;
  /**
   * Quem já foi liberado e ainda não cadastrou a assinatura só passa nas rotas que ligam esta opção (ler `/me`, sair, trocar a
   * senha, enviar a imagem e gravá-la em `PUT /me/assinatura`). Nas demais, `403 assinatura_pendente`: a assinatura é a primeira
   * coisa a fazer depois da liberação. Quem aguarda a liberação não é cobrado ainda.
   */
  permitirSemAssinatura?: boolean;
  /**
   * Usuário `pendente` (aguarda a liberação de um admin) só passa nas rotas que ligam esta opção: as que ele precisa para
   * entrar, trocar a senha e fazer o Campo de treino. Nas demais, `403 aguardando_liberacao`.
   */
  permitirPendente?: boolean;
  /**
   * Usuário ausente só visualiza: toda rota que altera (`POST`, `PUT`, `PATCH`, `DELETE`) é recusada com `403 usuario_ausente`, menos as
   * que ligam esta opção (sair, trocar a senha, marcar alertas como lidos, o pedido de fim antecipado e a confirmação do
   * retorno, o encerramento da própria ausência pelo supervisor e a fila offline do que foi feito antes do início).
   */
  permitirAusente?: boolean;
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
    if (linha.liberacao === "liberado" && !linha.assinaturaPath && !opcoes.permitirSemAssinatura) {
      throw new ErroApi(403, "assinatura_pendente", "Cadastre a sua assinatura antes de continuar");
    }

    // Quem usa o sistema está ativo: o supervisor que voltou a usá-lo, depois de dias parado, retoma a equipe do representante na hora.
    const agora = deps.agora();
    if (agora.getTime() - linha.ultimaAtividadeEm.getTime() >= INTERVALO_DA_ATIVIDADE_MIN * 60_000) {
      await deps.db.update(usuario).set({ ultimaAtividadeEm: agora }).where(eq(usuario.id, linha.id));
      const comRepresentacao = await equipesComRepresentacaoGravada(deps.db, linha.id);
      if (comRepresentacao.length > 0) await sincronizarRepresentacao(deps.db, agora, comRepresentacao);
    }

    const titulares = await deps.db.select({ id: equipe.id }).from(equipe).where(eq(equipe.supervisorId, linha.id));
    // Representante: o supervisor da equipe está ausente ou parado há dias, e esta pessoa responde por ela até ele voltar.
    const representadas = (await representacoesEmVigor(deps.db, agora, { representanteId: linha.id })).map((r) => r.equipeId);

    // Ausente: confirmada, já começada e ainda não encerrada (em curso, ou vencida até o retorno ser confirmado).
    const hoje = diaDe(deps.agora());
    const [ausente] = await deps.db
      .select({ id: ausencia.id, inicio: ausencia.inicio, retorno: ausencia.retorno })
      .from(ausencia)
      .where(and(eq(ausencia.usuarioId, linha.id), eq(ausencia.estado, "confirmada"), lte(ausencia.inicio, hoje)))
      .orderBy(desc(ausencia.inicio))
      .limit(1);
    if (ausente && !opcoes.permitirAusente && !MetodosDeLeitura.has(c.req.method)) {
      throw new ErroApi(403, "usuario_ausente", `Você está ausente${hoje < ausente.retorno ? ` até ${dataBr(ausente.retorno)}` : ""}: o sistema fica só para consulta`, { retorno: ausente.retorno });
    }

    c.set("usuario", {
      id: linha.id,
      nome: linha.nome,
      matricula: linha.matricula,
      email: linha.email,
      perfil: linha.perfil,
      equipeId: linha.equipeId,
      equipesSupervisionadas: [...titulares.map((e) => e.id), ...representadas],
      equipesRepresentadas: representadas,
      ativo: linha.ativo,
      senhaProvisoria: linha.senhaProvisoria,
      assinaturaPath: linha.assinaturaPath,
      ausencia: ausente ? { ...ausente, situacao: hoje < ausente.retorno ? "em_curso" : "vencida" } : null,
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
