import "server-only";

import { api, apiOuNulo, ErroDaApi } from "@/lib/api";
import {
  caminhosDaApi,
  type ComoPontuar,
  type Extrato,
  type ListaDeConquistas,
  type ListaDePatentes,
  type MinhaPontuacao,
  type PerfilDaEquipeNaGamificacao,
  type PerfilDaPessoa,
  type RankingDeEquipes,
  type RankingDePessoas,
  type TemporadaDaLista,
} from "@/lib/gamificacao";

/** As leituras da gamificação na `api` (`/gamificacao/*`), para as páginas da seção e os blocos do perfil. */

/** Minha pontuação: patente, barra até a próxima, pontos, posições, conquistas e avisos. */
export const lerMinhaPontuacao = () => api<MinhaPontuacao>(caminhosDaApi.eu);

/** O extrato da própria pessoa, numa temporada (padrão: a de hoje) ou no geral (`geral`). */
export const lerExtrato = (temporada: string | undefined, pagina: number, tamanho: number) =>
  api<Extrato>(caminhosDaApi.extrato, { consulta: { temporada, pagina, tamanho } });

export const lerTemporadas = async (): Promise<TemporadaDaLista[]> => (await api<{ temporadas: TemporadaDaLista[] }>(caminhosDaApi.temporadas)).temporadas;

export const lerRankingDePessoas = (temporada: string | undefined) => api<RankingDePessoas>(caminhosDaApi.ranking, { consulta: { tipo: "pessoas", temporada } });

export const lerRankingDeEquipes = (temporada: string | undefined) => api<RankingDeEquipes>(caminhosDaApi.ranking, { consulta: { tipo: "equipes", temporada } });

export const lerRegras = () => api<ComoPontuar>(caminhosDaApi.regras);

export const lerPatentes = () => api<ListaDePatentes>(caminhosDaApi.patentes);

export const lerConquistas = () => api<ListaDeConquistas>(caminhosDaApi.conquistas);

/** `404` (pessoa que não joga ou rota que o campo de treino não tem) vira `null`: o bloco simplesmente não aparece. */
export const lerPerfilDaPessoa = (id: string) => apiOuNulo<PerfilDaPessoa>(caminhosDaApi.pessoa(id));

export const lerPerfilDaEquipe = (id: string) => apiOuNulo<PerfilDaEquipeNaGamificacao>(caminhosDaApi.equipe(id));

/** Como `apiOuNulo`, também para a falta de permissão: os blocos do perfil não derrubam a página. */
export async function lerOuNulo<T>(leitura: () => Promise<T>): Promise<T | null> {
  try {
    return await leitura();
  } catch (erro) {
    if (erro instanceof ErroDaApi && [403, 404].includes(erro.status)) return null;
    throw erro;
  }
}
