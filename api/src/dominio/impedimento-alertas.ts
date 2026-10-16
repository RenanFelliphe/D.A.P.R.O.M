import { and, desc, eq, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "../db/conexao";
import { alerta, ausencia, importacao, os, usuario, type AlertaTipo } from "../db/schema";
import type { UsuarioAutenticado } from "../http/autenticacao";
import { naoEncontrado } from "../http/erros";
import { limiteEDeslocamento, type Paginacao } from "../http/paginacao";

/** O admin enxerga os alertas de todos os destinatários; o supervisor, só os seus. */
const veTodosOsAlertas = (u: UsuarioAutenticado) => u.perfil === "admin";

/** A pessoa da ausência, nos alertas `ausencia_*`. */
const alvoDaAusencia = alias(usuario, "alvo_da_ausencia");

/**
 * A OS (alertas de OS), a importação (falha de importação): o que não se aplica vem nulo. O destinatário diz de quem é
 * o `lido_em`: o admin vê os alertas de todos, mas abrir o de outra pessoa não o marca como lido por ela.
 */
const colunas = {
  id: alerta.id,
  tipo: alerta.tipo,
  destinatarioId: alerta.destinatarioId,
  destinatarioNome: usuario.nome,
  osId: alerta.osId,
  numeroOrdem: os.numeroOrdem,
  titulo: os.titulo,
  equipeId: os.equipeId,
  importacaoId: alerta.importacaoId,
  importacaoOrigem: importacao.origem,
  planoPreventivaId: alerta.planoPreventivaId,
  /** Só nos alertas da ausência de um usuário (`ausencia_*`): a ausência e a pessoa dela. */
  ausenciaId: alerta.ausenciaId,
  usuarioAlvoId: alerta.usuarioAlvoId,
  usuarioAlvoNome: alvoDaAusencia.nome,
  /** A equipe da ausência (é nela que o supervisor responde). */
  ausenciaEquipeId: ausencia.equipeId,
  detalhe: alerta.detalhe,
  emailEnviadoEm: alerta.emailEnviadoEm,
  lidoEm: alerta.lidoEm,
  criadoEm: alerta.criadoEm,
};

/**
 * Alertas visíveis ao usuário, do mais recente ao mais antigo; `equipeId` é a equipe atual da OS. O filtro de equipe só
 * alcança os alertas de OS (a falha de importação não tem equipe).
 */
export async function listarAlertas(db: Db, eu: UsuarioAutenticado, filtros: Paginacao & { lido?: boolean; equipe_id?: string; tipo?: AlertaTipo }) {
  const onde = and(
    veTodosOsAlertas(eu) ? undefined : eq(alerta.destinatarioId, eu.id),
    filtros.lido === undefined ? undefined : filtros.lido ? isNotNull(alerta.lidoEm) : isNull(alerta.lidoEm),
    filtros.equipe_id ? eq(os.equipeId, filtros.equipe_id) : undefined,
    filtros.tipo ? eq(alerta.tipo, filtros.tipo) : undefined,
  ) as SQL | undefined;

  const { limit, offset } = limiteEDeslocamento(filtros);
  const linhas = await db
    .select(colunas)
    .from(alerta)
    .leftJoin(os, eq(os.id, alerta.osId))
    .leftJoin(importacao, eq(importacao.id, alerta.importacaoId))
    .leftJoin(usuario, eq(usuario.id, alerta.destinatarioId))
    .leftJoin(alvoDaAusencia, eq(alvoDaAusencia.id, alerta.usuarioAlvoId))
    .leftJoin(ausencia, eq(ausencia.id, alerta.ausenciaId))
    .where(onde)
    .orderBy(desc(alerta.criadoEm), desc(alerta.id))
    .limit(limit)
    .offset(offset);
  const [contagem] = await db.select({ n: sql<number>`count(*)::int` }).from(alerta).leftJoin(os, eq(os.id, alerta.osId)).where(onde);
  return { linhas, total: contagem?.n ?? 0 };
}

/** Marca como lido; só o destinatário (ou o admin). Marcar de novo não muda o instante. */
export async function marcarComoLido(db: Db, eu: UsuarioAutenticado, alertaId: string, agora: Date) {
  const [a] = await db.select({ destinatarioId: alerta.destinatarioId, lidoEm: alerta.lidoEm }).from(alerta).where(eq(alerta.id, alertaId));
  if (!a || (eu.perfil !== "admin" && a.destinatarioId !== eu.id)) throw naoEncontrado("Alerta não encontrado");
  if (a.lidoEm === null) await db.update(alerta).set({ lidoEm: agora }).where(and(eq(alerta.id, alertaId), isNull(alerta.lidoEm)));
}
