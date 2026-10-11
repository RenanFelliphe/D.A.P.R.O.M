/** Formatos das respostas de `GET /importacoes` e `POST /importacoes`. */

export interface LinhaIgnorada {
  /** Número da linha na planilha; na leitura pela API vem só o `numero_ordem`. */
  linha?: number;
  numero_ordem?: string;
  centro_trabalho?: string;
  motivo: string;
}

export interface AvisoDaOrdem {
  linha?: number;
  numero_ordem: string;
  motivo: string;
}

export interface Importacao {
  id: string;
  origem: "api" | "planilha";
  /** `<id>/<nome>.xlsx` no bucket; só as planilhas têm. */
  arquivo: string | null;
  usuario_id: string | null;
  usuario_nome: string | null;
  criadas: number;
  atualizadas: number;
  ignoradas: number;
  detalhe_ignoradas: LinhaIgnorada[] | null;
  erro: string | null;
  criada_em: string;
}

export interface ResultadoDaPlanilha {
  importacao_id: string;
  criadas: number;
  atualizadas: number;
  ignoradas: LinhaIgnorada[];
  avisos: AvisoDaOrdem[];
}

/** Nome da planilha sem a pasta do bucket. */
export const nomeDoArquivo = (arquivo: string | null) => (arquivo ? arquivo.slice(arquivo.lastIndexOf("/") + 1) : "—");
