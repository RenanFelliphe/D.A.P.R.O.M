import { asc, eq } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { patente } from "../db/schema";
import type { Deps } from "../deps";

/**
 * As patentes (seção 3 do `gameficacao.md`): a escada de níveis cadastrada pelo admin. A patente de uma pessoa é a de maior
 * pontuação necessária que ela atingiu na temporada; a da equipe usa a mesma tabela aplicada à média por membro.
 */

export type LinhaDePatente = typeof patente.$inferSelect;

/** A escada das patentes ativas, da menor pontuação para a maior. */
export async function escadaDePatentes(db: Db): Promise<LinhaDePatente[]> {
  return db.select().from(patente).where(eq(patente.ativa, true)).orderBy(asc(patente.pontosNecessarios));
}

/** Todas as patentes, ativas ou não, por id: o histórico (temporadas fechadas) guarda também as desativadas. */
export async function todasAsPatentes(db: Db): Promise<Map<string, LinhaDePatente>> {
  const linhas = await db.select().from(patente);
  return new Map(linhas.map((p) => [p.id, p]));
}

/** A de maior pontuação necessária que `pontos` alcança; `null` (sem patente) abaixo da primeira. A escada vem em ordem crescente. */
export function patenteDosPontos(pontos: number, escada: LinhaDePatente[]): LinhaDePatente | null {
  let atual: LinhaDePatente | null = null;
  for (const p of escada) if (p.pontosNecessarios <= pontos) atual = p;
  return atual;
}

/** A próxima patente da escada que `pontos` ainda não alcança; `null` no topo. */
export function proximaPatente(pontos: number, escada: LinhaDePatente[]): LinhaDePatente | null {
  return escada.find((p) => p.pontosNecessarios > pontos) ?? null;
}

/** A maior das duas patentes (pela pontuação necessária); `null` só se as duas faltam. */
export function maiorDasPatentes(a: LinhaDePatente | null | undefined, b: LinhaDePatente | null | undefined): LinhaDePatente | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return b.pontosNecessarios > a.pontosNecessarios ? b : a;
}

/** Duração das URLs assinadas das imagens: a tela as usa em seguida, e uma hora cobre uma sessão de consulta. */
const SEGUNDOS_DA_URL = 3600;

/** As URLs assinadas das imagens do bucket `gamificacao` (uma consulta por imagem distinta, em paralelo). */
export async function urlsDasImagens(deps: Deps, caminhos: Iterable<string>): Promise<Map<string, string>> {
  const unicos = [...new Set(caminhos)];
  const urls = await Promise.all(unicos.map((c) => deps.armazenamento.urlAssinada("gamificacao", c, SEGUNDOS_DA_URL).catch(() => "")));
  return new Map(unicos.map((c, i) => [c, urls[i]!]));
}

/** De quem é o selo: a patente das pessoas e a das equipes têm cada uma a sua imagem. */
export type DeQuem = "pessoa" | "equipe";

/** O arquivo da imagem da patente para pessoas ou para equipes. */
export const caminhoDaImagem = (p: Pick<LinhaDePatente, "imagemPath" | "imagemEquipePath">, de: DeQuem = "pessoa") => (de === "equipe" ? p.imagemEquipePath : p.imagemPath);

/** Os dois arquivos da patente (para pedir as URLs de uma vez). */
export const caminhosDasImagens = (p: Pick<LinhaDePatente, "imagemPath" | "imagemEquipePath">) => [p.imagemPath, p.imagemEquipePath];

/** A patente como a API a devolve, com as duas imagens (`urls` vem de `urlsDasImagens`, com os dois arquivos). */
export const patenteParaApi = (p: LinhaDePatente, urls: Map<string, string>) => ({
  id: p.id,
  nome: p.nome,
  pontosNecessarios: p.pontosNecessarios,
  cor: p.cor,
  descricao: p.descricao,
  ativa: p.ativa,
  imagemUrl: urls.get(p.imagemPath) || null,
  imagemEquipeUrl: urls.get(p.imagemEquipePath) || null,
});

/**
 * O resumo curto de uma patente (selo): id, nome, cor e imagem. A imagem é a das pessoas, ou a das equipes quando o selo é de
 * uma equipe (`de: "equipe"`): quem consome o selo recebe sempre o `imagemUrl` certo para o contexto.
 */
export const seloDePatente = (p: LinhaDePatente | null | undefined, urls: Map<string, string>, de: DeQuem = "pessoa") =>
  p ? { id: p.id, nome: p.nome, cor: p.cor, pontosNecessarios: p.pontosNecessarios, imagemUrl: urls.get(caminhoDaImagem(p, de)) || null } : null;
