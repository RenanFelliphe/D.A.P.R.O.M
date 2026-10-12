"use client";

import { useEffect, useRef } from "react";

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Comportamento de diálogo modal: leva o foco para dentro ao abrir (no elemento `[data-foco-inicial]`, se houver), prende o Tab,
 * fecha com Esc, trava a rolagem da página e devolve o foco a quem o tinha ao fechar.
 */
export function useDialogo<T extends HTMLElement>(aoFechar: () => void) {
  const raiz = useRef<T>(null);
  const fechar = useRef(aoFechar);

  useEffect(() => {
    fechar.current = aoFechar;
  });

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const alvo = raiz.current?.querySelector<HTMLElement>("[data-foco-inicial]") ?? raiz.current;
    alvo?.focus();

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        fechar.current();
        return;
      }
      if (evento.key !== "Tab" || !raiz.current) return;
      const itens = Array.from(raiz.current.querySelectorAll<HTMLElement>(FOCAVEIS)).filter((el) => el.offsetParent !== null);
      if (itens.length === 0) {
        evento.preventDefault();
        return;
      }
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      const dentro = raiz.current.contains(document.activeElement);
      if (evento.shiftKey && (document.activeElement === primeiro || !dentro)) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && (document.activeElement === ultimo || !dentro)) {
        evento.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = rolagem;
      if (anterior && document.contains(anterior)) anterior.focus();
    };
  }, []);

  return raiz;
}
