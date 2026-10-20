import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { caminhoDoServico, type ListaDeMateriais, type ServicoDoCatalogo } from "@shared/api/catalogo";
import type { RespostaComPontos } from "@shared/api/gamificacao";
import type { EquipeDoServico, ListaDeSugestoes, Sugestao } from "@shared/api/sugestao-materiais";
import { cliente } from "@/api/api";
import { useSessao } from "@/sessao/SessaoProvider";
import { traduzindoErros } from "./erros";

export type EscopoDeSugestoes = "minhas" | "avaliar";

const TAMANHO_DA_PAGINA = 20;
/** O número do selo se atualiza sozinho a cada minuto, como o do sino (não há push). */
const ATUALIZAR_O_SELO_MS = 60_000;

/** O serviço do catálogo com a lista de agora (`GET /catalogo/servicos/{codigo}`): a base de toda sugestão. */
export function useServicoDoCatalogo(codigo: string) {
  return useQuery({ queryKey: ["catalogo", "servico", codigo], queryFn: () => cliente.chamar<ServicoDoCatalogo>(caminhoDoServico(codigo)) });
}

/** As equipes que fazem o serviço; a de `responsavel: true` recebe a sugestão. Se falhar, a tela segue sem dizer para quem vai. */
export function useEquipesDoServico(codigo: string) {
  return useQuery({
    queryKey: ["sugestoes-materiais", "equipes", codigo],
    queryFn: async () => (await cliente.chamar<{ equipes: EquipeDoServico[] }>("/sugestoes-materiais/equipes", { consulta: { atividade: codigo } })).equipes,
  });
}

/** A busca de material no catálogo (só os ativos); a busca vazia traz os primeiros da ordem alfabética. */
export function useBuscaDeMateriais(busca: string) {
  return useQuery({
    queryKey: ["catalogo", "materiais", "busca", busca],
    queryFn: async () => (await cliente.chamar<ListaDeMateriais>("/catalogo/materiais", { consulta: { busca: busca || undefined, ativo: true, tamanho: 30 } })).materiais,
  });
}

/** As sugestões da pessoa (`minhas`) ou as que ela pode avaliar (`avaliar`), paginadas. */
export function useListaDeSugestoes(escopo: EscopoDeSugestoes, ativo = true) {
  return useInfiniteQuery({
    queryKey: ["sugestoes-materiais", "lista", escopo],
    enabled: ativo,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => cliente.chamar<ListaDeSugestoes>("/sugestoes-materiais", { consulta: { escopo, pagina: pageParam, tamanho: TAMANHO_DA_PAGINA } }),
    getNextPageParam: (ultima) => (ultima.pagina * ultima.tamanho < ultima.total ? ultima.pagina + 1 : undefined),
  });
}

/** Quantas sugestões esperam a avaliação da pessoa (o selo). Só quem supervisiona pergunta; para os outros é sempre zero. */
export function useParaAvaliar(avalia: boolean) {
  const { fase, destino } = useSessao();
  return useQuery({
    queryKey: ["sugestoes-materiais", "resumo"],
    enabled: avalia && fase === "ativa" && destino === "abas",
    refetchInterval: ATUALIZAR_O_SELO_MS,
    queryFn: async () => (await cliente.chamar<{ para_avaliar: number }>("/sugestoes-materiais/resumo")).para_avaliar,
  });
}

/** A sugestão inteira (`GET /sugestoes-materiais/{id}`): os itens, a lista de base, a de agora e o que a pessoa pode fazer. */
export function useSugestao(id: string) {
  return useQuery({ queryKey: ["sugestoes-materiais", "detalhe", id], queryFn: () => cliente.chamar<Sugestao>(`/sugestoes-materiais/${id}`) });
}

/**
 * Depois de enviar, retirar ou avaliar, o que as telas mostravam está velho: as listas e o selo, a sugestão, a lista do serviço (no
 * catálogo e no detalhe da OS), os avisos e os pontos.
 */
export function useAtualizarDepoisDaSugestao() {
  const consultas = useQueryClient();
  return useCallback(
    () => Promise.all(["sugestoes-materiais", "catalogo", "os", "avisos", "gamificacao"].map((k) => consultas.invalidateQueries({ queryKey: [k] }))),
    [consultas],
  );
}

/** O que aceitar e recusar devolvem: a sugestão como ficou, os pontos de quem avaliou e, ao aceitar, se a lista do serviço mudou. */
export type RespostaDaAvaliacao = Sugestao & RespostaComPontos & { lista_mudou?: boolean };

/** Aceita, recusa ou retira (`POST /sugestoes-materiais/{id}/aceitar|recusar|retirar`); o erro já vem com o texto desta funcionalidade. */
export const avaliarSugestao = (id: string, acao: "aceitar" | "recusar" | "retirar", corpo: object = {}) =>
  traduzindoErros(() => cliente.chamar<RespostaDaAvaliacao>(`/sugestoes-materiais/${id}/${acao}`, { metodo: "POST", corpo }));
