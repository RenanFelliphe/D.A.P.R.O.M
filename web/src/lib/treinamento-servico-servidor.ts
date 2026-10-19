import { cache } from "react";
import { api, apiOuNulo } from "@/lib/api";
import type { Material, ServicoDaOs } from "@/lib/catalogo";
import type { RascunhoComIA, ReporteDeTreinamento, VersaoAnterior } from "@/lib/treinamento-servico";

/**
 * As leituras das telas do treinamento de serviço do admin (`/app/catalogo/servicos/{codigo}/treinamento/*`), uma vez por
 * requisição: o layout e a página pedem as mesmas coisas.
 *
 * Cuidado: `GET .../rascunho` **cria** o rascunho quando não há um (a partir da versão publicada, se existir). Só as telas de
 * edição o chamam; a visão geral, as versões, os problemas e a publicação olham as versões antes, para não abrir uma versão
 * nova só porque o admin passou pela tela.
 */

/** O código do serviço vem codificado na URL (pode ter pontos e barras: `8.7.2/8.7.3`). */
export function codigoDaRota(valor: string) {
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
}

const caminho = (codigo: string) => `/treinamentos/${encodeURIComponent(codigo)}`;

export const servicoDoTreinamento = cache((codigo: string) => apiOuNulo<ServicoDaOs>(`/catalogo/servicos/${encodeURIComponent(codigo)}`));

export const versoesDoTreinamento = cache(async (codigo: string) => (await api<{ versoes: VersaoAnterior[] }>(`${caminho(codigo)}/versoes`)).versoes);

/** Abre (ou cria) o rascunho: só nas telas que editam. */
export const rascunhoDoTreinamento = cache((codigo: string) => api<RascunhoComIA>(`${caminho(codigo)}/rascunho`));

/** O rascunho, só se já existir um (não cria versão nova). */
export const rascunhoSeHouver = cache(async (codigo: string) => {
  const versoes = await versoesDoTreinamento(codigo);
  return versoes.some((v) => v.estado === "rascunho") ? rascunhoDoTreinamento(codigo) : null;
});

/** Os problemas reportados deste serviço (a `api` lista de todos; o filtro por serviço é aqui). */
export const reportesDoTreinamento = cache(async (codigo: string) => {
  const { reportes } = await api<{ reportes: ReporteDeTreinamento[] }>("/treinamentos/reportes", { consulta: { tamanho: 200 } });
  return reportes.filter((r) => r.atividade_codigo === codigo);
});

/** Os materiais ativos do catálogo, para mostrar o nome dos itens do Selecione com os materiais do serviço e escolher outros além dos do serviço. */
export const materiaisDoCatalogo = cache(async () => (await api<{ materiais: Material[] }>("/catalogo/materiais", { consulta: { ativo: true, tamanho: 200 } })).materiais);
