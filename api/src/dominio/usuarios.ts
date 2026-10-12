import { randomInt } from "node:crypto";
import { usuario, equipe } from "../db/schema";

type LinhaUsuario = typeof usuario.$inferSelect;
type LinhaEquipe = typeof equipe.$inferSelect;

/** O que a API devolve de um usuário: nunca a senha (que nem existe no nosso banco). */
export function usuarioParaApi(u: LinhaUsuario, opcoes: { semEmail?: boolean } = {}) {
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
  };
}

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
