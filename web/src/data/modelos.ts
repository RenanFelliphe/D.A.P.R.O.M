/** Tipos e rótulos da tela de modelos de APR (formato das respostas de `GET /modelos-apr` e `GET /atividades`). */

export type RespostaBloqueante = "sim" | "nao";
export type TipoItem = "eliminatorio" | "alerta";
export type EvidenciaItem = "foto" | "texto";
export type SecaoItem = "verificacao" | "medida_preventiva";

/** Resumo de uma versão (`GET /modelos-apr`). */
export interface ResumoModelo {
  id: string;
  codigo: string;
  versao: number;
  titulo: string;
  data_documento: string | null;
  publicado_em: string | null;
  rascunho: boolean;
  itens_total: number;
}

export interface RiscoModelo {
  id: string;
  classificacao: string;
  nome: string;
  ordem: number;
}

export interface ItemModelo {
  id: string;
  secao: SecaoItem;
  risco_id: string | null;
  risco_ordem: number | null;
  ordem: number;
  texto: string;
  resposta_bloqueante: RespostaBloqueante | null;
  tipo: TipoItem;
  evidencia: EvidenciaItem;
  permite_na: boolean;
}

/** Plano de atendimento a emergências: JSON definido pelo cliente (`{titulo, subtitulo, fluxo, linhas}`). */
export interface Pae {
  titulo?: string | null;
  subtitulo?: string | null;
  fluxo?: string | null;
  linhas?: { rotulo: string | null; celulas: { coluna: number; texto: string }[] }[];
  [outro: string]: unknown;
}

/** Uma versão completa (`GET /modelos-apr/{codigo}/versoes/{versao}`). */
export interface ModeloCompleto {
  id: string;
  codigo: string;
  versao: number;
  titulo: string;
  data_documento: string | null;
  pae: Pae | null;
  publicado_em: string | null;
  rascunho: boolean;
  riscos: RiscoModelo[];
  itens: ItemModelo[];
}

export interface Atividade {
  codigo: string;
  descricao: string;
  modelo_apr_codigo: string | null;
  provisorio: boolean;
}

export const rotuloTipoItem: Record<TipoItem, string> = {
  eliminatorio: "Eliminatório",
  alerta: "Alerta",
};

export const rotuloResposta: Record<RespostaBloqueante, string> = {
  sim: "Sim",
  nao: "Não",
};

export const rotuloEvidencia: Record<EvidenciaItem, string> = {
  foto: "Foto",
  texto: "Texto",
};

export const rotuloSecao: Record<SecaoItem, string> = {
  verificacao: "Verificação",
  medida_preventiva: "Medida preventiva",
};
