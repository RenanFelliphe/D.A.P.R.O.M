import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "../db/conexao";
import {
  CRITERIOS_DE_EQUIPE,
  conquista,
  conquistaEquipe,
  conquistaUsuario,
  lancamentoEquipe,
  lancamentoPontos,
  os,
  patente,
  temporada,
  temporadaEquipe,
  temporadaUsuario,
  usuario,
  equipe,
  type Criterio,
  type RegraCodigo,
} from "../db/schema";
import { lancar, type ContextoDePontos, type Ganho } from "./lancamentos";
import { membrosDasEquipes } from "./ranking";

/**
 * Conquistas (seção 7 do `gameficacao.md`): troféus de pessoa e de equipe, permanentes. O servidor confere a cada lançamento
 * novo (para a pessoa e as equipes creditadas), no fechamento da temporada e quando o admin cria, edita ou reativa uma
 * conquista (aí confere todo mundo, e a data é a em que a meta foi batida, lida do extrato). Quem já tem a conquista não perde.
 */

export interface InfoDoCriterio {
  rotulo: string;
  tipo: "pessoa" | "equipe";
  /** A meta tem quantidade (todos, menos o treino e os critérios de patente). */
  pedeQuantidade: boolean;
  /** A meta é alcançar uma patente. */
  pedePatente: boolean;
  /** O que a quantidade conta, para o formulário ("APRs", "pontos", "primeiros"…). */
  unidade: string;
}

const pessoa = (rotulo: string, unidade: string, extra: Partial<InfoDoCriterio> = {}): InfoDoCriterio => ({ rotulo, tipo: "pessoa", pedeQuantidade: true, pedePatente: false, unidade, ...extra });
const time = (rotulo: string, unidade: string, extra: Partial<InfoDoCriterio> = {}): InfoDoCriterio => ({ rotulo, tipo: "equipe", pedeQuantidade: true, pedePatente: false, unidade, ...extra });

export const CRITERIOS_INFO: Record<Criterio, InfoDoCriterio> = {
  aprs_completas: pessoa("APRs completas", "APRs"),
  responsavel_apr: pessoa("Vezes responsável pela APR", "vezes"),
  execucoes_concluidas: pessoa("Execuções concluídas", "execuções"),
  preventivas_em_dia: pessoa("Preventivas em dia", "preventivas"),
  locais_criticos: pessoa("OS em locais críticos", "OS"),
  os_retomadas: pessoa("OS retomadas", "OS"),
  os_apoio: pessoa("OS de apoio", "OS"),
  tecnicos_novos: pessoa("Técnicos novos acompanhados", "técnicos"),
  locais_diferentes: pessoa("Locais diferentes", "locais"),
  ciencias_no_prazo: pessoa("Ciências no prazo (supervisor)", "ciências"),
  intervalos_definidos: pessoa("Intervalos de preventiva definidos (supervisor)", "planos"),
  campo_de_treino: pessoa("Campo de treino concluído", "", { pedeQuantidade: false }),
  pontos_gerais: pessoa("Pontos gerais", "pontos"),
  pontos_numa_temporada: pessoa("Pontos numa temporada", "pontos"),
  patente: pessoa("Patente alcançada numa temporada", "", { pedeQuantidade: false, pedePatente: true }),
  posicao: pessoa("Posição no fim de uma temporada", "primeiros"),
  temporadas: pessoa("Temporadas com pontos", "temporadas"),
  aprs_da_equipe: time("APRs da equipe", "APRs"),
  execucoes_da_equipe: time("Execuções da equipe", "execuções"),
  preventivas_em_dia_da_equipe: time("Preventivas em dia da equipe", "preventivas"),
  pontos_gerais_da_equipe: time("Pontos gerais da equipe", "pontos"),
  patente_da_equipe: time("Patente da equipe numa temporada", "", { pedeQuantidade: false, pedePatente: true }),
  posicao_da_equipe: time("Posição da equipe no fim de uma temporada", "primeiras"),
  temporadas_impecaveis: time("Temporadas impecáveis", "temporadas"),
};

export const ehCriterioDeEquipe = (criterio: string) => (CRITERIOS_DE_EQUIPE as readonly string[]).includes(criterio);

const pl = (n: number, um: string, varios: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;

/** A meta em texto ("Complete 50 APRs"). `patenteNome` só nos critérios de patente. */
export function textoDaMeta(c: { criterio: Criterio; quantidade: number }, patenteNome?: string | null): string {
  const n = c.quantidade;
  switch (c.criterio) {
    case "aprs_completas":
      return `Complete ${pl(n, "APR", "APRs")}`;
    case "responsavel_apr":
      return `Seja o responsável pela APR ${pl(n, "vez", "vezes")}`;
    case "execucoes_concluidas":
      return `Conclua ${pl(n, "execução", "execuções")}`;
    case "preventivas_em_dia":
      return `Encerre ${pl(n, "preventiva", "preventivas")} em dia`;
    case "locais_criticos":
      return `Conclua ${pl(n, "OS", "OS")} em locais críticos`;
    case "os_retomadas":
      return `Retome ${pl(n, "OS pendente", "OS pendentes")}`;
    case "os_apoio":
      return `Conclua ${pl(n, "OS de apoio", "OS de apoio")} a outras equipes`;
    case "tecnicos_novos":
      return `Acompanhe ${pl(n, "técnico novo", "técnicos novos")}`;
    case "locais_diferentes":
      return `Conclua serviços em ${n.toLocaleString("pt-BR")} ${n === 1 ? "local diferente" : "locais diferentes"}`;
    case "ciencias_no_prazo":
      return `Dê ${pl(n, "ciência", "ciências")} no prazo`;
    case "intervalos_definidos":
      return `Defina o intervalo de ${pl(n, "plano", "planos")} de preventiva`;
    case "campo_de_treino":
      return "Conclua o Campo de treino";
    case "pontos_gerais":
      return `Some ${pl(n, "ponto", "pontos")} no total`;
    case "pontos_numa_temporada":
      return `Some ${pl(n, "ponto", "pontos")} numa temporada`;
    case "patente":
      return `Alcance a patente ${patenteNome ?? ""} numa temporada`.replace("  ", " ");
    case "posicao":
      return n === 1 ? "Termine uma temporada em 1º lugar" : `Termine uma temporada entre os ${n} primeiros`;
    case "temporadas":
      return `Pontue em ${pl(n, "temporada", "temporadas")}`;
    case "aprs_da_equipe":
      return `A equipe completa ${pl(n, "APR", "APRs")}`;
    case "execucoes_da_equipe":
      return `A equipe conclui ${pl(n, "execução", "execuções")}`;
    case "preventivas_em_dia_da_equipe":
      return `A equipe encerra ${pl(n, "preventiva", "preventivas")} em dia`;
    case "pontos_gerais_da_equipe":
      return `A equipe soma ${pl(n, "ponto", "pontos")} no total`;
    case "patente_da_equipe":
      return `A média da equipe alcança a patente ${patenteNome ?? ""} numa temporada`.replace("  ", " ");
    case "posicao_da_equipe":
      return n === 1 ? "A equipe termina uma temporada em 1º lugar" : `A equipe termina uma temporada entre as ${n} primeiras`;
    case "temporadas_impecaveis":
      return `A equipe tem ${pl(n, "temporada impecável", "temporadas impecáveis")}`;
  }
}

export interface Meta {
  criterio: Criterio;
  quantidade: number;
  /** A pontuação necessária da patente-meta, nos critérios de patente. */
  patentePontos: number | null;
}

export interface Progresso {
  /** Onde a pessoa (ou equipe) está; `null` quando ainda não há valor (posição sem temporada fechada). */
  atual: number | null;
  meta: number;
  cumprida: boolean;
}

// ---- Dados da pessoa --------------------------------------------------------------------------------------------

interface LinhaDoExtrato {
  regra: string;
  pontos: number;
  ocorridoEm: Date;
  temporada: string;
  localId: string | null;
}

export interface DadosDaPessoa {
  /** O extrato inteiro, do mais antigo ao mais novo. */
  extrato: LinhaDoExtrato[];
  /** As temporadas fechadas em que a pessoa entrou: a posição e quando fecharam. */
  fechadas: { temporada: string; posicao: number; fechadaEm: Date | null }[];
}

export async function carregarDadosDaPessoa(db: Db, usuarioId: string): Promise<DadosDaPessoa> {
  const extrato = await db
    .select({
      regra: lancamentoPontos.regra,
      pontos: lancamentoPontos.pontos,
      ocorridoEm: lancamentoPontos.ocorridoEm,
      temporada: lancamentoPontos.temporada,
      localId: os.localInstalacaoId,
    })
    .from(lancamentoPontos)
    .leftJoin(os, eq(os.id, lancamentoPontos.osId))
    .where(eq(lancamentoPontos.usuarioId, usuarioId))
    .orderBy(asc(lancamentoPontos.ocorridoEm), asc(lancamentoPontos.criadoEm), asc(lancamentoPontos.id));
  const fechadas = await db
    .select({ temporada: temporadaUsuario.temporada, posicao: temporadaUsuario.posicao, fechadaEm: temporada.fechadaEm })
    .from(temporadaUsuario)
    .innerJoin(temporada, eq(temporada.codigo, temporadaUsuario.temporada))
    .where(eq(temporadaUsuario.usuarioId, usuarioId));
  return { extrato, fechadas };
}

const REGRA_DO_CRITERIO: Partial<Record<Criterio, RegraCodigo>> = {
  aprs_completas: "apr_completa",
  responsavel_apr: "responsavel_apr",
  execucoes_concluidas: "execucao_concluida",
  preventivas_em_dia: "preventiva_em_dia",
  locais_criticos: "local_critico",
  os_retomadas: "resgate",
  os_apoio: "apoio",
  tecnicos_novos: "tecnico_novo",
  ciencias_no_prazo: "ciencia_no_prazo",
  intervalos_definidos: "intervalo_definido",
  campo_de_treino: "treinamento_concluido",
  aprs_da_equipe: "apr_completa",
  execucoes_da_equipe: "execucao_concluida",
  preventivas_em_dia_da_equipe: "preventiva_em_dia",
};

/** Soma dos pontos do extrato por temporada. */
function pontosPorTemporada(extrato: LinhaDoExtrato[]): Map<string, number> {
  const soma = new Map<string, number>();
  for (const l of extrato) soma.set(l.temporada, (soma.get(l.temporada) ?? 0) + l.pontos);
  return soma;
}

const naoVazio = <T>(lista: T[]) => lista.length > 0;

/** Onde a pessoa está em relação à meta. */
export function progressoDaPessoa(m: Meta, d: DadosDaPessoa): Progresso {
  const regra = REGRA_DO_CRITERIO[m.criterio];
  const contar = (r: string) => d.extrato.filter((l) => l.regra === r).length;
  const por = (atual: number, meta: number): Progresso => ({ atual, meta, cumprida: atual >= meta });

  if (regra) return por(contar(regra), m.criterio === "campo_de_treino" ? 1 : m.quantidade);
  switch (m.criterio) {
    case "locais_diferentes":
      return por(new Set(d.extrato.filter((l) => l.regra === "execucao_concluida" && l.localId).map((l) => l.localId)).size, m.quantidade);
    case "pontos_gerais":
      return por(d.extrato.reduce((t, l) => t + l.pontos, 0), m.quantidade);
    case "pontos_numa_temporada":
      return por(Math.max(0, ...pontosPorTemporada(d.extrato).values()), m.quantidade);
    case "patente":
      return por(Math.max(0, ...pontosPorTemporada(d.extrato).values()), m.patentePontos ?? Number.MAX_SAFE_INTEGER);
    case "temporadas":
      return por([...pontosPorTemporada(d.extrato).values()].filter((p) => p >= 1).length, m.quantidade);
    case "posicao": {
      const melhor = naoVazio(d.fechadas) ? Math.min(...d.fechadas.map((f) => f.posicao)) : null;
      return { atual: melhor, meta: m.quantidade, cumprida: melhor !== null && melhor <= m.quantidade };
    }
    default:
      return { atual: null, meta: m.quantidade, cumprida: false };
  }
}

/** A data em que a pessoa bateu a meta, lida do extrato (o instante do lançamento que a completou). */
export function quandoBateuPessoa(m: Meta, d: DadosDaPessoa): Date | null {
  const regra = REGRA_DO_CRITERIO[m.criterio];
  if (regra) return d.extrato.filter((l) => l.regra === regra)[(m.criterio === "campo_de_treino" ? 1 : m.quantidade) - 1]?.ocorridoEm ?? null;
  switch (m.criterio) {
    case "locais_diferentes": {
      const primeira = new Map<string, Date>();
      for (const l of d.extrato) if (l.regra === "execucao_concluida" && l.localId && !primeira.has(l.localId)) primeira.set(l.localId, l.ocorridoEm);
      return [...primeira.values()].sort((a, b) => a.getTime() - b.getTime())[m.quantidade - 1] ?? null;
    }
    case "pontos_gerais": {
      let soma = 0;
      for (const l of d.extrato) {
        soma += l.pontos;
        if (soma >= m.quantidade) return l.ocorridoEm;
      }
      return null;
    }
    case "pontos_numa_temporada":
    case "patente": {
      const alvo = m.criterio === "patente" ? (m.patentePontos ?? Number.MAX_SAFE_INTEGER) : m.quantidade;
      const somas = new Map<string, number>();
      let primeiro: Date | null = null;
      for (const l of d.extrato) {
        const s = (somas.get(l.temporada) ?? 0) + l.pontos;
        somas.set(l.temporada, s);
        if (s >= alvo && (!primeiro || l.ocorridoEm < primeiro)) primeiro = l.ocorridoEm;
      }
      return primeiro;
    }
    case "temporadas": {
      const primeira = new Map<string, Date>();
      const somas = new Map<string, number>();
      for (const l of d.extrato) {
        const s = (somas.get(l.temporada) ?? 0) + l.pontos;
        somas.set(l.temporada, s);
        if (s >= 1 && !primeira.has(l.temporada)) primeira.set(l.temporada, l.ocorridoEm);
      }
      return [...primeira.values()].sort((a, b) => a.getTime() - b.getTime())[m.quantidade - 1] ?? null;
    }
    case "posicao": {
      const datas = d.fechadas.filter((f) => f.posicao <= m.quantidade && f.fechadaEm).map((f) => f.fechadaEm!);
      return datas.sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
    }
    default:
      return null;
  }
}

// ---- Dados da equipe --------------------------------------------------------------------------------------------

export interface DadosDaEquipe {
  aprs: number;
  execucoes: number;
  preventivas: number;
  pontosGerais: number;
  /** A maior média por membro numa temporada, fechada ou ainda aberta. */
  melhorMedia: number;
  melhorPosicao: number | null;
  impecaveis: number;
}

/** `membros`: as pessoas de cada equipe (`membrosDasEquipes`), para quem confere várias equipes de uma vez. */
export async function carregarDadosDaEquipe(db: Db, equipeId: string, membros?: Map<string, unknown[]>): Promise<DadosDaEquipe> {
  const porRegra = await db
    .select({
      regra: lancamentoPontos.regra,
      os: sql<number>`count(distinct ${lancamentoPontos.osId})::int`,
      pontos: sql<number>`coalesce(sum(${lancamentoPontos.pontos}), 0)::int`,
    })
    .from(lancamentoEquipe)
    .innerJoin(lancamentoPontos, eq(lancamentoPontos.id, lancamentoEquipe.lancamentoId))
    .where(eq(lancamentoEquipe.equipeId, equipeId))
    .groupBy(lancamentoPontos.regra);
  const os_ = (r: RegraCodigo) => porRegra.find((l) => l.regra === r)?.os ?? 0;

  const fechadas = await db
    .select({ posicao: temporadaEquipe.posicao, impecavel: temporadaEquipe.impecavel, media: temporadaEquipe.media })
    .from(temporadaEquipe)
    .where(eq(temporadaEquipe.equipeId, equipeId));

  // As temporadas ainda abertas: a média de hoje (soma creditada / pessoas de hoje).
  const abertas = await db
    .select({ pontos: sql<number>`coalesce(sum(${lancamentoPontos.pontos}), 0)::int` })
    .from(lancamentoEquipe)
    .innerJoin(lancamentoPontos, eq(lancamentoPontos.id, lancamentoEquipe.lancamentoId))
    .innerJoin(temporada, eq(temporada.codigo, lancamentoPontos.temporada))
    .where(and(eq(lancamentoEquipe.equipeId, equipeId), isNull(temporada.fechadaEm)))
    .groupBy(lancamentoPontos.temporada);
  const pessoas = (membros ?? (await membrosDasEquipes(db))).get(equipeId)?.length ?? 0;
  const mediasAbertas = pessoas > 0 ? abertas.map((a) => a.pontos / pessoas) : [];

  return {
    aprs: os_("apr_completa"),
    execucoes: os_("execucao_concluida"),
    preventivas: os_("preventiva_em_dia"),
    pontosGerais: porRegra.reduce((t, l) => t + l.pontos, 0),
    melhorMedia: Math.max(0, ...fechadas.map((f) => f.media), ...mediasAbertas),
    melhorPosicao: fechadas.length > 0 ? Math.min(...fechadas.map((f) => f.posicao)) : null,
    impecaveis: fechadas.filter((f) => f.impecavel).length,
  };
}

export function progressoDaEquipe(m: Meta, d: DadosDaEquipe): Progresso {
  const por = (atual: number, meta: number): Progresso => ({ atual, meta, cumprida: atual >= meta });
  switch (m.criterio) {
    case "aprs_da_equipe":
      return por(d.aprs, m.quantidade);
    case "execucoes_da_equipe":
      return por(d.execucoes, m.quantidade);
    case "preventivas_em_dia_da_equipe":
      return por(d.preventivas, m.quantidade);
    case "pontos_gerais_da_equipe":
      return por(d.pontosGerais, m.quantidade);
    case "patente_da_equipe":
      return por(Math.round(d.melhorMedia * 100) / 100, m.patentePontos ?? Number.MAX_SAFE_INTEGER);
    case "posicao_da_equipe":
      return { atual: d.melhorPosicao, meta: m.quantidade, cumprida: d.melhorPosicao !== null && d.melhorPosicao <= m.quantidade };
    case "temporadas_impecaveis":
      return por(d.impecaveis, m.quantidade);
    default:
      return { atual: null, meta: m.quantidade, cumprida: false };
  }
}

const daBase = (v: Date | string | null | undefined) => (v === null || v === undefined ? null : v instanceof Date ? v : new Date(v));

/** A data em que a equipe bateu a meta: do extrato (lançamentos creditados a ela) ou do fechamento da temporada. */
export async function quandoBateuEquipe(db: Db, m: Meta, equipeId: string): Promise<Date | null> {
  const regra = REGRA_DO_CRITERIO[m.criterio];
  if (regra) {
    const [linha] = await db
      .select({ d: sql<Date | string>`min(${lancamentoPontos.ocorridoEm})` })
      .from(lancamentoEquipe)
      .innerJoin(lancamentoPontos, eq(lancamentoPontos.id, lancamentoEquipe.lancamentoId))
      .where(and(eq(lancamentoEquipe.equipeId, equipeId), eq(lancamentoPontos.regra, regra)))
      .groupBy(lancamentoPontos.osId)
      .orderBy(sql`min(${lancamentoPontos.ocorridoEm})`)
      .limit(1)
      .offset(m.quantidade - 1);
    return daBase(linha?.d);
  }
  switch (m.criterio) {
    case "pontos_gerais_da_equipe": {
      const linhas = await db
        .select({ pontos: lancamentoPontos.pontos, ocorridoEm: lancamentoPontos.ocorridoEm })
        .from(lancamentoEquipe)
        .innerJoin(lancamentoPontos, eq(lancamentoPontos.id, lancamentoEquipe.lancamentoId))
        .where(eq(lancamentoEquipe.equipeId, equipeId))
        .orderBy(asc(lancamentoPontos.ocorridoEm), asc(lancamentoPontos.id));
      let soma = 0;
      for (const l of linhas) {
        soma += l.pontos;
        if (soma >= m.quantidade) return l.ocorridoEm;
      }
      return null;
    }
    case "patente_da_equipe":
    case "posicao_da_equipe":
    case "temporadas_impecaveis": {
      const condicao =
        m.criterio === "patente_da_equipe"
          ? sql`${temporadaEquipe.media} >= ${m.patentePontos ?? Number.MAX_SAFE_INTEGER}`
          : m.criterio === "posicao_da_equipe"
            ? sql`${temporadaEquipe.posicao} <= ${m.quantidade}`
            : sql`${temporadaEquipe.impecavel}`;
      const linhas = await db
        .select({ fechadaEm: temporada.fechadaEm })
        .from(temporadaEquipe)
        .innerJoin(temporada, eq(temporada.codigo, temporadaEquipe.temporada))
        .where(and(eq(temporadaEquipe.equipeId, equipeId), condicao))
        .orderBy(asc(temporada.fechadaEm));
      const datas = linhas.map((l) => l.fechadaEm).filter((x): x is Date => x !== null);
      return (m.criterio === "temporadas_impecaveis" ? datas[m.quantidade - 1] : datas[0]) ?? null;
    }
    default:
      return null;
  }
}

// ---- Concessão --------------------------------------------------------------------------------------------------

type LinhaDaConquista = typeof conquista.$inferSelect;

/** A meta de uma conquista, com a pontuação necessária da patente (se houver). */
async function metasDasConquistas(db: Db, linhas: LinhaDaConquista[]): Promise<Map<string, Meta>> {
  const ids = [...new Set(linhas.map((c) => c.patenteId).filter((id): id is string => id !== null))];
  const patentes = ids.length ? await db.select({ id: patente.id, pontos: patente.pontosNecessarios }).from(patente).where(inArray(patente.id, ids)) : [];
  const pontosDa = new Map(patentes.map((p) => [p.id, p.pontos]));
  return new Map(linhas.map((c) => [c.id, { criterio: c.criterio, quantidade: c.quantidade, patentePontos: c.patenteId ? (pontosDa.get(c.patenteId) ?? null) : null }]));
}

export interface Concedida {
  conquistaId: string;
  titulo: string;
  usuarioId?: string;
  equipeId?: string;
  obtidaEm: Date;
}

export interface ResultadoDaConcessao {
  concedidas: Concedida[];
  /** Os lançamentos dos pontos das conquistas de pessoa (regra `conquista_obtida`). */
  ganhos: Ganho[];
}

const RODADAS_MAXIMAS = 6;

/**
 * Concede as conquistas que as pessoas e as equipes já cumprem e ainda não têm. A conquista de pessoa com pontos lança
 * `conquista:<id>` no extrato (com a data em que a meta foi batida, que cai na temporada aberta se a antiga já fechou), o que
 * pode cumprir outra meta (pontos gerais, patente): repete até estabilizar. `soConquista` limita a conferência a uma
 * conquista (quando o admin a cria, edita ou reativa). Só quem joga (técnico ativo) recebe conquistas de pessoa.
 */
export async function concederConquistas(c: ContextoDePontos, alvo: { usuarios?: Iterable<string>; equipes?: Iterable<string>; soConquista?: string }): Promise<ResultadoDaConcessao> {
  const resultado: ResultadoDaConcessao = { concedidas: [], ganhos: [] };
  let usuarios = new Set(alvo.usuarios ?? []);
  let equipes = new Set(alvo.equipes ?? []);
  if (usuarios.size === 0 && equipes.size === 0) return resultado;

  const ativas = await c.tx
    .select()
    .from(conquista)
    .where(alvo.soConquista ? and(eq(conquista.ativa, true), eq(conquista.id, alvo.soConquista)) : eq(conquista.ativa, true));
  if (ativas.length === 0) return resultado;
  const metas = await metasDasConquistas(c.tx, ativas);
  const dePessoa = ativas.filter((x) => !ehCriterioDeEquipe(x.criterio));
  const deEquipe = ativas.filter((x) => ehCriterioDeEquipe(x.criterio));
  const membros = deEquipe.length > 0 ? await membrosDasEquipes(c.tx) : new Map();

  const naoPosterior = (d: Date | null) => (d && d.getTime() <= c.agora.getTime() ? d : c.agora);

  for (let rodada = 0; rodada < RODADAS_MAXIMAS && (usuarios.size > 0 || equipes.size > 0); rodada++) {
    const usuariosDaProxima = new Set<string>();
    const equipesDaProxima = new Set<string>();

    if (dePessoa.length > 0 && usuarios.size > 0) {
      const jogadores = await c.tx
        .select({ id: usuario.id })
        .from(usuario)
        .where(and(inArray(usuario.id, [...usuarios]), eq(usuario.perfil, "tecnico"), eq(usuario.ativo, true)));
      for (const { id: usuarioId } of jogadores) {
        const obtidas = new Set((await c.tx.select({ id: conquistaUsuario.conquistaId }).from(conquistaUsuario).where(eq(conquistaUsuario.usuarioId, usuarioId))).map((o) => o.id));
        const faltam = dePessoa.filter((x) => !obtidas.has(x.id));
        if (faltam.length === 0) continue;
        const dados = await carregarDadosDaPessoa(c.tx, usuarioId);
        for (const x of faltam) {
          const meta = metas.get(x.id)!;
          if (!progressoDaPessoa(meta, dados).cumprida) continue;
          const obtidaEm = naoPosterior(quandoBateuPessoa(meta, dados));
          const [nova] = await c.tx.insert(conquistaUsuario).values({ conquistaId: x.id, usuarioId, obtidaEm }).onConflictDoNothing().returning({ id: conquistaUsuario.conquistaId });
          if (!nova) continue;
          resultado.concedidas.push({ conquistaId: x.id, titulo: x.titulo, usuarioId, obtidaEm });
          if (x.pontos > 0) {
            // O valor vem da conquista; a tarefa `conquista_obtida` só liga ou desliga os pontos de todas.
            const ganhos = await lancar(c, [{ usuarioId, regra: "conquista_obtida", chave: `conquista:${x.id}`, ocorridoEm: obtidaEm, pontos: x.pontos, nome: `Conquista: ${x.titulo}` }]);
            for (const g of ganhos) {
              resultado.ganhos.push(g);
              usuariosDaProxima.add(g.usuarioId);
              g.equipes.forEach((e) => equipesDaProxima.add(e));
            }
          }
        }
      }
    }

    if (deEquipe.length > 0 && equipes.size > 0) {
      for (const equipeId of equipes) {
        const obtidas = new Set((await c.tx.select({ id: conquistaEquipe.conquistaId }).from(conquistaEquipe).where(eq(conquistaEquipe.equipeId, equipeId))).map((o) => o.id));
        const faltam = deEquipe.filter((x) => !obtidas.has(x.id));
        if (faltam.length === 0) continue;
        const dados = await carregarDadosDaEquipe(c.tx, equipeId, membros);
        for (const x of faltam) {
          const meta = metas.get(x.id)!;
          if (!progressoDaEquipe(meta, dados).cumprida) continue;
          const obtidaEm = naoPosterior(await quandoBateuEquipe(c.tx, meta, equipeId));
          const [nova] = await c.tx.insert(conquistaEquipe).values({ conquistaId: x.id, equipeId, obtidaEm }).onConflictDoNothing().returning({ id: conquistaEquipe.conquistaId });
          if (nova) resultado.concedidas.push({ conquistaId: x.id, titulo: x.titulo, equipeId, obtidaEm });
        }
      }
    }

    usuarios = usuariosDaProxima;
    equipes = equipesDaProxima;
  }
  return resultado;
}

/**
 * Confere todo mundo (técnicos ativos e todas as equipes): quando o admin cria, edita ou reativa uma conquista, ou muda uma
 * patente, e depois do fechamento de uma temporada. `soConquista` limita a uma conquista.
 */
export async function conferirTodos(c: ContextoDePontos, opcoes: { soConquista?: string } = {}): Promise<ResultadoDaConcessao> {
  const pessoas = await c.tx.select({ id: usuario.id }).from(usuario).where(and(eq(usuario.perfil, "tecnico"), eq(usuario.ativo, true)));
  const times = await c.tx.select({ id: equipe.id }).from(equipe);
  const resultado = await concederConquistas(c, { usuarios: pessoas.map((p) => p.id), equipes: times.map((e) => e.id), ...opcoes });
  // Os pontos de uma conquista recém-concedida podem cumprir a meta de outra (pontos gerais, patente): confere as demais para quem ganhou.
  if (opcoes.soConquista && resultado.ganhos.length > 0) {
    const depois = await concederConquistas(c, { usuarios: resultado.ganhos.map((g) => g.usuarioId), equipes: resultado.ganhos.flatMap((g) => g.equipes) });
    resultado.concedidas.push(...depois.concedidas);
    resultado.ganhos.push(...depois.ganhos);
  }
  return resultado;
}
