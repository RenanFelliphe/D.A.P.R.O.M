import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { conferenciaEmAberto } from "./regras";
import type { ConferenciaDaApi, ConferenciaResumo } from "@shared/api/conferencia-execucao";
import { cliente } from "@/api/api";
import { useConexao } from "@/estado/conexao";
import { useSessao } from "@/sessao/SessaoProvider";

/** De quanto em quanto tempo a tela da conferência se relê com a tela em foco (os colegas escolhem e assinam; não há push). */
export const RELER_A_CADA_MS = 15_000;
/** A faixa e o cartão do perfil perguntam mais devagar: é só um lembrete. */
export const PERGUNTAR_A_CADA_MS = 60_000;

/**
 * A conferência inteira (`GET /conferencias/{id}`): as versões de cada aparelho, as diferenças, as escolhas e o que a pessoa pode fazer.
 * Só com sinal (ela não vai na cópia do aparelho) e só enquanto anda: depois de concluída ou fechada, não muda mais e não se relê.
 */
export function useConferencia(id: string | null) {
  const online = useConexao() === "online";
  return useQuery({
    queryKey: ["conferencia", id],
    enabled: id !== null && online,
    refetchInterval: (consulta) => (consulta.state.data && !conferenciaEmAberto(consulta.state.data) ? false : RELER_A_CADA_MS),
    queryFn: () => cliente.chamar<ConferenciaDaApi>(`/conferencias/${id}`),
  });
}

/**
 * "Para conferir" (`GET /me/conferencias`): as conferências em aberto de quem pergunta, com o que falta dele. Mora sob `["me"]`, então
 * qualquer evento de campo a invalida. Sem sinal ou com a consulta falhando, fica vazia (o cartão e a faixa somem).
 */
export function useParaConferir(opcoes: { atualizarACadaMs?: number } = {}) {
  const { fase, destino } = useSessao();
  const online = useConexao() === "online";
  return useQuery({
    queryKey: ["me", "conferencias"],
    enabled: fase === "ativa" && destino === "abas" && online,
    refetchInterval: opcoes.atualizarACadaMs,
    retry: false,
    queryFn: async () => (await cliente.chamar<{ conferencias: ConferenciaResumo[] }>("/me/conferencias")).conferencias,
  });
}

export type AcaoDaConferencia = "decidir" | "assinar" | "fechar";

/** O que cada ação manda à `api`; o `fechar` vai sem nada além do corpo vazio. */
export function chamarConferencia(id: string, acao: AcaoDaConferencia, corpo: object = {}): Promise<ConferenciaDaApi> {
  return cliente.chamar<ConferenciaDaApi>(`/conferencias/${id}/${acao}`, { metodo: "POST", corpo });
}

/** Depois de escolher, assinar ou fechar: a própria conferência, a lista do perfil e a OS (o estado e o botão dela) estão velhas. */
export function useAtualizarDepoisDaConferencia() {
  const consultas = useQueryClient();
  return useCallback(
    (nova?: ConferenciaDaApi) => {
      // A resposta já é a conferência de agora: a tela a mostra sem esperar a releitura.
      if (nova) consultas.setQueryData(["conferencia", nova.id], nova);
      return Promise.all([consultas.invalidateQueries({ queryKey: ["me"] }), consultas.invalidateQueries({ queryKey: ["os"] }), consultas.invalidateQueries({ queryKey: ["eu"] })]);
    },
    [consultas],
  );
}
