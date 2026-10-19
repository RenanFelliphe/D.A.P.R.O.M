"use client";

import { useEffect, useState } from "react";
import { carregarReacao, movimentoReduzido, urlDoQuadroDaReacao } from "@/lib/reacao-vitoria";
import { duracaoDaReacao, type Reacao } from "@/lib/vitoria";

/**
 * Uma reação da Vitória tocando sem parar, para esperas longas (a geração do rascunho pela IA leva minutos). As animações
 * tocam uma vez só (`loop: 1` em `gerar-vitoria.mjs`), então a cada 5 s ela recomeça com um endereço novo da mesma imagem já
 * baixada. Com "reduzir movimento", fica o quadro parado.
 */
export function VitoriaEmLoop({ reacao, tamanho = 168 }: { reacao: Reacao; tamanho?: number }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (movimentoReduzido()) return;
    let ativo = true;
    let atual: string | null = null;
    let id: number | undefined;

    carregarReacao(reacao)
      .then((blob) => {
        if (!ativo) return;
        const tocar = () => {
          const anterior = atual;
          atual = URL.createObjectURL(blob);
          setUrl(atual);
          if (anterior) URL.revokeObjectURL(anterior);
        };
        tocar();
        id = window.setInterval(tocar, duracaoDaReacao(reacao, true));
      })
      .catch(() => {
        // Sem a animação, fica o quadro parado.
      });

    return () => {
      ativo = false;
      window.clearInterval(id);
      if (atual) URL.revokeObjectURL(atual);
    };
  }, [reacao]);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- o quadro é um arquivo do site e a animação um blob da memória: o next/image não tem o que otimizar.
    <img className="ts-vitoria-loop" src={url ?? urlDoQuadroDaReacao(reacao)} alt="" width={tamanho} height={tamanho} draggable={false} />
  );
}
