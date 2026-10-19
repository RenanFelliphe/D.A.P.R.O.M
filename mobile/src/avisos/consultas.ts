import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { Alerta } from "@shared/api/alertas";
import { cliente } from "@/api/api";
import { useSessao } from "@/sessao/SessaoProvider";

export type FiltroDeAvisos = "nao-lidos" | "todos";

interface ListaDeAvisos {
  alertas: Alerta[];
  pagina: number;
  tamanho: number;
  total: number;
}

const TAMANHO_DA_PAGINA = 20;
/** O contador da aba se atualiza sozinho a cada minuto (não há push, por decisão do projeto) e quando a pessoa volta ao app. */
const ATUALIZAR_O_CONTADOR_MS = 60_000;

/** Os avisos de quem está logado (`GET /alertas`), paginados; o filtro "não lidos" manda `lido=false`. */
export function useListaDeAvisos(filtro: FiltroDeAvisos) {
  return useInfiniteQuery({
    queryKey: ["avisos", "lista", filtro],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => cliente.chamar<ListaDeAvisos>("/alertas", { consulta: { lido: filtro === "nao-lidos" ? false : undefined, pagina: pageParam, tamanho: TAMANHO_DA_PAGINA } }),
    getNextPageParam: (ultima) => (ultima.pagina * ultima.tamanho < ultima.total ? ultima.pagina + 1 : undefined),
  });
}

/** Quantos avisos a pessoa ainda não leu: o número no sino da aba. Se a consulta falha, a aba fica sem número. */
export function useAvisosNaoLidos() {
  const { fase, destino } = useSessao();
  return useQuery({
    queryKey: ["avisos", "nao-lidos"],
    enabled: fase === "ativa" && destino === "abas",
    refetchInterval: ATUALIZAR_O_CONTADOR_MS,
    queryFn: async () => (await cliente.chamar<ListaDeAvisos>("/alertas", { consulta: { lido: false, pagina: 1, tamanho: 1 } })).total,
  });
}

/** Marca um aviso como lido (`PATCH /alertas/{id}`) e atualiza a lista e o contador. */
export function useMarcarAvisoComoLido() {
  const consultas = useQueryClient();
  return useCallback(
    async (id: string) => {
      await cliente.chamar(`/alertas/${id}`, { metodo: "PATCH", corpo: { lido: true } });
      await consultas.invalidateQueries({ queryKey: ["avisos"] });
    },
    [consultas],
  );
}
