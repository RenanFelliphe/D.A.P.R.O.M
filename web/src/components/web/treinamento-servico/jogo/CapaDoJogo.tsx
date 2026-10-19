"use client";

import type { CSSProperties } from "react";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ImagemArquivo } from "@/components/ui/ImagemArquivo";
import { Notice } from "@/components/ui/Notice";
import { cx } from "@/lib/cx";
import { data } from "@/lib/formatar";
import { duracaoEstimada, formatarNota, notaMaxima, pontosMaximos } from "@/lib/treinamento-servico";
import { VitoriaNaCena } from "../vitoria/VitoriaNaCena";
import { useTecla } from "./efeitos";

interface CapaDoJogoProps {
  descricao: string;
  passos: number;
  fases: number;
  cenarioPath?: string | null;
  assinadoPor?: string | null;
  assinadoEm?: string | null;
  jaConcluiu?: boolean;
  pontua: boolean;
  erro: string | null;
  aoComecar: () => void;
  aoIrDiretoParaOJogo: () => void;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * A abertura do treinamento: uma faixa com o cenário (ou as cores do sistema), o nome do serviço, quanto leva, a Vitória
 * acenando, o que vem pela frente e quem assinou. Enter começa.
 */
export function CapaDoJogo({ descricao, passos, fases, cenarioPath, assinadoPor, assinadoEm, jaConcluiu, pontua, erro, aoComecar, aoIrDiretoParaOJogo }: CapaDoJogoProps) {
  useTecla({ Enter: jaConcluiu ? aoIrDiretoParaOJogo : aoComecar });

  const fala = jaConcluiu
    ? `Que bom te ver de novo! Você já concluiu este treinamento. Quer rever a explicação ou ir direto para as ${plural(fases, "fase", "fases")}?`
    : `Oi! Eu sou a Vitória. Primeiro eu te explico o serviço em ${plural(passos, "passo", "passos")}; depois você joga ${plural(fases, "fase", "fases")}. Acertar rápido vale mais!`;

  const etapas: { icone: IconName; titulo: string; texto: string }[] = [
    { icone: "chat", titulo: "A explicação", texto: `${plural(passos, "passo", "passos")} com a Vitória, no seu ritmo.` },
    { icone: "play", titulo: "O jogo", texto: `${plural(fases, "fase", "fases")} de minijogos; dá para voltar e avançar entre elas.` },
    {
      icone: "trophy",
      titulo: "A nota",
      texto: pontua
        ? `Até ${formatarNota(notaMaxima(fases))}: cada fase vale até 10 pelos acertos, mais rápido vale mais. Na gamificação, até ${pontosMaximos(fases)} pontos na primeira vez.`
        : "A nota, como no jogo de verdade; no teste, nada pontua.",
    },
  ];

  return (
    <div className="ts-tela">
      <div className="ts-jogo-corpo ts-capa">
        <div className={cx("ts-capa-faixa", cenarioPath && "ts-capa-faixa-foto")}>
          {cenarioPath && <ImagemArquivo id={cenarioPath} alt="" className="ts-capa-faixa-imagem" />}
          <span className="ts-capa-faixa-brilho" aria-hidden="true" />
          <div className="ts-capa-faixa-conteudo">
            <span className="ts-capa-etiqueta">{jaConcluiu ? "Você já concluiu" : "Treinamento de serviço"}</span>
            <h2 className="ts-capa-titulo" data-foco tabIndex={-1}>
              {descricao}
            </h2>
            <div className="ts-chips">
              <span className="ts-chip ts-chip-claro">
                <Icon name="clock" size={13} />~{duracaoEstimada(passos, fases)} min
              </span>
              <span className="ts-chip ts-chip-claro">
                <Icon name="chat" size={13} />
                {plural(passos, "passo", "passos")}
              </span>
              <span className="ts-chip ts-chip-claro">
                <Icon name="play" size={13} />
                {plural(fases, "fase", "fases")}
              </span>
              {jaConcluiu && (
                <span className="ts-chip ts-chip-ok">
                  <Icon name="check" size={13} />
                  Concluído
                </span>
              )}
            </div>
          </div>
        </div>
        <VitoriaNaCena chave="capa" reacao="ola" tamanho={120}>
          <p>{fala}</p>
        </VitoriaNaCena>
        <ol className="ts-capa-etapas">
          {etapas.map((e, i) => (
            <li key={e.titulo} style={{ "--i": i } as CSSProperties}>
              <span className="ts-capa-etapa-icone">
                <Icon name={e.icone} size={18} />
                <b>{i + 1}</b>
              </span>
              <span className="stack g4">
                <strong>{e.titulo}</strong>
                <span className="small">{e.texto}</span>
              </span>
            </li>
          ))}
        </ol>
        {assinadoPor && (
          <p className="ts-assinatura">
            <Icon name="shield" size={13} />
            Revisado e assinado por {assinadoPor}
            {assinadoEm ? ` em ${data(assinadoEm)}` : ""}.
          </p>
        )}
      </div>
      <div className="ts-jogo-rodape">
        {erro && (
          <Notice tone="blq" icon="alert" role="alert" className="ts-rodape-aviso">
            {erro}
          </Notice>
        )}
        {jaConcluiu && (
          <Button variant="line" onClick={aoComecar}>
            <span className="ts-so-largo">Rever a explicação</span>
            <span className="ts-so-estreito">Rever</span>
          </Button>
        )}
        <span className="ts-dica-teclado">
          <kbd>Enter</kbd> começa
        </span>
        <span className="ts-rodape-espaco" />
        <Button variant="p" className="ts-botao-principal ts-botao-chamativo" onClick={jaConcluiu ? aoIrDiretoParaOJogo : aoComecar}>
          {jaConcluiu ? "Ir para o jogo" : "Começar"}
          <Icon name={jaConcluiu ? "play" : "right"} size={16} fill={jaConcluiu} />
        </Button>
      </div>
    </div>
  );
}
