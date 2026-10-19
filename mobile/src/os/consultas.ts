import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { DetalheDaOs, ListaDeOs } from "@shared/api/os-app";
import type { PlanoDaOs } from "@shared/api/preventivas";
import type { OsStatus } from "@shared/api/tipos";
import { cliente } from "@/api/api";
import { ErroDaApi } from "@/api/erros";
import { leitura, lerDeOndeDer } from "@/offline/app";

/** Uma APR de hoje que espera a assinatura de quem pergunta (`GET /me/aprs-para-assinar`). */
export interface AprParaAssinar {
  apr_id: string;
  os_id: string;
  numero_ordem: string | null;
  titulo: string;
  local_codigo: string;
  concluida_em: string;
  preenchida_por: string;
  preenchida_por_nome: string;
  funcao: "responsavel" | "executor";
}

/** Uma execução do técnico ainda em andamento, em qualquer OS (`GET /me/execucoes-abertas`). */
export interface ExecucaoAberta {
  id: string;
  os_id: string;
  apr_id: string;
  inicio: string;
  numero_ordem: string | null;
  titulo: string;
}

export const TAMANHO_DA_PAGINA = 20;

/**
 * A lista de OS da equipe (`GET /os`), um status por vez, paginada; a busca é pelo número da ordem e pelo título. Sem sinal (ou com
 * registro esperando na fila), vem da cópia local da equipe.
 */
export function useListaDeOs(status: OsStatus, busca: string) {
  return useInfiniteQuery({
    queryKey: ["os", "lista", status, busca],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      lerDeOndeDer(
        () => cliente.chamar<ListaDeOs>("/os", { consulta: { status, busca: busca || undefined, pagina: pageParam, tamanho: TAMANHO_DA_PAGINA } }),
        () => leitura.lista({ status, busca, pagina: pageParam, tamanho: TAMANHO_DA_PAGINA }),
      ),
    getNextPageParam: (ultima) => (ultima.pagina * ultima.tamanho < ultima.total ? ultima.pagina + 1 : undefined),
  });
}

/** O aviso de apoio da lista: se a consulta falhar, a tela segue sem ele. Sem sinal não há o que assinar (a APR sem sinal já nasce assinada). */
export function useAprsParaAssinar() {
  return useQuery({
    queryKey: ["me", "aprs-para-assinar"],
    queryFn: () =>
      lerDeOndeDer(
        async () => (await cliente.chamar<{ aprs: AprParaAssinar[] }>("/me/aprs-para-assinar")).aprs,
        async () => [] as AprParaAssinar[],
      ),
  });
}

export function useExecucoesAbertas() {
  return useQuery({
    queryKey: ["me", "execucoes-abertas"],
    queryFn: () =>
      lerDeOndeDer(
        async () => (await cliente.chamar<{ execucoes: ExecucaoAberta[] }>("/me/execucoes-abertas")).execucoes,
        () => leitura.execucoesAbertas(),
      ),
  });
}

/**
 * O detalhe da OS (`GET /os/{id}`): a OS, o serviço do catálogo, as APRs e as execuções. `atualizarACadaMs` o recarrega sozinho (a tela das
 * assinaturas vê os colegas assinando); as consultas só rodam enquanto o app está em primeiro plano.
 */
export function useDetalheDaOs(id: string, opcoes: { atualizarACadaMs?: number } = {}) {
  return useQuery({
    queryKey: ["os", id],
    queryFn: () =>
      lerDeOndeDer(
        () => cliente.chamar<DetalheDaOs>(`/os/${id}`),
        () => leitura.detalhe(id),
      ),
    refetchInterval: opcoes.atualizarACadaMs,
  });
}

/** O ciclo da preventiva; `404` (a OS não é de um plano) vira `null`. Só consulta quando a OS é preventiva. */
export function usePlanoDaOs(id: string, preventiva: boolean) {
  return useQuery({
    queryKey: ["os", id, "preventiva"],
    enabled: preventiva,
    // O ciclo da preventiva não vai na cópia local: sem sinal, a OS aparece sem ele.
    queryFn: () =>
      lerDeOndeDer<PlanoDaOs | null>(
        async () => {
          try {
            return await cliente.chamar<PlanoDaOs>(`/os/${id}/preventiva`);
          } catch (e) {
            if (e instanceof ErroDaApi && e.status === 404) return null;
            throw e;
          }
        },
        async () => null,
      ),
  });
}
