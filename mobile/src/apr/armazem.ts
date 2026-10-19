import type { RascunhoApr } from "@shared/api/apr";

/**
 * Onde o rascunho da APR fica guardado: um arquivo por pessoa e por OS, no armazenamento do app, até a APR ser concluída (na
 * bloqueada, até a evidência ser enviada). Se o app fechar no meio do checklist, a pessoa continua de onde parou. Esta parte não
 * conhece o React Native: o disco entra por parâmetro (o app usa o `expo-file-system`; os testes, uma memória).
 */
export interface Disco {
  ler(chave: string): Promise<string | null>;
  gravar(chave: string, texto: string): Promise<void>;
  apagar(chave: string): Promise<void>;
}

/** Um rascunho por pessoa e por OS: quem usa o aparelho depois não vê o rascunho de quem usou antes. */
export const chaveDoRascunho = (usuarioId: string, osId: string) => `apr-${usuarioId}-${osId}`;

/** Lê o que está guardado; texto estragado, de outra versão ou de outra pessoa não vale (`null`). */
export function analisarRascunho(bruto: string | null, usuarioId: string): RascunhoApr | null {
  if (!bruto) return null;
  try {
    const r = JSON.parse(bruto) as RascunhoApr;
    return r?.versao === 1 && r.usuarioId === usuarioId ? { ...r, avaliacao: r.avaliacao ?? null } : null;
  } catch {
    return null;
  }
}

export function criarArmazemDeRascunhos(disco: Disco) {
  /** O que já foi lido ou gravado; `undefined` (sem entrada) = ainda não leu do disco. */
  const memoria = new Map<string, RascunhoApr | null>();
  const ouvintes = new Set<() => void>();
  const lendo = new Map<string, Promise<RascunhoApr | null>>();
  /** As gravações de uma mesma chave saem em ordem: a última vence. */
  const gravacoes = new Map<string, Promise<void>>();

  const avisar = () => ouvintes.forEach((o) => o());

  function agendar(chave: string, tarefa: () => Promise<void>) {
    const anterior = gravacoes.get(chave) ?? Promise.resolve();
    // Falha de disco (cheio, sem permissão) não derruba a tela: o rascunho segue na memória enquanto o app estiver aberto.
    const proxima = anterior.then(tarefa).catch(() => undefined);
    gravacoes.set(chave, proxima);
  }

  function gravar(rascunho: RascunhoApr) {
    const chave = chaveDoRascunho(rascunho.usuarioId, rascunho.osId);
    memoria.set(chave, rascunho);
    avisar();
    agendar(chave, () => disco.gravar(chave, JSON.stringify(rascunho)));
  }

  return {
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },

    /** O rascunho desta OS: `undefined` enquanto não leu do disco, `null` se não há. */
    ler(osId: string, usuarioId: string): RascunhoApr | null | undefined {
      return memoria.get(chaveDoRascunho(usuarioId, osId));
    },

    /** Lê do disco (uma vez) e avisa quem estiver olhando. */
    carregar(osId: string, usuarioId: string): Promise<RascunhoApr | null> {
      const chave = chaveDoRascunho(usuarioId, osId);
      if (memoria.has(chave)) return Promise.resolve(memoria.get(chave) ?? null);
      let leitura = lendo.get(chave);
      if (!leitura) {
        leitura = disco
          .ler(chave)
          .catch(() => null)
          .then((bruto) => {
            lendo.delete(chave);
            // Se alguém gravou enquanto lia, vale o que foi gravado.
            if (!memoria.has(chave)) {
              memoria.set(chave, analisarRascunho(bruto, usuarioId));
              avisar();
            }
            return memoria.get(chave) ?? null;
          });
        lendo.set(chave, leitura);
      }
      return leitura;
    },

    gravar,

    apagar(osId: string, usuarioId: string) {
      const chave = chaveDoRascunho(usuarioId, osId);
      memoria.set(chave, null);
      avisar();
      agendar(chave, () => disco.apagar(chave));
    },

    /** Aplica uma função pura (de `shared/api/apr`) sobre o rascunho que está guardado; sem rascunho, não faz nada. */
    atualizar(osId: string, usuarioId: string, alterar: (atual: RascunhoApr) => RascunhoApr) {
      const atual = memoria.get(chaveDoRascunho(usuarioId, osId));
      if (atual) gravar(alterar(atual));
    },

    /** Para os testes: espera o disco terminar o que está na fila. */
    async esperarGravacoes() {
      await Promise.all([...gravacoes.values()]);
    },
  };
}

export type ArmazemDeRascunhos = ReturnType<typeof criarArmazemDeRascunhos>;
