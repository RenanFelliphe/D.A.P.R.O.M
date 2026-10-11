import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { join } from "node:path";
import pg from "pg";

/** Banco usado por toda a `api`: node-postgres em produção e PGlite nos testes têm a mesma interface. */
export type Db = PgDatabase<PgQueryResultHKT>;

export const PASTA_MIGRACOES = join(import.meta.dirname, "..", "..", "db", "migrations");

/** `casing: "snake_case"` é obrigatório: o `drizzle.config.ts` gera as migrações com ele. */
export function conectar(databaseUrl: string) {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  return { pool, db: drizzle(pool, { casing: "snake_case" }) as Db };
}

/** Aplica as migrações pendentes sob trava de sessão do Postgres: duas instâncias subindo juntas não disputam. */
export async function migrarComTrava(pool: pg.Pool): Promise<void> {
  const cliente = await pool.connect();
  try {
    await cliente.query("select pg_advisory_lock(727274)");
    await migrate(drizzle(cliente, { casing: "snake_case" }), { migrationsFolder: PASTA_MIGRACOES });
  } finally {
    await cliente.query("select pg_advisory_unlock(727274)").catch(() => {});
    cliente.release();
  }
}
