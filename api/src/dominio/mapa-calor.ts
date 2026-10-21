import { desc, eq, sql, type AnyColumn } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { execucao, os, type OsStatus } from "../db/schema";
import type { UsuarioAutenticado } from "../http/autenticacao";
import { instanteEntre, resolverPeriodo, type Periodo } from "./periodo";
import { condicaoEscopo, diaNoFuso, todas } from "./painel-comum";
import { equipeDoIndicador } from "./painel-indicadores";

export interface FiltrosMapaDeCalor {
  periodo: Periodo;
  equipe_id?: string;
  status?: OsStatus;
}

/** Células por grau: 0,01° (cerca de 1,1 km de latitude; um pouco menos de longitude perto do equador). */
const CELULAS_POR_GRAU = 100;

/**
 * O índice da célula é calculado no banco: as coordenadas são `numeric(9,6)` e o `floor` sobre o decimal é exato. Em
 * ponto flutuante, `-40.95 * 100` dá `-4095.0000000000005` e a OS cairia na célula vizinha.
 */
const indiceDaCelula = (inicio: AnyColumn, fim: AnyColumn) =>
  sql<number | null>`floor(coalesce(${inicio}, ${fim}) * ${sql.raw(String(CELULAS_POR_GRAU))})::int`;

const centroDaCelula = (indice: number, limite: number) => Math.min(limite, Math.max(-limite, (indice + 0.5) / CELULAS_POR_GRAU));

/**
 * Distribuição espacial das OS executadas no período, a partir do GPS do início da execução (ou do fim quando
 * o início não tem posição). Uma OS entra uma vez, pela execução mais recente no período; as coordenadas são
 * agregadas em células de aproximadamente 1 km para não expor posições exatas.
 *
 * Todo perfil acessa; o escopo é o de sempre (`condicaoEscopo`/`equipeDoIndicador`): o técnico só vê a própria equipe,
 * o supervisor a dele e as que supervisiona, e o admin todas. Pedir uma equipe fora do escopo é `403`.
 */
export async function mapaDeCalorOs(db: Db, eu: UsuarioAutenticado, filtros: FiltrosMapaDeCalor, agora: Date) {
  const equipeId = equipeDoIndicador(eu, filtros.equipe_id);
  const faixa = resolverPeriodo(filtros.periodo, diaNoFuso(agora));
  const execucoes = await db
    .selectDistinctOn([os.id], {
      osId: os.id,
      status: os.status,
      celulaLatitude: indiceDaCelula(execucao.inicioLatitude, execucao.fimLatitude),
      celulaLongitude: indiceDaCelula(execucao.inicioLongitude, execucao.fimLongitude),
    })
    .from(os)
    .innerJoin(execucao, eq(execucao.osId, os.id))
    .where(
      todas(
        condicaoEscopo(eu),
        equipeId ? eq(os.equipeId, equipeId) : undefined,
        filtros.status ? eq(os.status, filtros.status) : undefined,
        instanteEntre(execucao.inicio, faixa.inicio, faixa.fim),
      ),
    )
    .orderBy(os.id, desc(execucao.inicio), desc(execucao.id));

  const celulas = new Map<
    string,
    { latitude: number; longitude: number; total: number; por_status: Partial<Record<OsStatus, number>> }
  >();
  let comLocalizacao = 0;

  for (const linha of execucoes) {
    if (linha.celulaLatitude === null || linha.celulaLongitude === null) continue;
    comLocalizacao++;
    const chave = `${linha.celulaLatitude}:${linha.celulaLongitude}`;
    const celula = celulas.get(chave) ?? {
      latitude: centroDaCelula(linha.celulaLatitude, 90),
      longitude: centroDaCelula(linha.celulaLongitude, 180),
      total: 0,
      por_status: {},
    };
    celula.total++;
    celula.por_status[linha.status] = (celula.por_status[linha.status] ?? 0) + 1;
    celulas.set(chave, celula);
  }

  return {
    periodo: filtros.periodo,
    inicio: faixa.inicio,
    fim: faixa.fim,
    // O intervalo que a tela mostra ("de 22/09 a 21/10"): `fim` é exclusivo e pode estar no futuro.
    de: faixa.de,
    ate: faixa.ate,
    os_no_periodo: execucoes.length,
    com_localizacao: comLocalizacao,
    sem_localizacao: execucoes.length - comLocalizacao,
    celulas: [...celulas.values()].sort((a, b) => b.total - a.total || a.latitude - b.latitude || a.longitude - b.longitude),
  };
}
