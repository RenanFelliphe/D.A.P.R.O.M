import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { CartaoDePrevisao, EsqueletoDaPrevisao } from "./CartaoDePrevisao";
import { usePrevisao, VALIDADE_DA_PREVISAO_MS } from "./usePrevisao";

/**
 * O cartão "Previsão do tempo" do topo da lista de OS: o que resta do expediente de hoje, com a orientação do dia. Esqueleto ao carregar;
 * sem previsão (provedor fora do ar e sem cópia guardada), some em silêncio. Atualiza ao puxar a lista (`aoAtualizar` do pai chama
 * `refetch` pelo `queryKey`) e ao voltar para a tela depois de 5 minutos: nunca num laço.
 */
export function PrevisaoNaLista() {
  const previsao = usePrevisao("expediente");
  const { refetch, dataUpdatedAt } = previsao;
  useFocusEffect(
    useCallback(() => {
      if (dataUpdatedAt > 0 && Date.now() - dataUpdatedAt > VALIDADE_DA_PREVISAO_MS) void refetch();
    }, [dataUpdatedAt, refetch]),
  );
  if (previsao.isPending) return <EsqueletoDaPrevisao />;
  if (!previsao.data) return null;
  return <CartaoDePrevisao previsao={previsao.data} />;
}
