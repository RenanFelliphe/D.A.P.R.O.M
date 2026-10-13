/** Tipos e rótulos da seção APR (formato das respostas de `GET /modelos-apr` e `GET /atividades`). */

import type { Agrupamento } from "@/components/web/importacao/tipos";
import type { OsStatus } from "@/lib/tipos";

export type RespostaBloqueante = "sim" | "nao";
export type TipoItem = "eliminatorio" | "alerta";
/** O que o item reprovado exige além da observação: foto, PDF (laudo, certificado) ou só o texto. */
export type EvidenciaItem = "foto" | "texto" | "pdf";
export type SecaoItem = "verificacao" | "medida_preventiva";

/** Resumo de uma versão (`GET /modelos-apr` e `GET /modelos-apr/{codigo}`). */
export interface ResumoModelo {
  id: string;
  codigo: string;
  versao: number;
  titulo: string;
  data_documento: string | null;
  publicado_em: string | null;
  /** Modelo excluído depois de publicado: vale para todas as versões do código. */
  arquivado_em: string | null;
  rascunho: boolean;
  itens_total: number;
  /** APRs respondidas nesta versão. */
  aprs_total: number;
  /** Atividades do SAP ligadas ao código (igual em todas as versões). */
  atividades_total: number;
}

/** `GET /modelos-apr/{codigo}`: o modelo e todas as versões dele, da mais nova à mais antiga. */
export interface DetalheModelo {
  codigo: string;
  titulo: string;
  arquivado_em: string | null;
  versoes: ResumoModelo[];
}

/** `GET /modelos-apr/{codigo}/uso`: por onde as OS chegam ao modelo e o que já foi respondido nele. */
export interface UsoDoModelo {
  codigo: string;
  atividades: { codigo: string; descricao: string; provisorio: boolean }[];
  os_abertas: {
    total: number;
    recentes: { id: string; numero_ordem: string | null; titulo: string; status: OsStatus; codigo_atividade: string | null; data_inicio_prog: string; equipe: string }[];
  };
  aprs: { total: number; bloqueadas: number; ultima_em: string | null };
}

/** Item reprovado num ranking do Diagnóstico: quantas vezes recebeu a resposta que o modelo marca. */
export interface ItemReprovado {
  modelo: string;
  texto: string;
  secao: SecaoItem;
  total: number;
}

/**
 * `GET /aprs/resumo`: o dashboard de APR no período (o filtro comum dos dashboards). `alertas`, `itens_que_bloqueiam` e
 * `alertas_registrados` dizem quais itens são eliminatórios e quais são de alerta: vêm `null` para quem não é admin.
 */
export interface ResumoDasAprs {
  periodo: string;
  agrupamento: Agrupamento;
  de: string;
  ate: string;
  totais: { aprs: number; aprovadas: number; bloqueadas: number; alertas: number | null; sem_modelo_ligado: number };
  anterior: { aprs: number; bloqueadas: number };
  serie: { inicio: string; fim: string; aprovadas: number; bloqueadas: number }[];
  itens_que_bloqueiam: ItemReprovado[] | null;
  alertas_registrados: ItemReprovado[] | null;
  por_modelo: { codigo: string; titulo: string; aprs: number; bloqueadas: number }[];
  por_equipe: { id: string; nome: string; aprs: number; bloqueadas: number }[];
}

/** As versões de um código, com a em uso (publicada mais recente) e o rascunho à mão. */
export interface GrupoModelo {
  codigo: string;
  /** Título da versão em uso; num modelo que ainda não foi publicado, o do rascunho. */
  titulo: string;
  versoes: ResumoModelo[];
  emUso?: ResumoModelo;
  rascunho?: ResumoModelo;
  arquivadoEm: string | null;
  aprsTotal: number;
  atividadesTotal: number;
}

/** Agrupa as versões (já ordenadas por código e versão decrescente) por código do modelo. */
export function agruparModelos(modelos: ResumoModelo[]): GrupoModelo[] {
  const porCodigo = new Map<string, ResumoModelo[]>();
  for (const m of modelos) porCodigo.set(m.codigo, [...(porCodigo.get(m.codigo) ?? []), m]);
  return [...porCodigo.entries()].map(([codigo, versoes]) => {
    const emUso = versoes.find((v) => !v.rascunho);
    const rascunho = versoes.find((v) => v.rascunho);
    return {
      codigo,
      titulo: (emUso ?? versoes[0]!).titulo,
      versoes,
      emUso,
      rascunho,
      arquivadoEm: versoes[0]!.arquivado_em,
      aprsTotal: versoes.reduce((soma, v) => soma + v.aprs_total, 0),
      atividadesTotal: versoes[0]!.atividades_total,
    };
  });
}

/** Próximo código livre no padrão dos documentos (`APR 10`), contando os modelos excluídos. */
export function proximoCodigo(codigos: string[]): string {
  const numeros = codigos.map((c) => /^APR\s*0*(\d+)$/i.exec(c.trim())?.[1]).filter(Boolean).map(Number);
  return `APR ${String(Math.max(0, ...numeros) + 1).padStart(2, "0")}`;
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
  arquivado_em: string | null;
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
  pdf: "PDF",
};

export const rotuloSecao: Record<SecaoItem, string> = {
  verificacao: "Verificação",
  medida_preventiva: "Medida preventiva",
};
