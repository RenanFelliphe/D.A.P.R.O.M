"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

/** O painel acompanha o campo quase na hora, sem pesar na `api`. */
const A_CADA_MS = 30_000;

/**
 * Mantém a tela em dia com o campo (OS encerrada, APR bloqueada, alerta novo no sino): a cada ~30 s, e ao voltar para a
 * aba, relê os dados no servidor com `router.refresh()` numa transição. A tela atual segue visível até a resposta chegar
 * e o que está sendo digitado não se perde. Pausa com a aba escondida. Não desenha nada.
 * `aCadaMs` encurta o intervalo onde a pessoa espera os colegas (as assinaturas da APR).
 */
export function AtualizacaoAutomatica({ aCadaMs = A_CADA_MS }: { aCadaMs?: number }) {
  const router = useRouter();
  const [, iniciar] = useTransition();

  useEffect(() => {
    const atualizar = () => {
      if (document.visibilityState === "visible") iniciar(() => router.refresh());
    };
    const temporizador = window.setInterval(atualizar, aCadaMs);
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      window.clearInterval(temporizador);
      document.removeEventListener("visibilitychange", atualizar);
    };
  }, [router, aCadaMs]);

  return null;
}
