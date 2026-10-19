"use client";

import { useEffect, useState } from "react";
import { movimentoReduzido } from "@/lib/reacao-vitoria";

/** Quanto leva para "falar" cada letra; o texto inteiro nunca passa de `DURACAO_MAXIMA_MS`. */
const MS_POR_LETRA = 14;
const DURACAO_MAXIMA_MS = 1600;

/**
 * O texto da Vitória aparecendo aos poucos, como se ela estivesse falando. O resto do texto já ocupa o lugar (invisível),
 * para o balão não crescer enquanto escreve; um toque mostra tudo na hora. O leitor de tela recebe o texto inteiro de uma vez,
 * e com "reduzir movimento" ligado ele aparece pronto.
 */
export function TextoFalado({ texto, className }: { texto: string; className?: string }) {
  // Guarda de qual texto é a contagem: um texto novo começa do zero sem precisar zerar o estado dentro do efeito.
  const [falado, setFalado] = useState({ texto, letras: 0 });
  const letras = falado.texto === texto ? falado.letras : 0;

  useEffect(() => {
    const total = texto.length;
    const imediato = movimentoReduzido();
    const passo = Math.max(1, Math.ceil(total / (DURACAO_MAXIMA_MS / MS_POR_LETRA)));
    const id = window.setInterval(() => {
      setFalado((atual) => {
        const base = atual.texto === texto ? atual.letras : 0;
        const proximo = imediato ? total : Math.min(total, base + passo);
        if (proximo >= total) window.clearInterval(id);
        return { texto, letras: proximo };
      });
    }, MS_POR_LETRA);
    return () => window.clearInterval(id);
  }, [texto]);

  const completo = letras >= texto.length;
  return (
    <p className={className} onClick={() => setFalado({ texto, letras: texto.length })}>
      <span className="sr">{texto}</span>
      <span aria-hidden="true">
        {texto.slice(0, letras)}
        {!completo && <span className="ts-falando-resto">{texto.slice(letras)}</span>}
      </span>
    </p>
  );
}
