/**
 * O banco local, sem depender do React Native: quem fala com o SQLite (o `expo-sqlite` no aparelho, o `node:sqlite` nos testes)
 * entra por `Primitivas`, e daqui sai uma interface pequena e em português. Todas as operações saem uma de cada vez (uma conexão só,
 * sem corrida entre a fila, a cópia e as telas); a transação segura essa vez até o fim.
 */

export type Parametro = string | number | null;

/** O que o SQLite de verdade precisa oferecer. */
export interface Primitivas {
  /** Várias instruções de uma vez, sem parâmetros (esquema, `BEGIN`, `COMMIT`). */
  exec(sql: string): Promise<void>;
  run(sql: string, parametros: Parametro[]): Promise<void>;
  all<T>(sql: string, parametros: Parametro[]): Promise<T[]>;
}

export interface Consulta {
  executar(sql: string, parametros?: Parametro[]): Promise<void>;
  todos<T>(sql: string, parametros?: Parametro[]): Promise<T[]>;
  um<T>(sql: string, parametros?: Parametro[]): Promise<T | null>;
}

export interface Banco extends Consulta {
  /**
   * Tudo ou nada. Dentro da tarefa, use **só** o `tx` recebido: chamar o `banco` de fora espera a vez da própria transação e trava.
   * Se a tarefa lançar, nada do que ela gravou fica.
   */
  transacao<T>(tarefa: (tx: Consulta) => Promise<T>): Promise<T>;
}

function consultaSobre(p: Primitivas): Consulta {
  return {
    executar: (sql, parametros = []) => p.run(sql, parametros),
    todos: (sql, parametros = []) => p.all(sql, parametros),
    um: async (sql, parametros = []) => (await p.all<never>(sql, parametros))[0] ?? null,
  };
}

export function criarBanco(primitivas: Primitivas): Banco {
  const direta = consultaSobre(primitivas);
  /** A cauda da fila de operações: cada uma começa quando a anterior termina (com sucesso ou não). */
  let cauda: Promise<unknown> = Promise.resolve();

  function naVez<T>(operacao: () => Promise<T>): Promise<T> {
    const resultado = cauda.then(operacao, operacao);
    cauda = resultado.catch(() => undefined);
    return resultado;
  }

  return {
    executar: (sql, parametros) => naVez(() => direta.executar(sql, parametros)),
    todos: (sql, parametros) => naVez(() => direta.todos(sql, parametros)),
    um: (sql, parametros) => naVez(() => direta.um(sql, parametros)),
    transacao: (tarefa) =>
      naVez(async () => {
        await primitivas.exec("BEGIN IMMEDIATE");
        try {
          const resultado = await tarefa(direta);
          await primitivas.exec("COMMIT");
          return resultado;
        } catch (e) {
          await primitivas.exec("ROLLBACK").catch(() => undefined);
          throw e;
        }
      }),
  };
}
