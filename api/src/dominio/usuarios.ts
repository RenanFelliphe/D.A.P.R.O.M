import { randomInt } from "node:crypto";
import { inArray } from "drizzle-orm";
import { usuario, equipe } from "../db/schema";
import type { Deps } from "../deps";

type LinhaUsuario = typeof usuario.$inferSelect;
type LinhaEquipe = typeof equipe.$inferSelect;

/** O que a API devolve de um usuário: nunca a senha (que nem existe no nosso banco). */
export function usuarioParaApi(u: LinhaUsuario, opcoes: { semEmail?: boolean; criadoPorNome?: string | null } = {}) {
  return {
    id: u.id,
    nome: u.nome,
    matricula: u.matricula,
    ...(opcoes.semEmail ? {} : { email: u.email }),
    cargo: u.cargo,
    registroProfissional: u.registroProfissional,
    perfil: u.perfil,
    equipeId: u.equipeId,
    ativo: u.ativo,
    senhaProvisoria: u.senhaProvisoria,
    /** Id do arquivo da assinatura no bucket `assinaturas`. */
    assinaturaPath: u.assinaturaPath,
    assinaturaEm: u.assinaturaEm,
    treinamento: treinamentoParaApi(u),
    /** `liberado`, `pendente` (aguarda um admin) ou `recusado` (com o motivo). */
    liberacao: u.liberacao,
    criadoPorId: u.criadoPorId,
    /** Nome de quem cadastrou; só vem quando a rota o busca (veja `nomesDosCriadores`). */
    criadoPorNome: opcoes.criadoPorNome ?? null,
    criadoEm: u.criadoEm,
    liberadoEm: u.liberadoEm,
    recusaMotivo: u.recusaMotivo,
  };
}

/** Nome de quem cadastrou cada conta (id → nome), para mostrar "cadastrado por" sem uma consulta por usuário. */
export async function nomesDosCriadores(db: Deps["db"], linhas: Pick<LinhaUsuario, "criadoPorId">[]): Promise<Map<string, string>> {
  const ids = [...new Set(linhas.map((l) => l.criadoPorId).filter((id): id is string => id !== null))];
  if (ids.length === 0) return new Map();
  const criadores = await db.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(inArray(usuario.id, ids));
  return new Map(criadores.map((c) => [c.id, c.nome]));
}

/** Estado do Campo de treino e quando foi concluído ou pulado. */
export const treinamentoParaApi = (u: Pick<LinhaUsuario, "treinamentoEstado" | "treinamentoEm">) => ({
  estado: u.treinamentoEstado,
  em: u.treinamentoEm,
});

export const equipeParaApi = (e: LinhaEquipe) => ({ id: e.id, nome: e.nome, centroTrabalho: e.centroTrabalho, supervisorId: e.supervisorId });

const ALFABETO = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Senha inicial legível (sem 0/O, 1/l/I), para o admin passar ao usuário; ele a troca no primeiro acesso. */
export function gerarSenhaInicial(tamanho = 10): string {
  let senha = "";
  for (let i = 0; i < tamanho; i++) senha += ALFABETO[randomInt(ALFABETO.length)];
  return senha;
}

/** Domínio do e-mail institucional dos dados fictícios (demonstração e modo local). */
export const DOMINIO_DEMO = "empresa.com.br";

/** E-mail no padrão da empresa, primeiro nome e último sobrenome (`Sandra Supervisora` → `sandra.supervisora@empresa.com.br`). */
export function emailDoNome(nome: string, dominio = DOMINIO_DEMO): string {
  const partes = nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/\s+/)
    .map((p) => p.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
  const local = partes.length > 1 ? `${partes[0]}.${partes[partes.length - 1]}` : (partes[0] ?? "usuario");
  return `${local}@${dominio}`;
}
