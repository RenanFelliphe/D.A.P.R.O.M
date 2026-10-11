import { and, desc, eq, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { alerta, os } from "../db/schema";
import type { UsuarioAutenticado } from "../http/autenticacao";
import { naoEncontrado } from "../http/erros";
import { limiteEDeslocamento, type Paginacao } from "../http/paginacao";

/** Seguranca e admin enxergam os alertas de todos os destinatários; supervisor e analista, só os seus. */
const veTodosOsAlertas = (u: UsuarioAutenticado) => u.perfil === "admin" || u.perfil === "seguranca";

const colunas = {
  id: alerta.id,
  tipo: alerta.tipo,
  osId: alerta.osId,
  numeroOrdem: os.numeroOrdem,
  titulo: os.titulo,
  equipeId: os.equipeId,
  detalhe: alerta.detalhe,
  emailEnviadoEm: alerta.emailEnviadoEm,
  lidoEm: alerta.lidoEm,
  criadoEm: alerta.criadoEm,
};

/** Alertas visíveis ao usuário, do mais recente ao mais antigo; `equipeId` é a equipe atual da OS. */
export async function listarAlertas(db: Db, eu: UsuarioAutenticado, filtros: Paginacao & { lido?: boolean; equipe_id?: string }) {
  const onde = and(
    veTodosOsAlertas(eu) ? undefined : eq(alerta.destinatarioId, eu.id),
    filtros.lido === undefined ? undefined : filtros.lido ? isNotNull(alerta.lidoEm) : isNull(alerta.lidoEm),
    filtros.equipe_id ? eq(os.equipeId, filtros.equipe_id) : undefined,
  ) as SQL | undefined;

  const { limit, offset } = limiteEDeslocamento(filtros);
  const linhas = await db
    .select(colunas)
    .from(alerta)
    .innerJoin(os, eq(os.id, alerta.osId))
    .where(onde)
    .orderBy(desc(alerta.criadoEm), desc(alerta.id))
    .limit(limit)
    .offset(offset);
  const [contagem] = await db.select({ n: sql<number>`count(*)::int` }).from(alerta).innerJoin(os, eq(os.id, alerta.osId)).where(onde);
  return { linhas, total: contagem?.n ?? 0 };
}

/** Marca como lido; só o destinatário (ou o admin). Marcar de novo não muda o instante. */
export async function marcarComoLido(db: Db, eu: UsuarioAutenticado, alertaId: string, agora: Date) {
  const [a] = await db.select({ destinatarioId: alerta.destinatarioId, lidoEm: alerta.lidoEm }).from(alerta).where(eq(alerta.id, alertaId));
  if (!a || (eu.perfil !== "admin" && a.destinatarioId !== eu.id)) throw naoEncontrado("Alerta não encontrado");
  if (a.lidoEm === null) await db.update(alerta).set({ lidoEm: agora }).where(and(eq(alerta.id, alertaId), isNull(alerta.lidoEm)));
}
