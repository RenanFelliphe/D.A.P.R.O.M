"use client";

import { useState } from "react";
import { contagemDoPedido, restanteDoPedido } from "@/lib/execucao-pedidos";
import { useAgora } from "./useAgora";

/**
 * Quanto falta para o prazo de 2 minutos de um pedido, em ms. O que vale é o `restanteMs` que a `api` mediu quando respondeu, menos o
 * tempo que passou aqui desde que a tela o recebeu (o relógio do aparelho e o da `api` podem diferir): cada resposta nova da `api`
 * (um `restanteMs` diferente) recomeça a conta. No servidor e na hidratação devolve o valor da `api`.
 */
export function useRestanteDoPedido(restanteMs: number): number {
  const agora = useAgora();
  const [base, setBase] = useState<{ restanteMs: number; recebidoEm: number } | null>(null);
  if (agora !== null && (base === null || base.restanteMs !== restanteMs)) setBase({ restanteMs, recebidoEm: agora });
  if (agora === null || base === null || base.restanteMs !== restanteMs) return restanteMs;
  return restanteDoPedido({ restante_ms: base.restanteMs }, base.recebidoEm, agora);
}

/** A contagem regressiva dos 2 minutos de um pedido, "1:42". */
export function ContagemDoPedido({ restanteMs }: { restanteMs: number }) {
  const restante = useRestanteDoPedido(restanteMs);
  return (
    <span className="mono" role="timer" aria-label="Tempo que falta para responder o pedido">
      {contagemDoPedido(restante)}
    </span>
  );
}
