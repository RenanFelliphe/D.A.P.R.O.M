import { sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";
import type { Db } from "../db/conexao";

/** Convenção de todas as listas: `?pagina=1&tamanho=50` (máximo 200). */
export const esquemaPaginacao = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  tamanho: z.coerce.number().int().min(1).max(200).default(50),
});
export type Paginacao = z.infer<typeof esquemaPaginacao>;

export const limiteEDeslocamento = (p: Paginacao) => ({ limit: p.tamanho, offset: (p.pagina - 1) * p.tamanho });

export async function contar(db: Db, tabela: PgTable, onde?: SQL): Promise<number> {
  const [linha] = await db.select({ n: sql<number>`count(*)::int` }).from(tabela).where(onde);
  return linha?.n ?? 0;
}

/** Acompanha a lista, ao lado do array nomeado: `{usuarios: [...], pagina, tamanho, total}`. */
export const meta = (p: Paginacao, total: number) => ({ pagina: p.pagina, tamanho: p.tamanho, total });
