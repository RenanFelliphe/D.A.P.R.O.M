import { sql, type SQL } from "drizzle-orm";
import { timestamp, type AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * Convenções do banco inteiro: nomes em português, tempos em timestamptz (UTC),
 * RLS ligado e sem políticas (só a api acessa; nenhum cliente recebe a chave do Supabase).
 * Os nomes das colunas em snake_case vêm de `casing: "snake_case"` (drizzle.config.ts e conexão).
 */

/** Instante no tempo (timestamptz). */
export const instante = () => timestamp({ withTimezone: true, mode: "date" });

/** `coluna in ('a', 'b')` para os `check` que limitam um texto a uma lista de valores. */
export function emLista(coluna: AnyPgColumn, valores: readonly string[]): SQL {
  const literais = valores.map((valor) => sql.raw(`'${valor.replaceAll("'", "''")}'`));
  return sql`${coluna} in (${sql.join(literais, sql.raw(", "))})`;
}
