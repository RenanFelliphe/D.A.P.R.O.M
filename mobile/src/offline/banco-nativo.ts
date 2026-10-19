import * as SQLite from "expo-sqlite";
import { criarBanco, type Banco, type Primitivas } from "./banco";
import { migrar } from "./esquema";

/**
 * O banco do aparelho: o `expo-sqlite` por baixo da interface de `banco.ts`. O arquivo é `synqos.db`, na pasta de dados do app (o
 * sistema não o apaga como o cache). Abre uma vez, aplica as migrações que faltam e só então libera as operações.
 */
const NOME_DO_ARQUIVO = "synqos.db";

function primitivasDo(db: SQLite.SQLiteDatabase): Primitivas {
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, parametros) => void (await db.runAsync(sql, parametros)),
    all: <T,>(sql: string, parametros: (string | number | null)[]) => db.getAllAsync<T>(sql, parametros),
  };
}

const pronto: Promise<Banco> = (async () => {
  const db = await SQLite.openDatabaseAsync(NOME_DO_ARQUIVO);
  // O WAL deixa a leitura das telas andar enquanto a fila grava.
  await db.execAsync("PRAGMA journal_mode = WAL");
  const banco = criarBanco(primitivasDo(db));
  await migrar(banco);
  return banco;
})();

// Se o banco não abrir, quem o usar recebe o erro; aqui só se evita o aviso de promessa sem tratamento.
pronto.catch(() => undefined);

/** O banco do app: cada operação espera o banco abrir e migrar. */
export const bancoDoAparelho: Banco = {
  executar: async (sql, parametros) => (await pronto).executar(sql, parametros),
  todos: async (sql, parametros) => (await pronto).todos(sql, parametros),
  um: async (sql, parametros) => (await pronto).um(sql, parametros),
  transacao: async (tarefa) => (await pronto).transacao(tarefa),
};
