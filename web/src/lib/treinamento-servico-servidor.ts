import { redirect } from "next/navigation";
import { cache } from "react";
import { api, apiOuNulo, ErroDaApi } from "@/lib/api";
import type { Material, ServicoDaOs } from "@/lib/catalogo";
import type { RascunhoComIA, ReporteDeTreinamento, VersaoAnterior } from "@/lib/treinamento-servico";
import type { MeusServicosDeTreinamento, TreinamentoParaValidar, ValidacaoDoTreinamento } from "@/lib/treinamento-validacao";

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

/**
 * As versões do treinamento. Quem é supervisor e não é o autor do rascunho (nem validador) não as vê (`403`): para essa pessoa a lista
 * vem vazia, e a tela de cada caso explica o que acontece.
 */
export const versoesDoTreinamento = cache(async (codigo: string) => {
  try {
    return (await api<{ versoes: VersaoAnterior[] }>(`${caminho(codigo)}/versoes`)).versoes;
  } catch (erro) {
    if (erro instanceof ErroDaApi && erro.status === 403) return [];
    throw erro;
  }
});

/** A tela que explica por que a pessoa não pode mexer neste treinamento agora (rascunho de outra pessoa, ou sem permissão). */
export const telaIndisponivel = (codigo: string, motivo: "outro_autor" | "sem_permissao", detalhe?: string) =>
  `/app/catalogo/servicos/${encodeURIComponent(codigo)}/treinamento/indisponivel?motivo=${motivo}${detalhe ? `&detalhe=${encodeURIComponent(detalhe)}` : ""}`;

/**
 * Abre (ou cria) o rascunho: só nas telas que editam. O rascunho é de quem o criou: para outra pessoa (que não é admin), a `api` recusa
 * (`403 rascunho_de_outra_pessoa`) e a tela leva ao aviso, em vez de quebrar.
 */
export const rascunhoDoTreinamento = cache(async (codigo: string) => {
  try {
    return await api<RascunhoComIA>(`${caminho(codigo)}/rascunho`);
  } catch (erro) {
    if (erro instanceof ErroDaApi && erro.status === 403) redirect(telaIndisponivel(codigo, erro.codigo === "rascunho_de_outra_pessoa" ? "outro_autor" : "sem_permissao", erro.message));
    throw erro;
  }
});

/** Onde a pessoa pode criar e editar treinamento (o admin, em todos os serviços; o supervisor, nos das equipes que ele supervisiona). */
export const meusServicosDeTreinamento = cache(async (): Promise<MeusServicosDeTreinamento> => (await apiOuNulo<MeusServicosDeTreinamento>("/treinamentos/meus-servicos")) ?? { admin: false, servicos: [] });

/** A validação pelos supervisores; `null` quando a pessoa não participa dela (admin, autor e validadores veem) ou não há rascunho. */
export const validacaoDoTreinamento = cache(async (codigo: string) => {
  try {
    return await api<ValidacaoDoTreinamento>(`${caminho(codigo)}/validacao`);
  } catch (erro) {
    if (erro instanceof ErroDaApi && (erro.status === 403 || erro.status === 404)) return null;
    throw erro;
  }
});

/** Os treinamentos que esperam a decisão de quem pergunta. */
export const treinamentosParaValidar = cache(async () => (await api<{ treinamentos: TreinamentoParaValidar[] }>("/treinamentos/para-validar")).treinamentos);

/** O rascunho, só se já existir um (não cria versão nova). */
export const rascunhoSeHouver = cache(async (codigo: string) => {
  const versoes = await versoesDoTreinamento(codigo);
  return versoes.some((v) => v.estado === "rascunho") ? rascunhoDoTreinamento(codigo) : null;
});

/** Os problemas reportados deste serviço (a `api` lista de todos; o filtro por serviço é aqui). */
export const reportesDoTreinamento = cache(async (codigo: string) => {
  try {
    const { reportes } = await api<{ reportes: ReporteDeTreinamento[] }>("/treinamentos/reportes", { consulta: { tamanho: 200 } });
    return reportes.filter((r) => r.atividade_codigo === codigo);
  } catch (erro) {
    // Os problemas reportados são do admin: o supervisor que cria o treinamento não os lê.
    if (erro instanceof ErroDaApi && erro.status === 403) return [];
    throw erro;
  }
});

/** Os materiais ativos do catálogo, para mostrar o nome dos itens do Selecione com os materiais do serviço e escolher outros além dos do serviço. */
export const materiaisDoCatalogo = cache(async () => (await api<{ materiais: Material[] }>("/catalogo/materiais", { consulta: { ativo: true, tamanho: 200 } })).materiais);
