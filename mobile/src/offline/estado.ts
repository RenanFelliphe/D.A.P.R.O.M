import { useSyncExternalStore } from "react";

/** O que a tela mostra da sincronização: o que espera para subir, quando a cópia foi baixada e se há algo rodando. */
export interface EstadoDaSincronizacao {
  /** Eventos e arquivos esperando para subir. */
  pendentes: number;
  /** Eventos que a `api` recusou de vez (a lista "Registros recusados"). */
  recusados: number;
  /** Quando a cópia da equipe foi baixada (ISO), ou `null` se ainda não há cópia. */
  copiaEm: string | null;
  sincronizando: boolean;
  /** A última sincronização que chegou ao servidor (ISO). */
  sincronizadoEm: string | null;
  /** O que impediu a última sincronização, em português ("Sua sessão terminou…"), ou `null`. */
  erro: string | null;
  /** A última tentativa não chegou ao servidor (sem sinal ou servidor fora do ar). */
  semSinal: boolean;
  /** A pessoa logada tem fila e cópia (técnico de uma equipe, conta pronta): só para ela valem a faixa e o indicador de sincronização. */
  aplicavel: boolean;
  /** Quando a tarefa com o app fechado mexeu na fila pela última vez (ISO), ou `null`. */
  segundoPlanoEm: string | null;
  /** Quantos registros essa passada em segundo plano enviou. */
  segundoPlanoEnviados: number;
}

const inicial: EstadoDaSincronizacao = { pendentes: 0, recusados: 0, copiaEm: null, sincronizando: false, sincronizadoEm: null, erro: null, semSinal: false, aplicavel: false, segundoPlanoEm: null, segundoPlanoEnviados: 0 };

let atual = inicial;
const ouvintes = new Set<() => void>();

export const estadoDaSincronizacao = () => atual;

export function mudarEstado(parcial: Partial<EstadoDaSincronizacao>): void {
  const proximo = { ...atual, ...parcial };
  if ((Object.keys(proximo) as (keyof EstadoDaSincronizacao)[]).every((k) => proximo[k] === atual[k])) return;
  atual = proximo;
  ouvintes.forEach((o) => o());
}

export function assinarEstado(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export const useEstadoDaSincronizacao = (): EstadoDaSincronizacao => useSyncExternalStore(assinarEstado, estadoDaSincronizacao, estadoDaSincronizacao);

/** Só para os testes. */
export const reiniciarEstado = () => mudarEstado({ ...inicial });
