"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ImagemArquivo } from "@/components/ui/ImagemArquivo";
import type { PassoExplicacao } from "@/lib/treinamento-servico";
import { reacaoDaExpressao } from "@/lib/vitoria";
import { TextoFalado } from "../vitoria/TextoFalado";
import { VitoriaNaCena } from "../vitoria/VitoriaNaCena";
import { useTecla } from "./efeitos";

interface ExplicacaoDoJogoProps {
  passos: PassoExplicacao[];
  atual: number;
  /** O passo mais adiante que a pessoa já viu: dá para voltar a qualquer um deles pelos pontinhos. */
  vistos: number;
  aoIrPara: (passo: number) => void;
  aoTerminar: () => void;
}

/** Quanto o dedo precisa andar na horizontal para virar o passo (e quanto pode andar na vertical sem virar rolagem). */
const DESLIZE_MIN = 60;
const DESLIZE_MAX_VERTICAL = 50;

/**
 * Parte 1: a Vitória explica o serviço passo a passo. Cada passo é uma fala dela, com a reação escolhida pelo admin
 * (`pensando`, `atencao`, `comemorando` ou `errada`) ou a foto balançando enquanto "fala", e a imagem do passo, quando houver.
 * Vira o passo pelos botões, pelas setas do teclado ou deslizando o dedo para o lado.
 */
export function ExplicacaoDoJogo({ passos, atual, vistos, aoIrPara, aoTerminar }: ExplicacaoDoJogoProps) {
  const passo = passos[atual]!;
  const ultimo = atual === passos.length - 1;
  const inicioDoToque = useRef<{ x: number; y: number } | null>(null);
  const avancar = () => (ultimo ? aoTerminar() : aoIrPara(atual + 1));
  const voltar = () => atual > 0 && aoIrPara(atual - 1);

  useTecla({ ArrowRight: avancar, ArrowLeft: voltar, Enter: avancar });

  return (
    <div className="ts-tela">
      <div
        key={atual}
        className="ts-jogo-corpo ts-explicacao"
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") inicioDoToque.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const inicio = inicioDoToque.current;
          inicioDoToque.current = null;
          if (!inicio) return;
          const dx = e.clientX - inicio.x;
          if (Math.abs(dx) < DESLIZE_MIN || Math.abs(e.clientY - inicio.y) > DESLIZE_MAX_VERTICAL) return;
          if (dx < 0) avancar();
          else voltar();
        }}
      >
        <p className="ts-parte" data-foco tabIndex={-1}>
          <span>Parte 1 · Explicação</span>
          <span className="ts-parte-contagem">
            Passo {atual + 1} de {passos.length}
          </span>
        </p>
        <div className="ts-explicacao-palco">
          <span className="ts-explicacao-numero" aria-hidden="true">
            {atual + 1}
          </span>
          <VitoriaNaCena
            chave={`passo-${atual}`}
            reacao={reacaoDaExpressao(passo.expressao)}
            tamanho={160}
            falando
            tom={passo.expressao === "alerta" ? "destaque" : undefined}
            className="ts-cena-explicacao"
          >
            {passo.expressao === "alerta" && (
              <span className="ts-balao-selo">
                <Icon name="alert" size={13} />
                Atenção
              </span>
            )}
            <TextoFalado texto={passo.texto} className="ts-fala" />
          </VitoriaNaCena>
        </div>
        {passo.imagem_path && (
          <figure className="ts-explicacao-imagem">
            <ImagemArquivo id={passo.imagem_path} alt={`Imagem do passo ${atual + 1}`} />
          </figure>
        )}
        <p className="ts-dica-teclado ts-dica-navegar">
          <span className="ts-so-mouse">
            <kbd>←</kbd> <kbd>→</kbd> para navegar
          </span>
          <span className="ts-so-toque">Deslize para o lado para trocar de passo</span>
        </p>
      </div>
      <div className="ts-jogo-rodape">
        <Button variant="line" onClick={voltar} disabled={atual === 0} aria-label="Passo anterior">
          <Icon name="left" size={16} />
          <span className="ts-so-largo">Voltar</span>
        </Button>
        <span className="ts-pontinhos" role="group" aria-label="Passos da explicação">
          {passos.map((_, i) => (
            <button
              key={i}
              type="button"
              className="ts-pontinho"
              data-estado={i === atual ? "atual" : i <= vistos ? "visto" : undefined}
              disabled={i > vistos}
              aria-label={`Passo ${i + 1}`}
              aria-current={i === atual ? "step" : undefined}
              onClick={() => aoIrPara(i)}
            />
          ))}
        </span>
        <Button variant="p" className="ts-botao-principal" onClick={avancar}>
          {ultimo ? "Ir para o jogo" : "Próximo"}
          <Icon name={ultimo ? "play" : "right"} size={16} fill={ultimo} />
        </Button>
      </div>
    </div>
  );
}
