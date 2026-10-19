import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { caminhosDaApi, type Extrato, type ListaDeConquistas, type MinhaPontuacao, type RankingDeEquipes, type RankingDePessoas, type TemporadaDaLista } from "@shared/api/gamificacao";
import { cliente } from "@/api/api";

export const TAMANHO_DO_EXTRATO = 15;

/** Minha pontuação: patente, barra até a próxima, pontos, posições, conquistas com o progresso e os avisos pendentes. */
export const useMinhaPontuacao = () => useQuery({ queryKey: ["gamificacao", "eu"], queryFn: () => cliente.chamar<MinhaPontuacao>(caminhosDaApi.eu) });

/** O extrato da própria pessoa numa temporada (padrão: a de hoje) ou no geral (`geral`), paginado. */
export function useExtrato(temporada: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["gamificacao", "extrato", temporada ?? "atual"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => cliente.chamar<Extrato>(caminhosDaApi.extrato, { consulta: { temporada, pagina: pageParam, tamanho: TAMANHO_DO_EXTRATO } }),
    getNextPageParam: (ultima) => (ultima.pagina * ultima.tamanho < ultima.total ? ultima.pagina + 1 : undefined),
  });
}

export const useTemporadas = () =>
  useQuery({ queryKey: ["gamificacao", "temporadas"], queryFn: async () => (await cliente.chamar<{ temporadas: TemporadaDaLista[] }>(caminhosDaApi.temporadas)).temporadas });

/** O ranking de pessoas ou de equipes, na temporada de hoje (sem `temporada`), numa fechada ou no geral. */
export function useRanking(tipo: "pessoas" | "equipes", temporada: string | undefined) {
  return useQuery({
    queryKey: ["gamificacao", "ranking", tipo, temporada ?? "atual"],
    queryFn: () => cliente.chamar<RankingDePessoas | RankingDeEquipes>(caminhosDaApi.ranking, { consulta: { tipo, temporada } }),
  });
}

export const useConquistas = () => useQuery({ queryKey: ["gamificacao", "conquistas"], queryFn: () => cliente.chamar<ListaDeConquistas>(caminhosDaApi.conquistas) });
