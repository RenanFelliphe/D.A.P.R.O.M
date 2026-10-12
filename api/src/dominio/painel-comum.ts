import { and, inArray, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { os, type OsStatus } from "../db/schema";
import { equipesDoEscopo, type UsuarioAutenticado } from "../http/autenticacao";

/** Fuso de "dia" e de hora exibida; os instantes ficam em UTC no banco. */
export const FUSO = "America/Sao_Paulo";

const formatador = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function partes(instante: Date): Record<string, string> {
  return Object.fromEntries(formatador.formatToParts(instante).map((p) => [p.type, p.value]));
}

/** `AAAA-MM-DD` do instante no fuso de São Paulo: o "dia de hoje" das regras de atraso. */
export function diaNoFuso(instante: Date): string {
  const p = partes(instante);
  return `${p.year}-${p.month}-${p.day}`;
}

/** `dd/mm/aaaa` no fuso de São Paulo. */
export function dataBr(instante: Date): string {
  const p = partes(instante);
  return `${p.day}/${p.month}/${p.year}`;
}

/** `hh:mm` no fuso de São Paulo. */
export function horaBr(instante: Date): string {
  const p = partes(instante);
  return `${p.hour}:${p.minute}`;
}

/** `dd/mm/aaaa hh:mm` no fuso de São Paulo. */
export const dataHoraBr = (instante: Date) => `${dataBr(instante)} ${horaBr(instante)}`;

/** `AAAA-MM-DD` → `dd/mm/aaaa` (colunas `date`, sem fuso). */
export const diaBr = (dia: string) => dia.split("-").reverse().join("/");

/** Mês `AAAA-MM`: de `AAAA-MM-01` (inclusive) ao primeiro dia do mês seguinte (exclusive). */
export function intervaloDoMes(mes: string): { inicio: string; fim: string } {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  const proximo = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
  return { inicio: `${mes}-01`, fim: `${proximo}-01` };
}

/** Limita `coluna` às equipes do escopo da pessoa: sem limite para quem vê todas, nada para quem não tem equipe. */
export function noEscopo(eu: UsuarioAutenticado, coluna: AnyColumn): SQL | undefined {
  const equipes = equipesDoEscopo(eu);
  if (equipes === null) return undefined;
  return equipes.length === 0 ? sql`false` : inArray(coluna, equipes);
}

/** Condição de equipe da OS para quem só vê as suas equipes (a própria e as que supervisiona); sem nenhuma, não vê nada. */
export const condicaoEscopo = (eu: UsuarioAutenticado) => noEscopo(eu, os.equipeId);

/** `a and b and ...` ignorando o que for indefinido. */
export const todas = (...condicoes: (SQL | undefined)[]) => and(...condicoes);

/** Data de referência do atraso: `data_fim_prog` quando existe, senão `data_inicio_prog` (suposição 39). */
export const dataDeReferencia = (o: { dataInicioProg: string; dataFimProg: string | null }) => o.dataFimProg ?? o.dataInicioProg;

/** Atrasada: referência anterior ao dia de hoje e ainda não executada (`liberada` ou `pendente`). */
export function estaAtrasada(o: { status: OsStatus; dataInicioProg: string; dataFimProg: string | null }, hoje: string): boolean {
  return (o.status === "liberada" || o.status === "pendente") && dataDeReferencia(o) < hoje;
}

export interface Intervalo {
  inicio: Date;
  fim: Date | null;
}

export interface TempoDaExecucao {
  totalMs: number;
  pausaMs: number;
  liquidoMs: number;
}

/**
 * Tempo da Execução: o total é `fim − inicio`; a pausa é a soma das pausas recortadas na janela da Execução (uma
 * pausa que ficou aberta vale até o `fim`); o líquido é a diferença. Em andamento (sem `fim`) não há tempo.
 */
export function tempoDaExecucao(execucao: Intervalo, pausas: Intervalo[]): TempoDaExecucao | null {
  if (execucao.fim === null) return null;
  const fim = execucao.fim.getTime();
  const inicio = execucao.inicio.getTime();
  let pausaMs = 0;
  for (const p of pausas) {
    const de = Math.max(p.inicio.getTime(), inicio);
    const ate = Math.min((p.fim ?? execucao.fim).getTime(), fim);
    if (ate > de) pausaMs += ate - de;
  }
  const totalMs = fim - inicio;
  return { totalMs, pausaMs, liquidoMs: totalMs - pausaMs };
}

export const emMinutos = (ms: number) => Math.round(ms / 60_000);

/** Média com uma casa decimal; `null` quando não há o que medir. */
export const arredondar = (valor: number, casas = 1) => {
  const f = 10 ** casas;
  return Math.round(valor * f) / f;
};

export const ordenarPorInstante = <T extends { em: Date }>(itens: T[]) => itens.map((item, i) => ({ item, i })).sort((a, b) => a.item.em.getTime() - b.item.em.getTime() || a.i - b.i).map((x) => x.item);
