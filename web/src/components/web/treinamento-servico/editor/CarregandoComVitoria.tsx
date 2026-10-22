"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import type { ProgressoDaIA } from "@/lib/treinamento-servico";
import { VitoriaEmLoop } from "../vitoria/VitoriaEmLoop";

/** O que a Vitória "conta" enquanto a IA ainda não mandou o plano: o modelo pode pensar alguns minutos antes do primeiro item. */
const PENSAMENTOS = ["Lendo o procedimento", "Separando o que o serviço usa", "Achando os passos, na ordem", "Procurando os cuidados de segurança", "Pensando nas fases do jogo"];
const TROCA_MS = 6000;
/** Depois disso, avisa que a demora é normal: a pessoa sabe que não travou (seção 9.3 do `docs/gamificacao-e-treinamentos.md`: até ~4 min pensando). */
const DEMORANDO_S = 45;

function tempo(segundos: number) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return m > 0 ? `${m} min ${String(s).padStart(2, "0")} s` : `${s} s`;
}

type EstadoDaEtapa = "feita" | "agora" | "depois";

/**
 * A espera da geração pela IA: a Vitória pensando sem parar, uma frase que muda, a barra (quando a IA já disse quantos itens
 * vêm), as etapas e o tempo corrido. `compacto` é a versão do chat de ajustes, dentro da conversa.
 */
export function CarregandoComVitoria({ progresso, compacto, titulo = "A Vitória está montando o treinamento" }: { progresso: ProgressoDaIA | null; compacto?: boolean; titulo?: string }) {
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const totalPassos = progresso?.total_passos ?? null;
  const totalFases = progresso?.total_fases ?? null;
  const passos = progresso?.passos_prontos ?? 0;
  const fases = progresso?.fases_prontas ?? 0;
  const temPlano = totalPassos !== null && totalFases !== null;
  const total = temPlano ? totalPassos + totalFases : 0;
  const feitos = passos + fases;
  const tudoPronto = temPlano && feitos >= total;
  const fracao = temPlano && total > 0 ? 0.08 + 0.87 * Math.min(1, feitos / total) : null;

  const frase = tudoPronto ? "Conferindo os trechos e os números" : temPlano ? (progresso?.mensagem ?? "Montando o rascunho").replace(/[.…]+$/, "") : PENSAMENTOS[Math.floor((segundos * 1000) / TROCA_MS) % PENSAMENTOS.length]!;

  const etapas: { rotulo: string; detalhe?: string; estado: EstadoDaEtapa }[] = [
    { rotulo: "Ler o procedimento", estado: temPlano || feitos > 0 ? "feita" : "agora" },
    {
      rotulo: "Escrever a explicação",
      detalhe: temPlano ? `${Math.min(passos, totalPassos)} de ${totalPassos} passos` : undefined,
      estado: !temPlano ? "depois" : passos >= totalPassos ? "feita" : "agora",
    },
    {
      rotulo: "Montar as fases do jogo",
      detalhe: temPlano ? `${Math.min(fases, totalFases)} de ${totalFases} fases` : undefined,
      estado: !temPlano || passos < totalPassos ? "depois" : fases >= totalFases ? "feita" : "agora",
    },
    { rotulo: "Conferir trechos e números", estado: tudoPronto ? "agora" : "depois" },
  ];

  return (
    <div className={cx("ts-carregando", compacto && "ts-carregando-compacto")} role="status" aria-live="polite">
      <div className="ts-carregando-vitoria" aria-hidden="true">
        <span className="ts-halo" />
        <span className="ts-halo ts-halo-2" />
        <VitoriaEmLoop reacao="pensando" tamanho={compacto ? 64 : 168} />
        <span className="ts-faiscas">
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className="ts-carregando-texto">
        {!compacto && <h2>{titulo}</h2>}
        <p key={frase} className="ts-carregando-frase">
          {frase}
          <span className="vt-reticencias" aria-hidden="true">
            <i>.</i>
            <i>.</i>
            <i>.</i>
          </span>
        </p>
        <div className={cx("ts-carregando-barra", fracao === null && "ts-barra-indeterminada")} aria-hidden="true">
          <i style={fracao === null ? undefined : { width: `${Math.round(fracao * 100)}%` }} />
        </div>
        {!compacto && (
          <ol className="ts-etapas-ia">
            {etapas.map((e) => (
              <li key={e.rotulo} data-estado={e.estado}>
                <span className="ts-etapa-ia-marca">{e.estado === "feita" ? <Icon name="check" size={13} /> : e.estado === "agora" ? <span className="ts-ponto-vivo" /> : null}</span>
                <span>{e.rotulo}</span>
                {e.detalhe && <span className="small">{e.detalhe}</span>}
              </li>
            ))}
          </ol>
        )}
        <p className="small ts-carregando-rodape">
          <Icon name="clock" size={13} />
          {tempo(segundos)}
          {!compacto && (segundos >= DEMORANDO_S && !temPlano ? " · Ela costuma pensar um bom tempo antes do primeiro item; está tudo certo." : " · Leva alguns minutos.")}
        </p>
        {!compacto && <p className="small">Pode sair desta tela: a Vitória continua no servidor e o rascunho fica gravado quando ela terminar.</p>}
      </div>
    </div>
  );
}
