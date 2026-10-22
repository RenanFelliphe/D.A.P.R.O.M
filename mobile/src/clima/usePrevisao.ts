import { useQuery } from "@tanstack/react-query";
import type { JanelaDoClima } from "@shared/api/clima";
import { obterPrevisao } from "@/campo/clima";

/** A previsão vale 5 minutos na tela: atualizar de novo é puxar a lista ou voltar a ela depois desse tempo, nunca um laço. */
export const VALIDADE_DA_PREVISAO_MS = 5 * 60_000;

/**
 * A previsão do tempo de uma janela (`expediente` na lista de OS; `proximas_horas` na APR e no encerramento). `data` é `null` quando
 * não há previsão nenhuma (provedor fora do ar e sem cópia guardada de hoje): as telas então não a mostram. Nunca dá erro: a falta de
 * previsão não atrapalha o trabalho.
 */
export function usePrevisao(janela: JanelaDoClima, ativa = true) {
  return useQuery({
    queryKey: ["clima", janela],
    queryFn: () => obterPrevisao({ janela }),
    enabled: ativa,
    staleTime: VALIDADE_DA_PREVISAO_MS,
    retry: false,
  });
}
