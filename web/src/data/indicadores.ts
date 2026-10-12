import type { Paginacao } from "@/lib/tipos";
import type { OsDoQuadro } from "./quadro";

/** Uma barra do gráfico "Situação das preventivas por equipe" (dashboard de equipes e usuários). */
export interface SituacaoDaEquipe {
  equipe_id: string;
  equipe_nome: string;
  encerradas: number;
  atrasadas_justificadas: number;
  atrasadas_sem_justificativa: number;
}

/** Pré-visualização da exportação: as encerradas ainda não exportadas (`total` é o total real). */
export interface PreviaDaExportacao extends Paginacao {
  os: OsDoQuadro[];
}

/**
 * As três situações das preventivas que a `api` conta, empilhadas nas barras por equipe. O atraso é o ponto (âmbar e
 * vermelho, de estado); a encerrada é contexto (cinza). Verde e âmbar empilhados ficariam em ΔE 3 na protanopia; com o
 * cinza, todo par passa de 10 no script de paleta. Cada uma vai com ícone na legenda.
 */
export const situacoes = [
  { chave: "encerradas", nome: "Encerradas", cor: "#8A949F", icone: "check" },
  { chave: "atrasadas_justificadas", nome: "Atrasadas com justificativa", cor: "#C98500", icone: "alert" },
  { chave: "atrasadas_sem_justificativa", nome: "Atrasadas sem justificativa", cor: "#D03B3B", icone: "octagon" },
] as const;

export type ChaveSituacao = (typeof situacoes)[number]["chave"];

export const totalDaEquipe = (e: Record<ChaveSituacao, number>) => e.encerradas + e.atrasadas_justificadas + e.atrasadas_sem_justificativa;

/** Máximo do eixo do gráfico: o maior total, arredondado para cima a um múltiplo de 3 (as linhas de grade ficam em terços). */
export function maximoDoEixo(totais: number[]): number {
  const maior = Math.max(0, ...totais);
  return Math.max(3, Math.ceil(maior / 3) * 3);
}
