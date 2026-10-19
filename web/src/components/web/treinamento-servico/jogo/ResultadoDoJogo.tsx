"use client";

import type { CSSProperties } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PontosGanhos } from "@/components/web/gamificacao/PontosGanhos";
import {
  formatarMultiplicador,
  formatarNota,
  formatarTempo,
  infoDoTipo,
  type FaseParaJogar,
  type RankingDoTreinamento as Ranking,
  type ResultadoDaConclusao,
} from "@/lib/treinamento-servico";
import { RankingDoTreinamento } from "../RankingDoTreinamento";
import { VitoriaNaCena } from "../vitoria/VitoriaNaCena";
import { Estrelas, estrelasDaNota, useContagem, useTecla } from "./efeitos";

interface ResultadoDoJogoProps {
  resultado: ResultadoDaConclusao;
  fases: FaseParaJogar[];
  pontua: boolean;
  /** O ranking do treinamento, lido depois de concluir; nulo no teste do admin. */
  ranking: Ranking | "carregando" | "erro" | null;
  /** Já tinha concluído antes desta tentativa: refazer não pontua na gamificação, e a tela explica por quê. */
  jaConcluiu: boolean;
  aoJogarDeNovo: () => void;
  aoReverExplicacao: (() => void) | null;
  aoFechar: () => void;
}

/** O anel da nota: a fração da nota máxima, que se desenha ao entrar, com a nota contando junto. */
function AnelDaNota({ nota, maxima }: { nota: number; maxima: number }) {
  const raio = 52;
  const volta = 2 * Math.PI * raio;
  const fracao = maxima > 0 ? Math.min(1, nota / maxima) : 0;
  const contando = useContagem(nota, 1300, 300);
  return (
    <div className="ts-anel ts-anel-nota" role="img" aria-label={`Nota ${formatarNota(nota)} de ${formatarNota(maxima)}`} data-cheio={nota === maxima || undefined}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="ts-anel-fundo" cx="60" cy="60" r={raio} />
        <circle className="ts-anel-valor" cx="60" cy="60" r={raio} strokeDasharray={volta} style={{ "--volta": volta, "--resto": volta * (1 - fracao) } as CSSProperties} />
      </svg>
      <span className="ts-anel-texto" aria-hidden="true">
        <strong>{formatarNota(contando)}</strong>
        <small>de {formatarNota(maxima)}</small>
      </span>
    </div>
  );
}

/** Como a nota desta rodada fica perto da melhor anterior (só ao jogar de novo). */
function MelhorNota({ nota, anterior }: { nota: number; anterior: number | null }) {
  if (anterior === null) return null;
  if (nota > anterior) {
    return (
      <p className="ts-resultado-recorde">
        <Icon name="trophy" size={13} />
        Nova melhor nota! Antes era {formatarNota(anterior)}; o ranking deste treinamento já usa a nova.
      </p>
    );
  }
  return (
    <p className="ts-resultado-nota">
      <Icon name="info" size={13} />
      Sua melhor nota continua {formatarNota(anterior)}: é ela que vale no ranking deste treinamento.
    </p>
  );
}

/**
 * O fim do treinamento: as estrelas (pelas fases certas), a Vitória comemorando, a nota (seção 12 do
 * `treinamentos-de-servico.md`), os pontos da gamificação (só no jogo de verdade, na primeira vez), o
 * ranking do treinamento (só no jogo de verdade) e cada fase.
 */
export function ResultadoDoJogo({ resultado, fases, pontua, ranking, jaConcluiu, aoJogarDeNovo, aoReverExplicacao, aoFechar }: ResultadoDoJogoProps) {
  const { fases_certas: certas, total_fases: total } = resultado;
  const estrelas = estrelasDaNota(certas, total);
  const gabaritou = estrelas === 3;
  const titulo = gabaritou ? "Nota máxima!" : estrelas === 2 ? "Mandou bem!" : "Treinamento concluído!";
  const fala = gabaritou
    ? "Você acertou todas as fases. É assim que se faz em campo!"
    : estrelas === 2
      ? "Muito bom! Confira abaixo as fases que escaparam: a explicação de cada uma ajuda a fixar."
      : "Errar aqui não tira ponto. Rever a explicação e jogar de novo ajuda a fixar o procedimento.";

  useTecla({ Enter: aoJogarDeNovo });

  return (
    <div className="ts-tela">
      <div className="ts-jogo-corpo ts-resultado" data-estrelas={estrelas}>
        <div className="ts-confetes" aria-hidden="true">
          {Array.from({ length: gabaritou ? 40 : 26 }, (_, i) => (
            <i key={i} style={{ "--i": i % 26, "--x": `${(i * 37) % 100}%` } as CSSProperties} />
          ))}
        </div>
        <Estrelas quantas={estrelas} />
        <h2 className="ts-resultado-titulo" data-foco tabIndex={-1}>
          {titulo}
        </h2>
        <div className="ts-resultado-topo">
          <VitoriaNaCena chave="resultado" reacao="comemorando" tamanho={130} empilhada>
            <p>{fala}</p>
          </VitoriaNaCena>
          <AnelDaNota nota={resultado.nota} maxima={resultado.nota_maxima} />
        </div>
        <p className="ts-resultado-conta">
          {certas} de {total} {total === 1 ? "fase certa" : "fases certas"} · a soma dos pontos das fases × ({total} fases × 10)
        </p>
        {pontua && <MelhorNota nota={resultado.nota} anterior={resultado.melhor_anterior} />}
        {pontua ? (
          resultado.pontos_ganhos > 0 ? (
            <PontosGanhos resposta={resultado} className="ts-resultado-pontos" />
          ) : (
            <p className="ts-resultado-nota">
              <Icon name="info" size={13} />
              {jaConcluiu ? "Os pontos da gamificação valem só na primeira vez que você conclui; jogar de novo pode melhorar a sua nota no ranking deste treinamento." : "Desta vez não houve pontos."}
            </p>
          )
        ) : (
          <p className="ts-resultado-nota">
            <Icon name="eye" size={13} />
            Modo teste: nada aqui pontua nem aparece para os técnicos.
          </p>
        )}
        {ranking === "carregando" ? (
          <p className="ts-resultado-nota" role="status">
            <Icon name="trophy" size={13} />
            Carregando o ranking…
          </p>
        ) : ranking === "erro" ? (
          <p className="ts-resultado-nota" role="status">
            <Icon name="info" size={13} />
            Não foi possível carregar o ranking agora; ele também aparece na página do treinamento.
          </p>
        ) : (
          ranking && (
            <>
              <RankingDoTreinamento ranking={ranking} className="ts-resultado-ranking" />
            </>
          )
        )}
        <ol className="ts-resultado-fases" aria-label="Fases">
          {fases.map((fase, i) => {
            const r = resultado.fases.find((f) => f.fase === i);
            const certa = Boolean(r && r.acertos === r.possiveis);
            const parcial = Boolean(r && r.acertos > 0 && !certa);
            const info = infoDoTipo(fase.tipo);
            return (
              <li key={i} data-estado={certa ? "certa" : parcial ? "parcial" : "errada"} style={{ "--i": i } as CSSProperties}>
                <span className="ts-correcao-marca" aria-label={certa ? "Certa" : parcial ? "Parcial" : "Errada"}>
                  <Icon name={certa ? "check" : parcial ? "star" : "x"} size={13} />
                </span>
                <span>Fase {i + 1}</span>
                {r && (
                  <span className="ts-resultado-pontos-fase">
                    {r.pontos.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} pts
                  </span>
                )}
                <span className="ts-resultado-tipo" data-jogo={fase.tipo}>
                  <Icon name={info.icone} size={13} />
                  {info.rotulo}
                  {r && (
                    <span className="ts-resultado-detalhe">
                      {r.possiveis > 1 && `${r.acertos}/${r.possiveis} · `}
                      {formatarTempo(r.tempo_ms)} · {formatarMultiplicador(r.multiplicador)}
                      {!r.confirmada && (r.acertos > 0 ? " · sem confirmar, valeu o que você fez" : " · sem resposta")}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="ts-jogo-rodape">
        <Button variant="line" onClick={aoFechar}>
          Fechar
        </Button>
        <span className="ts-rodape-espaco" />
        {aoReverExplicacao && (
          <Button variant="line" onClick={aoReverExplicacao}>
            <span className="ts-so-largo">Rever a explicação</span>
            <span className="ts-so-estreito">Rever</span>
          </Button>
        )}
        <Button variant="p" className="ts-botao-principal" onClick={aoJogarDeNovo}>
          <Icon name="refresh" size={16} />
          Jogar de novo
        </Button>
      </div>
    </div>
  );
}
