import type { Paginacao } from "@/lib/tipos";
import type { OsDoQuadro } from "./quadro";

/** `GET /indicadores`: preventivas do mês por situação. */
export interface IndicadoresDoMes {
  encerradas: number;
  atrasadas_justificadas: number;
  atrasadas_sem_justificativa: number;
  por_equipe: {
    equipe_id: string;
    equipe_nome: string;
    encerradas: number;
    atrasadas_justificadas: number;
    atrasadas_sem_justificativa: number;
  }[];
}

/** Tempo médio de um grupo de execuções; as médias são `null` quando não há execução encerrada no mês. */
export interface MedidaDeTempo {
  execucoes: number;
  tempo_liquido_medio_min: number | null;
  pausa_media_min: number | null;
  /** Pausa total sobre o tempo total, de 0 a 1. */
  proporcao_pausa: number | null;
}

/** `GET /indicadores/tempo`. */
export interface IndicadoresDeTempo extends MedidaDeTempo {
  por_equipe: (MedidaDeTempo & { equipe_id: string; equipe_nome: string })[];
  por_usuario: (MedidaDeTempo & { usuario_id: string; usuario_nome: string })[];
}

/** Pré-visualização da exportação: as encerradas ainda não exportadas (`total` é o total real). */
export interface PreviaDaExportacao extends Paginacao {
  os: OsDoQuadro[];
}

/** Barras e cartões: as três situações que a `api` conta, com as cores do protótipo. */
export const situacoes = [
  { chave: "encerradas", nome: "Encerradas", cor: "#0CA30C" },
  { chave: "atrasadas_justificadas", nome: "Atrasadas com justificativa", cor: "#C98500" },
  { chave: "atrasadas_sem_justificativa", nome: "Atrasadas sem justificativa", cor: "#D03B3B" },
] as const;

export type ChaveSituacao = (typeof situacoes)[number]["chave"];

export const totalDaEquipe = (e: Record<ChaveSituacao, number>) => e.encerradas + e.atrasadas_justificadas + e.atrasadas_sem_justificativa;

/** Máximo do eixo do gráfico: o maior total, arredondado para cima a um múltiplo de 3 (as linhas de grade ficam em terços). */
export function maximoDoEixo(totais: number[]): number {
  const maior = Math.max(0, ...totais);
  return Math.max(3, Math.ceil(maior / 3) * 3);
}
