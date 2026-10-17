"use client";

import { useEffect, useState } from "react";

/**
 * Medição de um elemento `data-treino="chave"` na tela: acha o alvo, mede a posição dele e acompanha mudanças
 * (rolagem, redimensionamento, conteúdo que aparece ou some) via `MutationObserver`. Extraído de
 * `components/treino/TutorialDirecionado.tsx` (o balão de roteiro/progresso do tutorial) para ser reaproveitado pelo
 * destaque mais simples da Vitória (`components/vitoria/DestaqueVitoria.tsx`), sem duplicar a lógica de medição nem
 * herdar o resto do tutorial, que é um produto diferente.
 */

export interface RetanguloAlvo {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface MedidaDoAlvo {
  /** Posição do alvo na janela; `null` = o alvo não está na tela. */
  rect: RetanguloAlvo | null;
  vw: number;
  vh: number;
}

/** Primeiro elemento visível com a chave `data-treino` informada. */
export function acharAlvoDataTreino(chave: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-treino="${chave}"]`)) {
    const caixa = el.getBoundingClientRect();
    if (caixa.width > 0 && caixa.height > 0) return el;
  }
  return null;
}

function mesmoRetangulo(a: RetanguloAlvo | null, b: RetanguloAlvo | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
}

/**
 * Mede o alvo de `chave` e o mantém atualizado enquanto a tela muda. `reiniciarEm` reinicia a medição (um novo passo do
 * tutorial, um novo pedido de destaque da Vitória); `aoAcharPrimeiraVez` roda uma única vez por reinício, quando o
 * alvo aparece (o tutorial usa para rolar a tela até ele).
 */
export function useAlvoDataTreino(chave: string | undefined, reiniciarEm: string | number, aoAcharPrimeiraVez?: (el: HTMLElement) => void): MedidaDoAlvo {
  const [medida, setMedida] = useState<MedidaDoAlvo>({ rect: null, vw: 0, vh: 0 });

  useEffect(() => {
    let quadro = 0;
    let achouAntes = false;
    const medir = () => {
      quadro = 0;
      const el = chave ? acharAlvoDataTreino(chave) : null;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let rect: RetanguloAlvo | null = null;
      if (el) {
        if (!achouAntes) {
          achouAntes = true;
          aoAcharPrimeiraVez?.(el);
        }
        const caixa = el.getBoundingClientRect();
        rect = { top: caixa.top, left: caixa.left, width: caixa.width, height: caixa.height };
      }
      setMedida((atual) => (atual.vw === vw && atual.vh === vh && mesmoRetangulo(atual.rect, rect) ? atual : { rect, vw, vh }));
    };
    const agendar = () => {
      if (!quadro) quadro = requestAnimationFrame(medir);
    };
    const observador = new MutationObserver((registros) => {
      // Mudanças do próprio tutorial ou do próprio destaque não precisam de nova medida.
      if (registros.every((r) => (r.target as Element).closest?.(".tr-raiz, .vt-raiz"))) return;
      agendar();
    });
    observador.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-treino", "hidden", "class", "disabled"] });
    window.addEventListener("resize", agendar);
    window.addEventListener("scroll", agendar, true);
    agendar();
    return () => {
      cancelAnimationFrame(quadro);
      observador.disconnect();
      window.removeEventListener("resize", agendar);
      window.removeEventListener("scroll", agendar, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `reiniciarEm` é a chave de reinício de propósito; `aoAcharPrimeiraVez` não deve reabrir o efeito sozinho.
  }, [chave, reiniciarEm]);

  return medida;
}
