"use client";

import { useEffect, useState } from "react";
import { buscarPrevisao, type JanelaDoClima, type PrevisaoDoTempo } from "@/lib/clima";

/**
 * - `carregando`: ainda não respondeu;
 * - `pronta`: a previsão (que pode vir com `disponivel: false` quando o provedor não respondeu à `api`);
 * - `indisponivel`: a `api` não respondeu (rede, erro);
 * - `oculta`: a previsão não existe nesta tela (o Campo de treino responde 404): quem usa não mostra nada, nem erro.
 */
export type EstadoDaPrevisao = { fase: "carregando" } | { fase: "pronta"; previsao: PrevisaoDoTempo } | { fase: "indisponivel" } | { fase: "oculta" };

const RENOVAR_A_CADA_MS = 10 * 60_000;

/**
 * A previsão da janela, para as telas que a mostram. Pede ao montar e renova a cada dez minutos (não a cada atualização automática
 * da tela, e nunca pede a posição do aparelho de novo antes dos dez minutos: ver `posicaoParaOClima`). Com `ativo: false` não pede nada.
 */
export function usePrevisao(janela: JanelaDoClima, ativo = true): EstadoDaPrevisao {
  const [estado, setEstado] = useState<EstadoDaPrevisao>({ fase: "carregando" });

  useEffect(() => {
    if (!ativo) return;
    let cancelado = false;
    const carregar = async () => {
      const previsao = await buscarPrevisao(janela);
      if (cancelado) return;
      setEstado(previsao === undefined ? { fase: "oculta" } : previsao === null ? { fase: "indisponivel" } : { fase: "pronta", previsao });
    };
    void carregar();
    const temporizador = setInterval(() => void carregar(), RENOVAR_A_CADA_MS);
    return () => {
      cancelado = true;
      clearInterval(temporizador);
    };
  }, [janela, ativo]);

  return estado;
}
