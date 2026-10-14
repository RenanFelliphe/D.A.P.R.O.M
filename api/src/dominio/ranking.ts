import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { equipe, lancamentoEquipe, lancamentoPontos, temporada, temporadaEquipe, temporadaUsuario, usuario } from "../db/schema";
import type { UsuarioAutenticado } from "../http/autenticacao";
import { escadaDePatentes, maiorDasPatentes, patenteDosPontos, todasAsPatentes, type LinhaDePatente } from "./patentes";

/**
 * Rankings (seção 5 do `gameficacao.md`): pessoas e equipes, na temporada (aberta ou fechada) e no geral. Quem aparece são os
 * técnicos ativos e liberados (o admin não joga, quem aguarda liberação não aparece, quem é desativado sai dos rankings
 * abertos e continua nas temporadas fechadas). O empate fica com quem chegou primeiro àquela pontuação (o último lançamento
 * mais antigo). A equipe é ordenada pela média por membro, para a maior não ganhar só por ser maior.
 */

export const GERAL = "geral";
export const NOME_ANONIMO = "Participante anônimo";

const daBase = (v: Date | string | null | undefined) => (v === null || v === undefined ? null : v instanceof Date ? v : new Date(v));
const arredondar = (n: number) => Math.round(n * 100) / 100;

export interface PessoaElegivel {
  id: string;
  nome: string;
  equipeId: string | null;
  equipeNome: string | null;
  anonimo: boolean;
}

/** Os técnicos que entram nos rankings abertos: ativos e liberados. */
export async function pessoasElegiveis(db: Db): Promise<PessoaElegivel[]> {
  return db
    .select({ id: usuario.id, nome: usuario.nome, equipeId: usuario.equipeId, equipeNome: equipe.nome, anonimo: usuario.rankingAnonimo })
    .from(usuario)
    .leftJoin(equipe, eq(equipe.id, usuario.equipeId))
    .where(and(eq(usuario.perfil, "tecnico"), eq(usuario.ativo, true), eq(usuario.liberacao, "liberado")));
}

export interface LinhaDePessoa {
  posicao: number;
  usuarioId: string;
  nome: string;
  equipeId: string | null;
  equipeNome: string | null;
  anonimo: boolean;
  pontos: number;
  patente: LinhaDePatente | null;
}

/** Quem tem mais pontos vem antes; no empate, quem fez o último lançamento mais cedo; por fim, o nome. */
function ordenar<T extends { pontos: number; ultimoEm: Date | null; nome: string }>(linhas: T[]): T[] {
  return linhas.sort((a, b) => {
    if (b.pontos !== a.pontos) return b.pontos - a.pontos;
    if (a.ultimoEm && b.ultimoEm && a.ultimoEm.getTime() !== b.ultimoEm.getTime()) return a.ultimoEm.getTime() - b.ultimoEm.getTime();
    if (a.ultimoEm && !b.ultimoEm) return -1;
    if (!a.ultimoEm && b.ultimoEm) return 1;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

/** A temporada está fechada (com o resultado gravado)? Sem linha ou sem `fechada_em`, o ranking é calculado na hora. */
export async function temporadaFechada(db: Db, codigo: string): Promise<boolean> {
  const [t] = await db.select({ fechadaEm: temporada.fechadaEm }).from(temporada).where(eq(temporada.codigo, codigo));
  return Boolean(t?.fechadaEm);
}

/** Pontos e último lançamento de cada pessoa, na temporada (`escopo` = código) ou no geral. */
async function somasDasPessoas(db: Db, escopo: string) {
  const linhas = await db
    .select({
      usuarioId: lancamentoPontos.usuarioId,
      pontos: sql<number>`coalesce(sum(${lancamentoPontos.pontos}), 0)::int`,
      ultimo: sql<Date | string | null>`max(${lancamentoPontos.ocorridoEm})`,
    })
    .from(lancamentoPontos)
    .where(escopo === GERAL ? undefined : eq(lancamentoPontos.temporada, escopo))
    .groupBy(lancamentoPontos.usuarioId);
  return new Map(linhas.map((l) => [l.usuarioId, { pontos: l.pontos, ultimoEm: daBase(l.ultimo) }]));
}

/**
 * A maior patente já alcançada por cada pessoa: a maior entre as gravadas nas temporadas fechadas e a das temporadas ainda
 * abertas (calculada agora, com a escada de hoje).
 */
export async function maioresPatentes(db: Db, escada?: LinhaDePatente[]): Promise<Map<string, LinhaDePatente>> {
  const degraus = escada ?? (await escadaDePatentes(db));
  const maiores = new Map<string, LinhaDePatente>();
  const considerar = (usuarioId: string, p: LinhaDePatente | null) => {
    const melhor = maiorDasPatentes(maiores.get(usuarioId), p);
    if (melhor) maiores.set(usuarioId, melhor);
  };
  const fechadas = await db
    .select({ usuarioId: temporadaUsuario.usuarioId, patenteId: temporadaUsuario.patenteId })
    .from(temporadaUsuario)
    .where(isNotNull(temporadaUsuario.patenteId));
  if (fechadas.length > 0) {
    const todas = await todasAsPatentes(db);
    for (const f of fechadas) considerar(f.usuarioId, todas.get(f.patenteId!) ?? null);
  }
  const abertas = await db
    .select({ usuarioId: lancamentoPontos.usuarioId, pontos: sql<number>`coalesce(sum(${lancamentoPontos.pontos}), 0)::int` })
    .from(lancamentoPontos)
    .innerJoin(temporada, eq(temporada.codigo, lancamentoPontos.temporada))
    .where(isNull(temporada.fechadaEm))
    .groupBy(lancamentoPontos.usuarioId, lancamentoPontos.temporada);
  for (const a of abertas) considerar(a.usuarioId, patenteDosPontos(a.pontos, degraus));
  return maiores;
}

/**
 * Ranking de pessoas. `escopo` é o código de uma temporada (`2026-T4`) ou `geral`. Temporada fechada: o que foi gravado no
 * fechamento (inclusive quem foi desativado depois). Temporada aberta: calculado agora. Geral: todos os pontos, com a maior
 * patente já alcançada.
 */
export async function rankingDePessoas(db: Db, escopo: string): Promise<LinhaDePessoa[]> {
  const escada = await escadaDePatentes(db);

  if (escopo !== GERAL && (await temporadaFechada(db, escopo))) {
    const todas = await todasAsPatentes(db);
    const linhas = await db
      .select({
        usuarioId: temporadaUsuario.usuarioId,
        nome: usuario.nome,
        equipeId: usuario.equipeId,
        equipeNome: equipe.nome,
        anonimo: usuario.rankingAnonimo,
        pontos: temporadaUsuario.pontos,
        patenteId: temporadaUsuario.patenteId,
        posicao: temporadaUsuario.posicao,
      })
      .from(temporadaUsuario)
      .innerJoin(usuario, eq(usuario.id, temporadaUsuario.usuarioId))
      .leftJoin(equipe, eq(equipe.id, usuario.equipeId))
      .where(eq(temporadaUsuario.temporada, escopo));
    return linhas
      .sort((a, b) => a.posicao - b.posicao)
      .map(({ patenteId, ...l }) => ({ ...l, patente: patenteId ? (todas.get(patenteId) ?? null) : null }));
  }

  const [elegiveis, somas] = await Promise.all([pessoasElegiveis(db), somasDasPessoas(db, escopo)]);
  const maiores = escopo === GERAL ? await maioresPatentes(db, escada) : null;
  const linhas = elegiveis.map((p) => {
    const s = somas.get(p.id);
    return { p, pontos: s?.pontos ?? 0, ultimoEm: s?.ultimoEm ?? null, nome: p.nome };
  });
  return ordenar(linhas).map(({ p, pontos }, i) => ({
    posicao: i + 1,
    usuarioId: p.id,
    nome: p.nome,
    equipeId: p.equipeId,
    equipeNome: p.equipeNome,
    anonimo: p.anonimo,
    pontos,
    patente: maiores ? (maiores.get(p.id) ?? patenteDosPontos(pontos, escada)) : patenteDosPontos(pontos, escada),
  }));
}

// ---- Equipes ----------------------------------------------------------------------------------------------------

export interface MembroDaEquipe {
  id: string;
  nome: string;
  anonimo: boolean;
}

/**
 * As pessoas de cada equipe: os técnicos ativos e liberados mais o supervisor, quando ele não é membro (o supervisor pode ser
 * de outra equipe e supervisionar esta).
 */
export async function membrosDasEquipes(db: Db): Promise<Map<string, MembroDaEquipe[]>> {
  const pessoas = await pessoasElegiveis(db);
  const porId = new Map(pessoas.map((p) => [p.id, p]));
  const membros = new Map<string, MembroDaEquipe[]>();
  const incluir = (equipeId: string, p: PessoaElegivel) => {
    const lista = membros.get(equipeId) ?? [];
    if (!lista.some((m) => m.id === p.id)) lista.push({ id: p.id, nome: p.nome, anonimo: p.anonimo });
    membros.set(equipeId, lista);
  };
  for (const p of pessoas) if (p.equipeId) incluir(p.equipeId, p);
  const supervisoes = await db.select({ equipeId: equipe.id, supervisorId: equipe.supervisorId }).from(equipe).where(isNotNull(equipe.supervisorId));
  for (const s of supervisoes) {
    const sup = porId.get(s.supervisorId!);
    if (sup) incluir(s.equipeId, sup);
  }
  return membros;
}

/** Pontos creditados e último lançamento de cada equipe, na temporada ou no geral. */
async function somasDasEquipes(db: Db, escopo: string) {
  const linhas = await db
    .select({
      equipeId: lancamentoEquipe.equipeId,
      pontos: sql<number>`coalesce(sum(${lancamentoPontos.pontos}), 0)::int`,
      ultimo: sql<Date | string | null>`max(${lancamentoPontos.ocorridoEm})`,
    })
    .from(lancamentoEquipe)
    .innerJoin(lancamentoPontos, eq(lancamentoPontos.id, lancamentoEquipe.lancamentoId))
    .where(escopo === GERAL ? undefined : eq(lancamentoPontos.temporada, escopo))
    .groupBy(lancamentoEquipe.equipeId);
  return new Map(linhas.map((l) => [l.equipeId, { pontos: l.pontos, ultimoEm: daBase(l.ultimo) }]));
}

export interface LinhaDeEquipe {
  posicao: number;
  equipeId: string;
  nome: string;
  membros: number;
  /** A soma de tudo o que foi creditado à equipe. */
  pontos: number;
  /** A soma dividida pelas pessoas da equipe: define a patente e a posição. */
  media: number;
  patente: LinhaDePatente | null;
}

/**
 * Ranking de equipes pela média por membro (a soma aparece ao lado). Equipe sem ninguém fica de fora. Temporada fechada: o
 * gravado no fechamento (com o número de pessoas daquela época); aberta e geral: as pessoas de hoje. A patente da equipe é a
 * tabela de patentes aplicada à média (na temporada).
 */
export async function rankingDeEquipes(db: Db, escopo: string): Promise<LinhaDeEquipe[]> {
  const escada = await escadaDePatentes(db);

  if (escopo !== GERAL && (await temporadaFechada(db, escopo))) {
    const todas = await todasAsPatentes(db);
    const linhas = await db
      .select({
        equipeId: temporadaEquipe.equipeId,
        nome: equipe.nome,
        membros: temporadaEquipe.membros,
        pontos: temporadaEquipe.pontos,
        media: temporadaEquipe.media,
        patenteId: temporadaEquipe.patenteId,
        posicao: temporadaEquipe.posicao,
      })
      .from(temporadaEquipe)
      .innerJoin(equipe, eq(equipe.id, temporadaEquipe.equipeId))
      .where(eq(temporadaEquipe.temporada, escopo));
    return linhas.sort((a, b) => a.posicao - b.posicao).map(({ patenteId, ...l }) => ({ ...l, patente: patenteId ? (todas.get(patenteId) ?? null) : null }));
  }

  const [equipes, membros, somas] = await Promise.all([db.select({ id: equipe.id, nome: equipe.nome }).from(equipe), membrosDasEquipes(db), somasDasEquipes(db, escopo)]);
  const linhas = equipes
    .map((e) => {
      const n = membros.get(e.id)?.length ?? 0;
      const s = somas.get(e.id);
      const pontos = s?.pontos ?? 0;
      return { e, n, pontos, media: n > 0 ? arredondar(pontos / n) : 0, ultimoEm: s?.ultimoEm ?? null, nome: e.nome };
    })
    .filter((l) => l.n > 0);
  // A equipe é ordenada pela média; a soma e a data do último lançamento desempatam.
  linhas.sort((a, b) => {
    if (b.media !== a.media) return b.media - a.media;
    if (b.pontos !== a.pontos) return b.pontos - a.pontos;
    if (a.ultimoEm && b.ultimoEm && a.ultimoEm.getTime() !== b.ultimoEm.getTime()) return a.ultimoEm.getTime() - b.ultimoEm.getTime();
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
  return linhas.map((l, i) => ({
    posicao: i + 1,
    equipeId: l.e.id,
    nome: l.e.nome,
    membros: l.n,
    pontos: l.pontos,
    media: l.media,
    patente: escopo === GERAL ? null : patenteDosPontos(l.media, escada),
  }));
}

/** Os rótulos do ranking como o `viewer` os enxerga: os anônimos aparecem sem nome, equipe nem link (só o próprio e o admin os veem). */
export function mascararPessoa<T extends { usuarioId: string; nome: string; equipeId: string | null; equipeNome: string | null; anonimo: boolean }>(linha: T, quem: Pick<UsuarioAutenticado, "id" | "perfil">) {
  if (!linha.anonimo || linha.usuarioId === quem.id || quem.perfil === "admin") return linha;
  return { ...linha, usuarioId: null, nome: NOME_ANONIMO, equipeId: null, equipeNome: null };
}
