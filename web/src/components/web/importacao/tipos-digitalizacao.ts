/**
 * Formatos das respostas de `/digitalizacoes` (a Digitalização de OS antigas, só o admin): a leitura em segundo plano e a
 * conferência antes do registro. O desenho está na seção 6 do `docs/ia-e-vitoria.md`.
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

export type FuncaoNaApr = "responsavel" | "executor";
export type RespostaDaApr = "sim" | "nao" | "na";

/** Uma pessoa da tabela de participantes da APR em papel, como foi lida e conferida com o cadastro e o registro de funcionários. */
export interface ParticipanteLido {
  nome: string | null;
  matricula: string | null;
  funcao: FuncaoNaApr;
  /** A matrícula é de uma conta do sistema; quem não tem conta (ou já saiu) fica só com nome e matrícula. */
  usuario_id: string | null;
  estado: EstadoDoCampo;
  aviso: string | null;
}

/** A APR em papel que veio junto com a folha da OS (as folhas com o título "Análise Preliminar de Risco"). */
export interface AprLida {
  /** As folhas do PDF que são a APR (a partir de 1). */
  paginas: number[];
  lido_por: "ia" | "nenhum";
  /** O modelo achado pelo código impresso no título; `null` quando nada o identificou. */
  modelo: { id: string; codigo: string; versao: number; titulo: string } | null;
  /** O número da OS escrito à mão na APR. */
  numero_os: string | null;
  /** `AAAA-MM-DDTHH:MM`, o formato do `datetime-local`. */
  data_hora: string | null;
  servico: string | null;
  participantes: ParticipanteLido[];
  respostas: { item_id: string; resposta: RespostaDaApr }[];
  avisos: string[];
}

/** Um item de um modelo de APR (`GET /digitalizacoes/modelos-apr`); a resposta bloqueante só o admin vê, e é a desta tela. */
export interface ItemDoModeloApr {
  id: string;
  ordem: number;
  secao: "verificacao" | "medida_preventiva";
  risco: string | null;
  texto: string;
  resposta_bloqueante: "sim" | "nao" | null;
  permite_na: boolean;
}

export interface ModeloDaAprParaConferencia {
  id: string;
  codigo: string;
  versao: number;
  titulo: string;
  /** O modelo foi excluído: não vale para APR nova, mas a folha antiga pode ser dele. */
  arquivado: boolean;
  itens: ItemDoModeloApr[];
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
  /** A APR em papel da OS; `null` (ou ausente, nas leituras de antes da APR) quando a leitura não achou folha de APR. */
  apr?: AprLida | null;
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

/** A APR em papel como a pessoa a conferiu (`POST /digitalizacoes/{id}/registro`). */
export interface AprConferidaParaRegistro {
  modelo_id: string;
  data_hora: string | null;
  servico: string | null;
  participantes: { nome: string; matricula: string | null; funcao: FuncaoNaApr }[];
  respostas: { item_id: string; resposta: RespostaDaApr }[];
}

/** O que a conferência manda de cada OS (`POST /digitalizacoes/{id}/registro`). */
export interface OsConferidaParaRegistro {
  chave: string;
  ordem: OrdemDoPdf;
  execucao: { inicio: string | null; fim: string | null; numero_pessoas: number | null; texto: string | null };
  /** `null`: só a OS é registrada; a folha da APR fica nas imagens do PDF da OS. */
  apr: AprConferidaParaRegistro | null;
}

export const LIMITE_DO_PDF_DIGITALIZADO_MB = 30;
/** O mesmo limite da `api`: a câmera é para folhas avulsas; para mais, escaneia-se e envia-se o PDF. */
export const MAX_FOTOS_POR_ENVIO = 8;
