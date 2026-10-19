"use client";

import type { CSSProperties } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { TIPOS_DE_FASE } from "@/lib/treinamento-servico";
import { VitoriaNaCena } from "../vitoria/VitoriaNaCena";
import { useTecla } from "./efeitos";

interface HoraDoJogoProps {
  fases: number;
  temExplicacao: boolean;
  ocupado: boolean;
  erro: string | null;
  aoComecar: () => void;
  aoReverExplicacao: () => void;
}

/**
 * A passagem da explicação para o jogo: deixa claro que a Parte 1 acabou e como as fases valem (acertos, tempo e a
 * resposta confirmada que não muda). A tentativa só é aberta no servidor em "Começar o jogo" (ou Enter), com a contagem "3, 2, 1" por cima.
 */
export function HoraDoJogo({ fases, temExplicacao, ocupado, erro, aoComecar, aoReverExplicacao }: HoraDoJogoProps) {
  useTecla({ Enter: ocupado ? undefined : aoComecar });

  return (
    <div className="ts-tela">
      <div className="ts-jogo-corpo ts-intervalo">
        <span className="ts-intervalo-raios" aria-hidden="true" />
        <p className="ts-parte" data-foco tabIndex={-1}>
          <span>Parte 2 · O jogo</span>
        </p>
        <h2 className="ts-intervalo-titulo">Agora é a sua vez!</h2>
        <VitoriaNaCena chave="intervalo" reacao="atencao" tamanho={130} empilhada>
          <p>
            São {fases === 1 ? "1 fase" : `${fases} fases`}. Cada uma vale até 10 pontos pelos acertos, e <strong>quanto mais rápido, mais vale</strong>: até 10
            segundos, o valor cheio. Dá para voltar e avançar; a resposta confirmada não muda, e eu mostro o que era certo e por quê.
          </p>
        </VitoriaNaCena>
        <ul className="ts-intervalo-tipos" aria-label="Tipos de fase">
          {TIPOS_DE_FASE.map((t, i) => (
            <li key={t.tipo} data-jogo={t.tipo} style={{ "--i": i } as CSSProperties}>
              <Icon name={t.icone} size={16} />
              {t.rotulo}
            </li>
          ))}
        </ul>
      </div>
      <div className="ts-jogo-rodape">
        {erro && (
          <Notice tone="blq" icon="alert" role="alert" className="ts-rodape-aviso">
            {erro}
          </Notice>
        )}
        {temExplicacao && (
          <Button variant="line" onClick={aoReverExplicacao} disabled={ocupado} aria-label="Rever a explicação">
            <Icon name="left" size={16} />
            <span className="ts-so-largo">Rever a explicação</span>
          </Button>
        )}
        <span className="ts-dica-teclado">
          <kbd>Enter</kbd> começa
        </span>
        <span className="ts-rodape-espaco" />
        <Button variant="p" className="ts-botao-principal ts-botao-chamativo" onClick={aoComecar} disabled={ocupado} aria-busy={ocupado}>
          {ocupado ? "Preparando…" : "Começar o jogo"}
          <Icon name="play" size={16} fill />
        </Button>
      </div>
    </div>
  );
}
