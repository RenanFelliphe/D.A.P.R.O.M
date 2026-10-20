"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

/** De quanto em quanto tempo a tela relê a execução de outra pessoa que a equipe acompanha, se a página não pedir outro intervalo. */
const ATUALIZAR_A_CADA_MS = 10_000;

/**
 * Não desenha nada: enquanto a aba está visível, pede ao servidor a execução de novo a cada `cadaMs` (10 segundos, por padrão) com
 * `router.refresh()`, e uma vez ao voltar para a aba. É o que mantém o cronômetro, as pausas, os pedidos e o encerramento de quem
 * acompanha em dia, sem aviso por push. A página pede um intervalo menor quando há um pedido aberto (o responsável tem 2 minutos).
 */
export function AtualizarSozinha({ cadaMs = ATUALIZAR_A_CADA_MS }: { cadaMs?: number }) {
  const router = useRouter();
  const [, iniciar] = useTransition();

  useEffect(() => {
    const atualizar = () => {
      if (document.visibilityState === "visible") iniciar(() => router.refresh());
    };
    const temporizador = window.setInterval(atualizar, cadaMs);
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      window.clearInterval(temporizador);
      document.removeEventListener("visibilitychange", atualizar);
    };
  }, [router, cadaMs]);

  return null;
}
