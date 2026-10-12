/** Formatos de `GET /indicadores/geral`, `/os`, `/equipes` e `/meus` (o de APR fica em `data/modelos.ts`). */

import type { Agrupamento } from "@/components/web/importacao/tipos";
import type { Perfil } from "@/lib/tipos";

interface PeriodoResolvido {
  periodo: string;
  agrupamento: Agrupamento;
  de: string;
  ate: string;
}

/** Foto da carteira de OS agora (não depende do período). */
export interface Carteira {
  liberadas: number;
  pendentes: number;
  em_execucao: number;
  /** Liberadas ou pendentes depois da data de referência. */
  atrasadas: number;
  /** Abertas em local crítico. */
  criticas: number;
  apoio_abertas: number;
}

/** OS encerradas no período (pelo fim da Execução), por tipo, e o total do período anterior. */
export interface Encerradas {
  total: number;
  anterior: number;
  corretivas: number;
  preventivas: number;
}

export interface SituacaoDasPreventivas {
  encerradas: number;
  atrasadas_justificadas: number;
  atrasadas_sem_justificativa: number;
}

export interface DashboardGeral extends PeriodoResolvido {
  carteira: Carteira;
  encerradas: Encerradas;
  preventivas: SituacaoDasPreventivas;
  aprs: { total: number; bloqueadas: number; anterior: number; bloqueadas_anterior: number };
  tempo: { execucoes: number; tempo_liquido_medio_min: number | null };
  interrupcoes: number;
  /** O que pede ação agora. Fora `execucoes_esquecidas`, é de gestão: `null` para quem não acompanha a equipe (técnico). */
  pendencias: { a_exportar: number | null; sem_ciencia: number | null; execucoes_esquecidas: number; atividades_sem_modelo: number | null };
}

export interface DashboardOs extends PeriodoResolvido {
  carteira: Carteira;
  programadas: { total: number; corretivas: number; preventivas: number; canceladas: number };
  encerradas: Encerradas;
  serie: { inicio: string; fim: string; corretivas: number; preventivas: number }[];
  preventivas: SituacaoDasPreventivas;
  tempo: { execucoes: number; tempo_liquido_medio_min: number | null; pausa_media_min: number | null; proporcao_pausa: number | null };
  interrupcoes: {
    total: number;
    /** `executor` é `null` para quem não acompanha a equipe (técnico). */
    recentes: { os_id: string; numero_ordem: string | null; titulo: string; motivo: string | null; fim: string; executor: string | null }[];
  };
  reprogramacoes: number;
  locais: { id: string; codigo: string; critico: boolean; encerradas: number }[];
}

interface MedidasDeTrabalho {
  execucoes: number;
  tempo_liquido_medio_min: number | null;
  pausa_media_min: number | null;
  /** Pausa total sobre o tempo total, de 0 a 1. */
  proporcao_pausa: number | null;
  aprs: number;
  aprs_bloqueadas: number;
  interrompidas: number;
}

export interface EquipeDoDashboard extends MedidasDeTrabalho {
  id: string;
  nome: string;
  supervisor_nome: string | null;
  /** Técnicos ativos. */
  tecnicos: number;
  preventivas: SituacaoDasPreventivas;
}

export interface TecnicoDoDashboard extends MedidasDeTrabalho {
  id: string;
  nome: string;
  matricula: string;
  ativo: boolean;
  equipe_nome: string | null;
}

export interface DashboardEquipes extends PeriodoResolvido {
  totais: { equipes: number; tecnicos_ativos: number; /** `null` para quem não acompanha a equipe (técnico). */ tecnicos_com_execucao: number | null; execucoes: number; tempo_liquido_medio_min: number | null };
  equipes: EquipeDoDashboard[];
  /** Vazia para quem não acompanha a equipe (técnico): nada por pessoa. */
  tecnicos: TecnicoDoDashboard[];
  /** Só para o admin. */
  cadastro: {
    ativos_por_perfil: Record<Perfil, number>;
    tecnicos_sem_assinatura: number;
    senha_provisoria: number;
    sem_equipe: number;
    inativos: number;
    equipes_sem_supervisor: number;
  } | null;
}

/** "Meus resultados" (`GET /indicadores/meus`): só o que a própria pessoa fez. */
export interface DashboardMeus extends PeriodoResolvido {
  encerradas: Encerradas;
  serie: { inicio: string; fim: string; corretivas: number; preventivas: number }[];
  tempo: { execucoes: number; tempo_liquido_medio_min: number | null; pausa_media_min: number | null; proporcao_pausa: number | null };
  aprs: { total: number; bloqueadas: number; anterior: number; bloqueadas_anterior: number };
  interrupcoes: { total: number; recentes: { os_id: string; numero_ordem: string | null; titulo: string; motivo: string | null; fim: string; executor: string | null }[] };
  locais: { id: string; codigo: string; critico: boolean; encerradas: number }[];
}
