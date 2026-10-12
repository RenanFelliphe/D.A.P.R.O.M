"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Folga entre a coluna e a borda da janela (ou a barra superior). */
const RESPIRO = 24;

/**
 * Coluna dos filtros, fixa enquanto a página rola, sem rolagem própria: a página inteira rola de uma vez. Se a coluna for
 * mais alta que a janela (várias seções abertas), o `top` fica negativo: o topo sai de vista junto com a página e o rodapé
 * para na borda de baixo, e o topo volta ao rolar para cima. Cabendo na janela, ela fica logo abaixo da barra superior.
 */
export function ColunaFiltros({ children }: { children: ReactNode }) {
  const coluna = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = coluna.current;
    if (!el) return;
    const ajustar = () => {
      const barra = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--topbar-h")) || 0;
      const topo = Math.min(barra + RESPIRO, window.innerHeight - el.offsetHeight - RESPIRO);
      el.style.setProperty("--busca-topo", `${topo}px`);
    };
    ajustar();
    // Abrir ou fechar uma seção muda a altura da coluna; redimensionar a janela muda a altura disponível.
    const observador = new ResizeObserver(ajustar);
    observador.observe(el);
    window.addEventListener("resize", ajustar);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", ajustar);
    };
  }, []);

  return (
    <aside ref={coluna} className="busca-filtros" aria-label="Filtros da busca">
      {children}
    </aside>
  );
}
