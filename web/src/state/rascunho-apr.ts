"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { RascunhoApr } from "@/lib/apr";

/**
 * Rascunho da APR de uma OS, guardado no navegador até a APR ser concluída (a especificação: "na web, no navegador;
 * nada é enviado até concluir"). Um por OS. Se o armazenamento do navegador estiver bloqueado, vale só enquanto a aba
 * ficar aberta.
 */

const chaveDe = (osId: string) => `daprom:apr:${osId}`;

const memoria = new Map<string, string>();
const ouvintes = new Set<() => void>();

function lerBruto(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave) ?? memoria.get(chave) ?? null;
  } catch {
    return memoria.get(chave) ?? null;
  }
}

function gravarBruto(chave: string, valor: string | null) {
  if (valor === null) memoria.delete(chave);
  else memoria.set(chave, valor);
  try {
    if (valor === null) window.localStorage.removeItem(chave);
    else window.localStorage.setItem(chave, valor);
  } catch {
    /* armazenamento bloqueado ou cheio: segue só na memória da aba */
  }
  ouvintes.forEach((avisar) => avisar());
}

function assinar(avisar: () => void) {
  ouvintes.add(avisar);
  window.addEventListener("storage", avisar);
  return () => {
    ouvintes.delete(avisar);
    window.removeEventListener("storage", avisar);
  };
}

function analisar(bruto: string | null, usuarioId: string): RascunhoApr | null {
  if (!bruto) return null;
  try {
    const r = JSON.parse(bruto) as RascunhoApr;
    // Rascunho de outra pessoa que usou este navegador não é meu.
    // Rascunho gravado antes da validação pela `api` não tem `avaliacao`.
    return r?.versao === 1 && r.usuarioId === usuarioId ? { ...r, avaliacao: r.avaliacao ?? null } : null;
  } catch {
    return null;
  }
}

/** Há rascunho desta OS, sem observar mudanças (para decidir um redirecionamento, por exemplo). */
export const lerRascunho = (osId: string, usuarioId: string) => analisar(lerBruto(chaveDe(osId)), usuarioId);

/** Grava (ou substitui) o rascunho de uma OS. */
export const gravarRascunho = (r: RascunhoApr) => gravarBruto(chaveDe(r.osId), JSON.stringify(r));

export const apagarRascunho = (osId: string) => gravarBruto(chaveDe(osId), null);

/**
 * `rascunho`: `undefined` enquanto o navegador ainda não leu (primeira renderização), `null` se não há rascunho desta
 * pessoa para a OS. `atualizar` aplica uma função pura (de `lib/apr`) sobre o que está guardado.
 */
export function useRascunhoApr(osId: string, usuarioId: string) {
  const chave = chaveDe(osId);
  const bruto = useSyncExternalStore(
    assinar,
    () => lerBruto(chave),
    () => undefined,
  );
  const rascunho = useMemo(() => (bruto === undefined ? undefined : analisar(bruto, usuarioId)), [bruto, usuarioId]);

  const atualizar = useCallback(
    (alterar: (atual: RascunhoApr) => RascunhoApr) => {
      const atual = analisar(lerBruto(chave), usuarioId);
      if (atual) gravarRascunho(alterar(atual));
    },
    [chave, usuarioId],
  );

  const descartar = useCallback(() => apagarRascunho(osId), [osId]);

  return { rascunho, atualizar, descartar };
}
