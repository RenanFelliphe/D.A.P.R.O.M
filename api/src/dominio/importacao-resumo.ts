import { sql } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { importacao } from "../db/schema";
import { diaNoFuso } from "./painel-comum";
import { resolverPeriodo, type Periodo } from "./periodo";

export { faixasDoPeriodo, somarDias, type Agrupamento, type FaixaDeDias } from "./periodo";

interface Contagens {
  criadas: number;
  atualizadas: number;
  ignoradas: number;
  /** Leituras (API) ou arquivos (planilha). */
  registros: number;
  comErro: number;
}

const zeradas = (): Contagens => ({ criadas: 0, atualizadas: 0, ignoradas: 0, registros: 0, comErro: 0 });

function somarEm(total: Contagens, parcela: Contagens) {
  total.criadas += parcela.criadas;
  total.atualizadas += parcela.atualizadas;
  total.ignoradas += parcela.ignoradas;
  total.registros += parcela.registros;
  total.comErro += parcela.comErro;
}

const resultado = ({ criadas, atualizadas, ignoradas }: Contagens) => ({ criadas, atualizadas, ignoradas });

/** Quantos motivos de linha ignorada o painel lista; os demais somam em "Outros motivos". */
const MOTIVOS_NO_PAINEL = 5;
export const OUTROS_MOTIVOS = "Outros motivos";

/**
 * Motivo agrupado: os que trazem o detalhe depois de dois-pontos ("Ordem inválida: data_fim_prog: …") contam pelo início
 * ("Ordem inválida"); os fixos (`MOTIVO_*` de `importacao-ordens.ts`) não têm dois-pontos e ficam como estão.
 */
const grupoDoMotivo = (motivo: unknown) => (typeof motivo === "string" && motivo.trim() ? motivo.split(":")[0]!.trim() : "Sem motivo informado");

/** Os motivos das linhas ignoradas, do mais comum ao menos, com os que passam do limite somados em "Outros motivos". */
export function contarMotivos(detalhes: unknown[]): { motivo: string; total: number }[] {
  const contagem = new Map<string, number>();
  for (const detalhe of detalhes) {
    if (!Array.isArray(detalhe)) continue;
    for (const linha of detalhe) {
      const motivo = grupoDoMotivo((linha as { motivo?: unknown } | null)?.motivo);
      contagem.set(motivo, (contagem.get(motivo) ?? 0) + 1);
    }
  }
  const ordenados = [...contagem.entries()].map(([motivo, total]) => ({ motivo, total })).sort((a, b) => b.total - a.total || a.motivo.localeCompare(b.motivo, "pt-BR"));
  if (ordenados.length <= MOTIVOS_NO_PAINEL) return ordenados;
  const resto = ordenados.slice(MOTIVOS_NO_PAINEL - 1).reduce((t, m) => t + m.total, 0);
  return [...ordenados.slice(0, MOTIVOS_NO_PAINEL - 1), { motivo: OUTROS_MOTIVOS, total: resto }];
}

/**
 * Diagnóstico da entrada de OS: as OS registradas (criadas) por faixa e por origem, as leituras da API por faixa (com e
 * sem falha), o que foi atualizado e ignorado (com os motivos), as leituras e os arquivos do período, mais os totais do
 * período anterior. As contagens vêm do registro de cada leitura ou planilha (`importacao`), pelo dia em que aconteceu.
 */
export async function resumoDasImportacoes(db: Db, periodo: Periodo, agora: Date) {
  const { agrupamento, faixas, anterior, de, ate } = resolverPeriodo(periodo, diaNoFuso(agora));
  const primeira = faixas[0]!;
  const fim = faixas.at(-1)!.fim;
  const noPeriodo = (inicio: string) =>
    sql`${importacao.criadaEm} >= (${inicio}::timestamp at time zone 'America/Sao_Paulo') and ${importacao.criadaEm} < (${fim}::timestamp at time zone 'America/Sao_Paulo')`;

  const dia = sql<string>`to_char(${importacao.criadaEm} at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`;
  const linhas = await db
    .select({
      dia,
      origem: importacao.origem,
      criadas: sql<number>`sum(${importacao.criadas})::int`,
      atualizadas: sql<number>`sum(${importacao.atualizadas})::int`,
      ignoradas: sql<number>`sum(${importacao.ignoradas})::int`,
      registros: sql<number>`count(*)::int`,
      comErro: sql<number>`(count(*) filter (where ${importacao.erro} is not null))::int`,
    })
    .from(importacao)
    .where(noPeriodo(anterior.inicio))
    .groupBy(dia, importacao.origem);

  // Os motivos só do período (sem o anterior), lidos das leituras e planilhas que ignoraram alguma linha.
  const comIgnoradas = await db
    .select({ detalhe: importacao.detalheIgnoradas })
    .from(importacao)
    .where(sql`${noPeriodo(primeira.inicio)} and ${importacao.ignoradas} > 0`);

  // `api`/`planilha`/`digitalizacao`: OS registradas por método; `leituras`/`falhas`: leituras da API e as que terminaram com erro.
  // O método "Importação (arquivo)" leva a chave `planilha` e soma os dois arquivos aceitos: a planilha e o PDF da OS. A
  // Digitalização (OS antigas, já executadas no papel) é o terceiro método e não se mistura com os outros dois.
  const serie = faixas.map((f) => ({ inicio: f.inicio, fim: f.fim, api: 0, planilha: 0, digitalizacao: 0, leituras: 0, falhas: 0 }));
  const porOrigem = { api: zeradas(), planilha: zeradas(), digitalizacao: zeradas() };
  const doAnterior = zeradas();
  for (const { dia: d, origem, ...contagens } of linhas) {
    if (d < primeira.inicio) {
      somarEm(doAnterior, contagens);
      continue;
    }
    const ponto = serie.find((f) => d >= f.inicio && d < f.fim);
    if (!ponto) continue;
    const metodo = origem === "api" ? "api" : origem === "digitalizacao" ? "digitalizacao" : "planilha";
    ponto[metodo] += contagens.criadas;
    if (metodo === "api") {
      ponto.leituras += contagens.registros;
      ponto.falhas += contagens.comErro;
    }
    somarEm(porOrigem[metodo], contagens);
  }
  const total = zeradas();
  somarEm(total, porOrigem.api);
  somarEm(total, porOrigem.planilha);
  somarEm(total, porOrigem.digitalizacao);

  return {
    periodo,
    agrupamento,
    de,
    ate,
    totais: resultado(total),
    anterior: resultado(doAnterior),
    porOrigem: {
      api: { ...resultado(porOrigem.api), leituras: porOrigem.api.registros, leiturasComErro: porOrigem.api.comErro },
      planilha: { ...resultado(porOrigem.planilha), arquivos: porOrigem.planilha.registros, arquivosComErro: porOrigem.planilha.comErro },
      digitalizacao: { ...resultado(porOrigem.digitalizacao), arquivos: porOrigem.digitalizacao.registros, arquivosComErro: porOrigem.digitalizacao.comErro },
    },
    serie,
    motivosIgnoradas: contarMotivos(comIgnoradas.map((l) => l.detalhe)),
  };
}
