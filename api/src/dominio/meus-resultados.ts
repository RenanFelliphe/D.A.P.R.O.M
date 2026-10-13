import { eq, sql } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { apr, execucao, localInstalacao, os } from "../db/schema";
import type { UsuarioAutenticado } from "../http/autenticacao";
import { contarAprs, encerradas, interrupcoes } from "./dashboards";
import { diaNoFuso, todas } from "./painel-comum";
import { temposDeExecucao } from "./painel-indicadores";
import { instanteEntre, resolverPeriodo, type Periodo } from "./periodo";

const LOCAIS_NO_RANKING = 6;

/**
 * "Meus resultados": o dashboard da própria pessoa (técnico, inclusive o supervisor). Só conta o que ela fez: as execuções
 * que encerrou, as APRs que preencheu e as execuções que interrompeu, no período do filtro comum e no anterior. Não há
 * `equipe_id` nem `usuario_id`: ninguém consulta o resultado de outra pessoa por aqui.
 */
export async function meusResultados(db: Db, eu: UsuarioAutenticado, f: { periodo: Periodo }, agora: Date) {
  const hoje = diaNoFuso(agora);
  const p = resolverPeriodo(f.periodo, hoje);
  const minhaExecucao = eq(execucao.executorId, eu.id);
  const [fechadas, tempo, aprs, interrompidas, locais] = await Promise.all([
    encerradas(db, minhaExecucao, p),
    temposDeExecucao(db, eu, { inicio: p.inicio, fim: p.fim, usuarioId: eu.id, comExecutor: false }),
    contarAprs(db, eq(apr.preenchidaPor, eu.id), p),
    interrupcoes(db, minhaExecucao, p),
    db
      .select({ id: localInstalacao.id, codigo: localInstalacao.codigo, critico: localInstalacao.critico, encerradas: sql<number>`count(*)::int` })
      .from(execucao)
      .innerJoin(os, eq(os.id, execucao.osId))
      .innerJoin(localInstalacao, eq(localInstalacao.id, os.localInstalacaoId))
      .where(todas(eq(execucao.resultado, "encerrada"), instanteEntre(execucao.fim, p.inicio, p.fim), minhaExecucao))
      .groupBy(localInstalacao.id, localInstalacao.codigo, localInstalacao.critico)
      .orderBy(sql`count(*) desc`, localInstalacao.codigo)
      .limit(LOCAIS_NO_RANKING),
  ]);
  const { serie, ...osEncerradas } = fechadas;
  return {
    periodo: p.periodo,
    agrupamento: p.agrupamento,
    de: p.de,
    ate: p.ate,
    encerradas: osEncerradas,
    serie,
    // Só as próprias execuções: as quebras por equipe e por pessoa não dizem nada aqui.
    tempo: (({ porEquipe: _e, porUsuario: _u, ...resto }) => resto)(tempo),
    aprs,
    interrupcoes: interrompidas,
    locais,
  };
}
