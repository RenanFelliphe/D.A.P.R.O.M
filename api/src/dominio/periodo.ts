import { sql, type AnyColumn } from "drizzle-orm";
import { z } from "zod";
import { FUSO } from "./painel-comum";

/**
 * Período dos dashboards de Indicadores e exportação (`?periodo=`): os últimos 7 ou 30 dias (um ponto por dia), as
 * últimas 13 semanas (≈ 90 dias, semanas de segunda a domingo), os últimos 12 meses, ou um mês fechado `AAAA-MM` (um
 * ponto por dia, comparado com o mês anterior; é o indicador mensal de preventivas). Nos móveis, o ponto mais recente é
 * sempre o que contém hoje.
 */
export const PERIODOS_MOVEIS = ["7d", "30d", "90d", "12m"] as const;
export type PeriodoMovel = (typeof PERIODOS_MOVEIS)[number];
export type Periodo = PeriodoMovel | `${number}-${number}`;
export type Agrupamento = "dia" | "semana" | "mes";

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

/** `?periodo=` de todos os dashboards; 30 dias quando não vem. */
export const esquemaPeriodo = z
  .string()
  .refine((v) => (PERIODOS_MOVEIS as readonly string[]).includes(v) || MES.test(v), "Use 7d, 30d, 90d, 12m ou um mês AAAA-MM")
  .default("30d")
  .transform((v) => v as Periodo);

/** Faixa de dias `[inicio, fim)`, em `AAAA-MM-DD` no fuso de São Paulo. */
export interface FaixaDeDias {
  inicio: string;
  fim: string;
}

const paraDia = (d: Date) => d.toISOString().slice(0, 10);
const partes = (dia: string) => dia.split("-").map(Number) as [number, number, number];

/** `AAAA-MM-DD` mais `n` dias (menos, com `n` negativo). */
export function somarDias(dia: string, n: number): string {
  const [a, m, d] = partes(dia);
  return paraDia(new Date(Date.UTC(a, m - 1, d + n)));
}

/** Primeiro dia do mês de `dia`, deslocado `n` meses. */
function inicioDoMes(dia: string, n = 0): string {
  const [a, m] = partes(dia);
  return paraDia(new Date(Date.UTC(a, m - 1 + n, 1)));
}

/** Segunda-feira da semana de `dia`. */
function segundaFeira(dia: string): string {
  const [a, m, d] = partes(dia);
  const diaDaSemana = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return somarDias(dia, -((diaDaSemana + 6) % 7));
}

/** As faixas do período, da mais antiga à mais recente, e o período anterior de mesmo tamanho (a comparação). */
export function faixasDoPeriodo(periodo: Periodo, hoje: string): { agrupamento: Agrupamento; faixas: FaixaDeDias[]; anterior: FaixaDeDias } {
  if (MES.test(periodo)) {
    const inicio = `${periodo}-01`;
    const fim = inicioDoMes(inicio, 1);
    const dias = Math.round((Date.parse(fim) - Date.parse(inicio)) / 86_400_000);
    return {
      agrupamento: "dia",
      faixas: Array.from({ length: dias }, (_, i) => ({ inicio: somarDias(inicio, i), fim: somarDias(inicio, i + 1) })),
      anterior: { inicio: inicioDoMes(inicio, -1), fim: inicio },
    };
  }
  const [agrupamento, n, inicioDa]: [Agrupamento, number, (i: number) => string] =
    periodo === "7d"
      ? ["dia", 7, (i) => somarDias(hoje, i - 6)]
      : periodo === "30d"
        ? ["dia", 30, (i) => somarDias(hoje, i - 29)]
        : periodo === "90d"
          ? ["semana", 13, (i) => somarDias(segundaFeira(hoje), 7 * (i - 12))]
          : ["mes", 12, (i) => inicioDoMes(hoje, i - 11)];
  return {
    agrupamento,
    faixas: Array.from({ length: n }, (_, i) => ({ inicio: inicioDa(i), fim: inicioDa(i + 1) })),
    anterior: { inicio: inicioDa(-n), fim: inicioDa(0) },
  };
}

/** O período resolvido: as faixas, o intervalo `[inicio, fim)` inteiro, o anterior e o `de`/`ate` que a tela mostra. */
export function resolverPeriodo(periodo: Periodo, hoje: string) {
  const { agrupamento, faixas, anterior } = faixasDoPeriodo(periodo, hoje);
  const inicio = faixas[0]!.inicio;
  const fim = faixas.at(-1)!.fim;
  const ultimoDia = somarDias(fim, -1);
  return { periodo, agrupamento, faixas, anterior, inicio, fim, de: inicio, ate: hoje < ultimoDia ? hoje : ultimoDia };
}

/** O fuso como literal no SQL: como parâmetro (`$1`), o `group by` não reconheceria a mesma expressão do `select`. */
const fuso = sql.raw(`'${FUSO}'`);

/** Instante (timestamptz) dentro de `[inicio, fim)`, com os dias no fuso de São Paulo. */
export const instanteEntre = (coluna: AnyColumn, inicio: string, fim: string) =>
  sql`${coluna} >= (${inicio}::timestamp at time zone ${fuso}) and ${coluna} < (${fim}::timestamp at time zone ${fuso})`;

/** Dia (coluna `date`) dentro de `[inicio, fim)`. */
export const diaEntre = (coluna: AnyColumn, inicio: string, fim: string) => sql`${coluna} >= ${inicio}::date and ${coluna} < ${fim}::date`;

/** `AAAA-MM-DD` do instante no fuso de São Paulo, para agrupar por dia no banco. */
export const diaDoInstante = (coluna: AnyColumn) => sql<string>`to_char(${coluna} at time zone ${fuso}, 'YYYY-MM-DD')`;

/** A faixa do período que contém o dia, ou `undefined` quando ele fica fora. */
export const faixaDoDia = <T extends FaixaDeDias>(faixas: T[], dia: string) => faixas.find((f) => dia >= f.inicio && dia < f.fim);
