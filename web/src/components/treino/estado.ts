"use client";

import { useSyncExternalStore } from "react";
import type { RespostaComPontos } from "@/lib/gamificacao";
import { COOKIE_TREINO_ADIADO, SESSAO_TREINO_MODO, SESSAO_TREINO_PASSO, type ModoDoTreino } from "@/lib/treino-comum";

/**
 * Estado do treino que vive no navegador: a modalidade escolhida e o passo do tutorial ficam no `sessionStorage`
 * (somem ao fechar a aba) e qualquer componente os lê com os hooks abaixo.
 */

const ouvintes = new Set<() => void>();

function ler(chave: string): string | null {
  try {
    return window.sessionStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: string | null) {
  try {
    if (valor === null) window.sessionStorage.removeItem(chave);
    else window.sessionStorage.setItem(chave, valor);
  } catch {
    /* armazenamento bloqueado: o treino segue só enquanto a página estiver aberta */
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

/** Modalidade escolhida nesta aba (`null` = ainda não escolheu). */
export function useModoDoTreino(): ModoDoTreino | null {
  const valor = useSyncExternalStore(assinar, () => ler(SESSAO_TREINO_MODO), () => null);
  return valor === "direcionado" || valor === "livre" ? valor : null;
}

/** Passo atual do tutorial direcionado (base 0). */
export function usePassoDoTreino(): number {
  const valor = useSyncExternalStore(assinar, () => ler(SESSAO_TREINO_PASSO), () => null);
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : 0;
}

export const estadoDoTreino = {
  definirModo: (modo: ModoDoTreino | null) => gravar(SESSAO_TREINO_MODO, modo),
  definirPasso: (passo: number) => gravar(SESSAO_TREINO_PASSO, String(Math.max(0, passo))),
  /** Esquece a modalidade e o passo (sair do treino, ou treino desligado). */
  limpar: () => {
    gravar(SESSAO_TREINO_MODO, null);
    gravar(SESSAO_TREINO_PASSO, null);
  },
};

/** Cookie de sessão que esconde as boas-vindas do sistema real depois de "Fazer depois" (o logout o apaga). */
export function adiarBoasVindas() {
  document.cookie = `${COOKIE_TREINO_ADIADO}=1; path=/; SameSite=Lax`;
}

/** Grava o estado do treinamento na `api` real (`/app/treino/estado`); lança com a mensagem a mostrar. Devolve os pontos que a conclusão deu. */
export async function gravarTreinamento(estado: "nao_iniciado" | "concluido" | "pulado"): Promise<RespostaComPontos> {
  let resposta: Response;
  try {
    resposta = await fetch("/app/treino/estado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
      cache: "no-store",
    });
  } catch {
    throw new Error("Sem conexão. Tente de novo em instantes.");
  }
  if (!resposta.ok) {
    const dados = (await resposta.json().catch(() => ({}))) as { erro?: { mensagem?: string } };
    throw new Error(dados.erro?.mensagem ?? "Não foi possível salvar agora. Tente de novo.");
  }
  return ((await resposta.json().catch(() => ({}))) as RespostaComPontos) ?? {};
}
