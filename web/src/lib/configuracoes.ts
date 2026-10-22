/**
 * As configurações do sistema (`GET /configuracoes/sistema`, só o admin; `docs/operacao-de-campo.md`, seção 13): a cidade padrão da
 * previsão do tempo e os valores numéricos que antes eram variáveis de ambiente (horários das rotinas, limites da IA). O ambiente é só
 * o valor inicial (`padrao`); o que o admin muda vale na hora.
 */

export type GrupoDeConfiguracao = "rotinas" | "ia";

export interface ConfiguracaoNumerica {
  chave: string;
  grupo: GrupoDeConfiguracao;
  rotulo: string;
  descricao: string;
  /** "minutos", "hora (0 a 23)", "mensagens"… */
  unidade: string;
  min: number;
  max: number;
  valor: number;
  padrao: number;
  /** O admin mudou o valor (há uma linha no banco): "voltar ao padrão" a apaga. */
  personalizado: boolean;
  atualizado_em: string | null;
}

export interface CidadePadrao {
  nome: string;
  latitude: number;
  longitude: number;
}

export interface CidadePadraoDoSistema extends CidadePadrao {
  /** A cidade do sistema quando ninguém escolhe outra (Vitória, ES). */
  padrao: CidadePadrao;
  personalizado: boolean;
  atualizado_em: string | null;
}

/** Os contatos do PAE que o botão de emergência mostra (`PUT /configuracoes/sistema/contatos_pae`); vazio até o admin cadastrar. */
export interface ContatosDoPaeDoSistema {
  contatos: { nome: string; telefone: string; descricao: string | null }[];
  personalizado: boolean;
  atualizado_em: string | null;
}

export interface ConfiguracoesDoSistema {
  contatos_pae: ContatosDoPaeDoSistema;
  cidade_padrao: CidadePadraoDoSistema;
  itens: ConfiguracaoNumerica[];
}

/** Uma cidade de `GET /clima/cidades?busca=` (admin). */
export interface CidadeEncontrada {
  nome: string;
  regiao: string | null;
  latitude: number;
  longitude: number;
}

/** O nome como fica guardado e mostrado: "Linhares, Espírito Santo". */
export const nomeDaCidade = (c: Pick<CidadeEncontrada, "nome" | "regiao">) => (c.regiao ? `${c.nome}, ${c.regiao}` : c.nome);

export const caminhoDaConfiguracao = (chave: string) => `/configuracoes/sistema/${chave}`;
