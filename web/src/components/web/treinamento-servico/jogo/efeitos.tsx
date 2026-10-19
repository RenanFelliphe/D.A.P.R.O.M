"use client";

import { createContext, useContext, useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { movimentoReduzido } from "@/lib/reacao-vitoria";
import type { SomDoJogo } from "@/lib/sons-do-jogo";

// ---- Som e vibração -------------------------------------------------------------------------------------------------------

interface Retorno {
  tocar: (som: SomDoJogo) => void;
  vibrar: (padrao: number | number[]) => void;
}

const ContextoDoSom = createContext<Retorno>({ tocar: () => {}, vibrar: () => {} });

/** A janela do jogo fornece o som (respeitando o alto-falante ligado ou desligado); as telas só pedem. */
export const ProvedorDoSom = ContextoDoSom;
export const useSom = () => useContext(ContextoDoSom);

// ---- Teclado ---------------------------------------------------------------------------------------------------------------

/**
 * Atalhos de teclado de uma tela do jogo (setas na explicação, 1 a 4 e Enter nas fases). Não roubam a tecla de um campo de
 * texto (o reporte de problema) nem de um botão que não é escolha do jogo (fechar, reportar): só dos marcados com
 * `data-escolha` ou de fora de qualquer botão.
 */
export function useTecla(mapa: Record<string, (() => void) | undefined>, ativo = true) {
  const atual = useRef(mapa);
  useEffect(() => {
    atual.current = mapa;
  });

  useEffect(() => {
    if (!ativo) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (alvo?.closest("button, a") && !alvo.closest("[data-escolha]")) return;
      const acao = atual.current[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (!acao) return;
      e.preventDefault();
      acao();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [ativo]);
}

// ---- Números que contam ----------------------------------------------------------------------------------------------------

/** Um número subindo de 0 até o alvo (a nota do resultado); com "reduzir movimento", já aparece pronto. */
export function useContagem(alvo: number, duracaoMs = 900, atrasoMs = 0) {
  const [valor, setValor] = useState(0);
  useEffect(() => {
    let quadro = 0;
    const imediato = movimentoReduzido();
    const inicio = performance.now() + (imediato ? 0 : atrasoMs);
    const passo = (agora: number) => {
      const t = imediato ? 1 : Math.min(1, Math.max(0, (agora - inicio) / duracaoMs));
      setValor(Math.round(alvo * (1 - Math.pow(1 - t, 3))));
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [alvo, duracaoMs, atrasoMs]);
  return valor;
}

// ---- Explosão de estrelinhas ------------------------------------------------------------------------------------------------

const FAISCAS = 12;

/** O estouro de estrelinhas do acerto, em volta de quem estiver dentro (a Vitória no retorno da fase). */
export function Explosao() {
  return (
    <span className="ts-explosao" aria-hidden="true">
      {Array.from({ length: FAISCAS }, (_, i) => (
        <i key={i} style={{ "--a": `${(360 / FAISCAS) * i}deg`, "--d": `${46 + (i % 3) * 14}px` } as CSSProperties} />
      ))}
    </span>
  );
}

// ---- Contagem regressiva ------------------------------------------------------------------------------------------------------

export const DURACAO_DA_CONTAGEM_MS = 2400;
const MARCAS = ["3", "2", "1", "Valendo!"];

/** "3, 2, 1, Valendo!" por cima da tela, enquanto o servidor embaralha as fases. Com "reduzir movimento", não aparece. */
export function ContagemRegressiva() {
  const { tocar } = useSom();
  useEffect(() => {
    const ids = MARCAS.map((_, i) => window.setTimeout(() => tocar(i === MARCAS.length - 1 ? "valendo" : "contagem"), (DURACAO_DA_CONTAGEM_MS / MARCAS.length) * i));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [tocar]);

  return (
    <div className="ts-contagem-regressiva" role="status" aria-live="assertive">
      {MARCAS.map((m, i) => (
        <span key={m} className={i === MARCAS.length - 1 ? "ts-valendo" : undefined} style={{ "--i": i } as CSSProperties}>
          {m}
        </span>
      ))}
    </div>
  );
}

// ---- Abertura de cada fase ------------------------------------------------------------------------------------------------------

/** "Fase 3 · Decisão" passando pela tela ao entrar na fase (um toque pula). Some sozinha no fim da animação. */
export function AberturaDaFase({ numero, total, rotulo, icone, tipo, frase }: { numero: number; total: number; rotulo: string; icone: IconName; tipo: string; frase: string }) {
  const [visivel, setVisivel] = useState(() => !movimentoReduzido());
  if (!visivel) return null;
  return (
    <div className="ts-abertura-fase" data-jogo={tipo} aria-hidden="true" onClick={() => setVisivel(false)} onAnimationEnd={(e) => e.target === e.currentTarget && setVisivel(false)}>
      <div className="ts-abertura-fase-cartao">
        <span className="ts-abertura-fase-num">{numero === total ? "Última fase!" : `Fase ${numero}`}</span>
        <span className="ts-abertura-fase-tipo">
          <Icon name={icone} size={18} />
          {rotulo}
        </span>
        <span className="ts-abertura-fase-frase">{frase}</span>
      </div>
    </div>
  );
}

// ---- Estrelas do resultado ------------------------------------------------------------------------------------------------------

/** Três estrelas: todas certas, 3; ao menos 60%, 2; alguma certa, 1. */
export const estrelasDaNota = (certas: number, total: number) => (total === 0 ? 0 : certas === total ? 3 : certas / total >= 0.6 ? 2 : certas > 0 ? 1 : 0);

const ATRASO_DA_ESTRELA_MS = 450;
const INICIO_DAS_ESTRELAS_MS = 500;

/** As estrelas acendendo uma a uma, cada uma com o seu som. */
export function Estrelas({ quantas }: { quantas: number }) {
  const { tocar } = useSom();
  useEffect(() => {
    if (movimentoReduzido()) return;
    const ids = Array.from({ length: quantas }, (_, i) => window.setTimeout(() => tocar("estrela"), INICIO_DAS_ESTRELAS_MS + ATRASO_DA_ESTRELA_MS * i));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [quantas, tocar]);

  return (
    <div className="ts-estrelas" role="img" aria-label={`${quantas} de 3 estrelas`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="ts-estrela" data-acesa={i < quantas || undefined} style={{ "--i": i } as CSSProperties}>
          <Icon name="star" size={24} fill />
        </span>
      ))}
    </div>
  );
}
