"use client";

import { useEffect, useState } from "react";
import { useAlvoDataTreino } from "@/hooks/useAlvoDataTreino";

/** Quanto tempo o retângulo pisca antes de sumir sozinho. */
const DURACAO_MS = 4000;
const FOLGA = 6;

function rolarAteAVista(el: HTMLElement) {
  const caixa = el.getBoundingClientRect();
  const visivel = caixa.top >= 80 && caixa.bottom <= window.innerHeight - 80;
  if (!visivel) el.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

/**
 * A ação "mostrar na tela" da Vitória (`docs/ia-e-vitoria.md`, seção 4.1, nível 2): pisca um retângulo em volta do elemento
 * `data-treino="alvo"` por alguns segundos e some sozinho. Reaproveita a medição de `useAlvoDataTreino` (extraída de
 * `TutorialDirecionado.tsx`), mas é um componente novo e bem mais simples — sem balão, sem roteiro, sem progresso: o
 * tutorial do Campo de treino é um produto diferente.
 */
export function DestaqueVitoria({ alvo, pedido }: { alvo: string | null; pedido: number }) {
  const medida = useAlvoDataTreino(alvo ?? undefined, pedido, rolarAteAVista);
  // Guarda o `pedido` já escondido (em vez de um booleano) para não precisar de um `setState(true)` síncrono no efeito
  // a cada pedido novo: "visível" é só "ainda não escondi este pedido".
  const [escondidoAte, setEscondidoAte] = useState<number | null>(null);

  useEffect(() => {
    if (!alvo) return;
    const temporizador = setTimeout(() => setEscondidoAte(pedido), DURACAO_MS);
    return () => clearTimeout(temporizador);
  }, [alvo, pedido]);

  const visivel = alvo !== null && escondidoAte !== pedido;
  if (!alvo || !visivel || !medida.rect) return null;
  const { rect } = medida;
  return (
    <div className="vt-raiz" aria-hidden="true">
      <div className="vt-destaque" style={{ top: rect.top - FOLGA, left: rect.left - FOLGA, width: rect.width + FOLGA * 2, height: rect.height + FOLGA * 2 }} />
    </div>
  );
}
