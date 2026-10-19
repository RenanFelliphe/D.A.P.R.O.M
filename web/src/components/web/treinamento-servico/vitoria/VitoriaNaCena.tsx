"use client";

import type { CSSProperties, ReactNode } from "react";
import { Avatar } from "@/components/vitoria/Avatar";
import { Figurinha } from "@/components/vitoria/Figurinha";
import { cx } from "@/lib/cx";
import type { Reacao } from "@/lib/vitoria";

interface VitoriaNaCenaProps {
  /** A figurinha que toca ao entrar na cena; sem reação, fica a foto de perfil, flutuando de leve. */
  reacao?: Reacao | null;
  /** Muda a cada fala: recomeça a figurinha e a entrada do balão. */
  chave: string;
  /** Tamanho da Vitória em px (a coluna dela não muda de largura entre uma fala e outra, para o texto não pular). */
  tamanho?: number;
  /** `ok` (verde) e `erro` (vermelho) no retorno das fases; `destaque` para o que pede atenção. */
  tom?: "ok" | "erro" | "destaque";
  /** Empilha a Vitória acima do balão (cenas estreitas, como a abertura no celular). */
  empilhada?: boolean;
  /** A foto balança de leve ao entrar, como se ela estivesse falando (os passos da explicação). */
  falando?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * A Vitória falando dentro do treinamento: a foto ou a figurinha (`vitoria.md`, seção 2.8) e um balão com a fala. É a mesma
 * personagem do assistente: nos passos ela mostra a reação escolhida pelo admin, no retorno das fases `certo` ou `errada`.
 */
export function VitoriaNaCena({ reacao, chave, tamanho = 112, tom, empilhada, falando, className, children }: VitoriaNaCenaProps) {
  return (
    <div className={cx("ts-cena", empilhada && "ts-cena-empilhada", className)} style={{ "--ts-vitoria": `${tamanho}px` } as CSSProperties}>
      <div className="ts-cena-vitoria">
        {reacao ? (
          <Figurinha key={`${chave}-${reacao}`} reacao={reacao} tocar tamanho={tamanho} />
        ) : (
          <span key={chave} className={cx("ts-vitoria-foto", falando && "ts-vitoria-falando")}>
            <Avatar tamanho={tamanho} />
          </span>
        )}
      </div>
      <div key={chave} className={cx("ts-balao", tom && `ts-balao-${tom}`)}>
        {children}
      </div>
    </div>
  );
}
