/**
 * Formatos das respostas de `/digitalizacoes` (a Digitalização de OS antigas, só o admin): a leitura em segundo plano e a
 * conferência antes do registro. O desenho está na seção 10 do vitoria.md.
 */

import type { OsStatus } from "@/lib/tipos";
import type { AvisoDaOrdem, CampoObrigatorioDoPdf, LinhaIgnorada, OrdemDoPdf } from "./tipos";

/** Como a conferência classifica cada campo lido: o que bateu, o que ninguém confirmou, o que está errado e o que não veio. */
export type EstadoDoCampo = "confere" | "duvidoso" | "invalido" | "faltando";

export type CampoDaConferencia =
  | "numero_ordem"
  | "tipo_ordem"
  | "titulo"
  | "centro_trabalho"
  | "local_instalacao"
  | "equipamento"
  | "data_inicio_prog"
  | "inicio_real"
  | "fim_real"
  | "numero_pessoas"
  | "texto";

/** O que está escrito à mão na folha, como a IA (ou ninguém) leu. `inicio` e `fim` em `AAAA-MM-DDTHH:MM`, o formato do `datetime-local`. */
export interface ManuscritoLido {
  inicio: string | null;
  fim: string | null;
  pessoas: number | null;
  texto: string | null;
  avisos: string[];
  lido_por: "ia" | "nenhum";
}

export interface OsDigitalizadaLida {
  /** O número da ordem como foi lido: identifica a OS mesmo que a pessoa corrija o número. */
  chave: string;
  /** Todas as folhas da OS no PDF (a partir de 1), a APR inclusive. */
  paginas: number[];
  /** As que trazem o cabeçalho da OS; só elas vão à IA. */
  folhas_da_os: number[];
  ordem: OrdemDoPdf;
  faltando: CampoObrigatorioDoPdf[];
  observacoes: string[];
  manuscrito: ManuscritoLido;
  estados: Partial<Record<CampoDaConferencia, EstadoDoCampo>>;
  avisos: string[];
  /** O que o sistema sabe da OS agora. */
  situacao: {
    existente: { id: string; status: OsStatus; origem: string } | null;
    tem_execucao: boolean;
    equipe: { id: string; nome: string } | null;
  };
}

export interface LeituraDigitalizada {
  paginas: number;
  paginas_sem_ordem: number[];
  /** Nitidez média do que o OCR leu, de 0 a 100. */
  confianca_media: number;
  ia: { usada: boolean; motivo: string | null };
  ordens: OsDigitalizadaLida[];
}

export type EstadoDaDigitalizacao = "lendo" | "lida" | "falhou" | "registrada";
export type EtapaDaDigitalizacao = "preparando" | "ocr" | "ia" | "conferindo";

/** `GET /digitalizacoes/{id}` (com `leitura` quando está `lida`) e os itens de `GET /digitalizacoes`. */
export interface Digitalizacao {
  id: string;
  nome_arquivo: string;
  estado: EstadoDaDigitalizacao;
  etapa: EtapaDaDigitalizacao;
  paginas: number;
  paginas_lidas: number;
  usou_ia: boolean;
  erro: string | null;
  criada_em: string;
  atualizada_em: string;
  leitura?: LeituraDigitalizada;
}

/** `POST /digitalizacoes/{id}/registro`. */
export interface ResultadoDaDigitalizacao {
  importacao_id: string | null;
  criadas: number;
  atualizadas: number;
  ignoradas: LinhaIgnorada[];
  avisos: AvisoDaOrdem[];
  registradas: { numero_ordem: string; os_id: string }[];
}

/** O que a conferência manda de cada OS (`POST /digitalizacoes/{id}/registro`). */
export interface OsConferidaParaRegistro {
  chave: string;
  ordem: OrdemDoPdf;
  execucao: { inicio: string | null; fim: string | null; numero_pessoas: number | null; texto: string | null };
}

export const LIMITE_DO_PDF_DIGITALIZADO_MB = 30;
