"use client";

import { useSyncExternalStore } from "react";

let ultimo = 0;

function assinar(avisar: () => void) {
  ultimo = Date.now();
  avisar();
  const intervalo = setInterval(() => {
    ultimo = Date.now();
    avisar();
  }, 1000);
  return () => clearInterval(intervalo);
}

const lerAgora = () => ultimo || (ultimo = Date.now());
const noServidor = () => null;

/** Relógio do aparelho atualizado a cada segundo; `null` no servidor e na hidratação (evita divergência com o HTML do servidor). */
export function useAgora(): number | null {
  return useSyncExternalStore<number | null>(assinar, lerAgora, noServidor);
}
