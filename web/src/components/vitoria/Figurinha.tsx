"use client";

import { useEffect, useRef, useState } from "react";
import { carregarReacao, movimentoReduzido, urlDoQuadroDaReacao } from "@/lib/reacao-vitoria";
import { duracaoDaReacao, type Reacao } from "@/lib/vitoria";

/** Uma animação que demorou mais que isso para baixar já perdeu o momento da resposta: fica o quadro parado. */
const ATRASO_MAXIMO_MS = 3000;

interface Tocando {
  rodada: number;
  url: string;
}

/**
 * A reação da Vitória como figurinha, parte da própria mensagem (`docs/ia-e-vitoria.md`, seção 4.13): aparece com um "pop", toca a
 * animação uma vez e fica no quadro parado, como uma figurinha de WhatsApp. Um toque nela toca de novo, inteira.
 *
 * - `tocar`: a animação roda ao aparecer. Falso, a figurinha só mostra o quadro parado (mensagem antiga, painel
 *   reaberto, resposta que chegou com o painel fechado, movimento reduzido).
 * - `aoTerminar`: avisa quando a animação acaba, para a mensagem não tocar de novo ao reabrir o painel.
 */
export function Figurinha({
  reacao,
  completa = false,
  tocar,
  tamanho = 112,
  aoTerminar,
  className,
}: {
  reacao: Reacao;
  completa?: boolean;
  tocar: boolean;
  tamanho?: number;
  aoTerminar?: () => void;
  className?: string;
}) {
  const [rodada, setRodada] = useState(0);
  const [tocando, setTocando] = useState<Tocando | null>(null);
  const [terminou, setTerminou] = useState(false);
  const ativo = tocar || rodada > 0;
  // O aviso de fim vem quase sempre de uma função nova a cada render do pai: guardá-la numa ref evita recomeçar a animação.
  const aoTerminarRef = useRef(aoTerminar);
  useEffect(() => {
    aoTerminarRef.current = aoTerminar;
  });

  useEffect(() => {
    if (!ativo || movimentoReduzido()) return;
    let cancelado = false;
    let url: string | null = null;
    let temporizador: number | undefined;
    const pediuEm = Date.now();

    carregarReacao(reacao)
      .then((blob) => {
        if (cancelado || Date.now() - pediuEm > ATRASO_MAXIMO_MS) return;
        // Um endereço novo a cada vez: uma imagem animada com o mesmo endereço não recomeça do primeiro quadro.
        url = URL.createObjectURL(blob);
        setTocando({ rodada, url });
        setTerminou(false);
        temporizador = window.setTimeout(
          () => {
            setTerminou(true);
            aoTerminarRef.current?.();
          },
          duracaoDaReacao(reacao, completa || rodada > 0),
        );
      })
      .catch(() => {
        // Sem a animação a figurinha fica no quadro parado; nunca vira erro na tela.
      });

    return () => {
      cancelado = true;
      window.clearTimeout(temporizador);
      if (url) URL.revokeObjectURL(url);
    };
  }, [ativo, reacao, completa, rodada]);

  const animada = ativo && tocando && tocando.rodada === rodada && !terminou ? tocando.url : null;

  return (
    <button
      type="button"
      className={className ? `vt-figurinha ${className}` : "vt-figurinha"}
      style={{ width: tamanho, height: tamanho }}
      onClick={() => setRodada((r) => r + 1)}
      aria-label="Vitória. Toque para ver a animação de novo"
    >
      {/* O quadro parado é um arquivo do site e a animação é um blob da memória (ver `carregarReacao`): o next/image não tem o que otimizar. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={animada ?? urlDoQuadroDaReacao(reacao)} alt="" width={tamanho} height={tamanho} draggable={false} />
    </button>
  );
}
