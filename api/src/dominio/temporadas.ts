import { desc, eq } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { temporada } from "../db/schema";
import { diaDe } from "./tempo";

/**
 * Temporadas da gamificação (seção 4 do `gameficacao.md`): um trimestre do calendário no fuso de São Paulo. O nome vem da
 * estação que ocupa a maior parte do trimestre. A linha de `temporada` nasce quando a primeira pontuação do trimestre chega
 * (`garantirTemporada`) e é fechada 7 dias depois do último dia (`fechamento-temporada.ts`).
 */

/** Dias depois do último dia do trimestre em que ainda chegam lançamentos dele (a fila offline) antes do fechamento. */
export const TOLERANCIA_DIAS = 7;

const ESTACOES = ["Verão", "Outono", "Inverno", "Primavera"] as const;
const FORMATO = /^(\d{4})-T([1-4])$/;

export const ehCodigoDeTemporada = (texto: string) => FORMATO.test(texto);

/** `2026-T4` para um instante: o trimestre do dia de São Paulo. */
export function codigoDaTemporada(instante: Date): string {
  const [ano, mes] = diaDe(instante).split("-").map(Number) as [number, number];
  return `${ano}-T${Math.ceil(mes / 3)}`;
}

const dois = (n: number) => String(n).padStart(2, "0");

export interface DadosDaTemporada {
  codigo: string;
  nome: string;
  /** `AAAA-MM-DD`, o primeiro dia. */
  inicio: string;
  /** `AAAA-MM-DD`, o último dia. */
  fim: string;
}

/** Nome e limites de uma temporada pelo código (`2026-T4` → Primavera 2026, 01/10 a 31/12). */
export function dadosDaTemporada(codigo: string): DadosDaTemporada {
  const m = FORMATO.exec(codigo);
  if (!m) throw new Error(`Código de temporada inválido: ${codigo}`);
  const ano = Number(m[1]);
  const trimestre = Number(m[2]);
  const mesInicial = (trimestre - 1) * 3 + 1;
  const ultimoDia = new Date(Date.UTC(ano, mesInicial + 2, 0)).getUTCDate();
  return {
    codigo,
    nome: `${ESTACOES[trimestre - 1]} ${ano}`,
    inicio: `${ano}-${dois(mesInicial)}-01`,
    fim: `${ano}-${dois(mesInicial + 2)}-${dois(ultimoDia)}`,
  };
}

export const temporadaAtual = (agora: Date): DadosDaTemporada => dadosDaTemporada(codigoDaTemporada(agora));

const somarDias = (dia: string, dias: number) => {
  const [a, m, d] = dia.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
};

/** O último dia em que a temporada ainda aceita lançamentos do trimestre dela. */
export const fimDaTolerancia = (codigo: string) => somarDias(dadosDaTemporada(codigo).fim, TOLERANCIA_DIAS);

/** A temporada já passou da tolerância: a partir do dia seguinte ao último dia da tolerância, ela deve estar fechada. */
export const passouATolerancia = (codigo: string, agora: Date) => diaDe(agora) > fimDaTolerancia(codigo);

/** O código do trimestre seguinte (`2026-T4` → `2027-T1`). */
export function temporadaSeguinte(codigo: string): string {
  const m = FORMATO.exec(codigo)!;
  const ano = Number(m[1]);
  const t = Number(m[2]);
  return t === 4 ? `${ano + 1}-T1` : `${ano}-T${t + 1}`;
}

/** Cria a linha da temporada, se ainda não existe. */
export async function garantirTemporada(db: Db, codigo: string): Promise<void> {
  const d = dadosDaTemporada(codigo);
  await db.insert(temporada).values({ codigo: d.codigo, nome: d.nome, inicio: d.inicio, fim: d.fim }).onConflictDoNothing();
}

/**
 * Em que temporada entra um lançamento que aconteceu em `ocorridoEm`: a do trimestre dele; se ela já fechou (ou já passou da
 * tolerância e está para fechar), entra na temporada aberta, a de `agora`. Garante que a linha da temporada existe. Com
 * `historico` (o preenchimento da implantação) vale sempre o trimestre real: as temporadas passadas nascem fechadas depois.
 */
export async function temporadaParaLancar(db: Db, ocorridoEm: Date, agora: Date, historico = false): Promise<string> {
  let codigo = codigoDaTemporada(ocorridoEm);
  if (!historico) {
    const [linha] = await db.select({ fechadaEm: temporada.fechadaEm }).from(temporada).where(eq(temporada.codigo, codigo));
    if (linha?.fechadaEm || passouATolerancia(codigo, agora)) codigo = codigoDaTemporada(agora);
  }
  await garantirTemporada(db, codigo);
  return codigo;
}

export interface TemporadaDaLista extends DadosDaTemporada {
  fechadaEm: Date | null;
  /** É o trimestre de hoje. */
  atual: boolean;
}

/** As temporadas conhecidas (as que tiveram pontuação) mais a de hoje, da mais nova à mais antiga. */
export async function listarTemporadas(db: Db, agora: Date): Promise<TemporadaDaLista[]> {
  const linhas = await db.select().from(temporada).orderBy(desc(temporada.codigo));
  const hoje = codigoDaTemporada(agora);
  const lista: TemporadaDaLista[] = linhas.map((l) => ({ codigo: l.codigo, nome: l.nome, inicio: l.inicio, fim: l.fim, fechadaEm: l.fechadaEm, atual: l.codigo === hoje }));
  if (!lista.some((t) => t.atual)) lista.unshift({ ...dadosDaTemporada(hoje), fechadaEm: null, atual: true });
  return lista.sort((a, b) => b.codigo.localeCompare(a.codigo));
}
