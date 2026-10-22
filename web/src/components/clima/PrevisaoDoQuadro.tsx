"use client";

import { PrevisaoPorEstado } from "./CartaoDaPrevisao";
import { usePrevisao } from "./usePrevisao";

/**
 * A previsão do dia no quadro de OS, ao lado dos contadores: as horas que restam do expediente, o que dizer sobre elas e o que
 * fazer. Fica no navegador (pede a posição do aparelho; sem permissão, a `api` usa a cidade padrão das configurações) e se renova
 * a cada dez minutos, sem depender da atualização automática do quadro. No Campo de treino a previsão não existe e o cartão some.
 */
export function PrevisaoDoQuadro() {
  const estado = usePrevisao("expediente");
  return <PrevisaoPorEstado estado={estado} />;
}
