import { useEffect, useState } from "react";

/**
 * O relógio do aparelho, atualizado a cada `intervaloMs` (um segundo, por padrão) enquanto a tela está aberta. Quem só precisa saber se passou de um prazo pede um intervalo maior, para não redesenhar a tela inteira a cada segundo. O cronômetro NÃO depende dele para estar certo: o tempo
 * é sempre calculado do início e das pausas que a `api` guardou, então fechar o app e voltar mostra o tempo correto na hora.
 */
export function useAgora(intervaloMs = 1000): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const intervalo = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(intervalo);
  }, [intervaloMs]);
  return agora;
}
