/** Formatos de `GET /indicadores/os`, `/equipes`, `/meus` e `/os/mapa-calor` (o de APR fica em `data/modelos.ts`). */

import type { Agrupamento } from "@/components/web/importacao/tipos";
import type { CelulaDoMapa } from "@/components/web/os/MapaDeCalor";
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

/**
 * Tempo das execuções encerradas iniciadas no período: o total é `fim − início`, a pausa é a soma das pausas registradas e o
 * líquido é a diferença.
 */
export interface MedidaDeTempo {
  execucoes: number;
  tempo_total_medio_min: number | null;
  tempo_liquido_medio_min: number | null;
  pausa_media_min: number | null;
  /** Pausa total sobre o tempo total, de 0 a 1. */
  proporcao_pausa: number | null;
  /** Execuções com ao menos uma pausa. */
  execucoes_com_pausa: number;
  /** Pausas registradas por execução, em média. */
  pausas_por_execucao: number | null;
}

/** Motivo escolhido no app ao pausar (os sete da lista); `sem_motivo` é a pausa antiga, registrada sem escolher. */
export type MotivoDaPausa = "almoco" | "aguardando" | "descanso" | "clima" | "enfermidade" | "lesao" | "outro" | "sem_motivo";

/** Tempo em pausa por motivo, só os que aparecem no período. */
export interface PausaPorMotivo {
  motivo: MotivoDaPausa;
  pausas: number;
  minutos: number;
}

/** Uma das OS com mais tempo em pausa no período (a execução que a encerrou). */
export interface OsComMaisPausa {
  os_id: string;
  numero_ordem: string | null;
  titulo: string;
  /** `null` para quem não acompanha a equipe (técnico) e no "Meus resultados". */
  executor: string | null;
  fim: string;
  tempo_total_min: number;
  tempo_liquido_min: number;
  pausa_min: number;
  pausas: number;
  proporcao_pausa: number | null;
}

/** O tempo do período com a pausa por motivo e as OS com mais pausa. */
export interface TempoDetalhado extends MedidaDeTempo {
  por_motivo: PausaPorMotivo[];
  os_com_mais_pausa: OsComMaisPausa[];
}

export interface SituacaoDasPreventivas {
  encerradas: number;
  atrasadas_justificadas: number;
  atrasadas_sem_justificativa: number;
}

/** O que pede ação agora. Fora `execucoes_esquecidas`, é de gestão: `null` para quem não acompanha a equipe (técnico). */
export interface Pendencias {
  a_exportar: number | null;
  sem_ciencia: number | null;
  execucoes_esquecidas: number;
}

/** `GET /os/mapa-calor`: onde as OS do período foram executadas, pelo GPS da execução, em células de cerca de 1 km. */
export interface MapaDeCalorDoPeriodo {
  periodo: string;
  de: string;
  ate: string;
  os_no_periodo: number;
  com_localizacao: number;
  sem_localizacao: number;
  /** Da mais movimentada para a menos. */
  celulas: CelulaDoMapa[];
}

export interface DashboardOs extends PeriodoResolvido {
  carteira: Carteira;
  programadas: { total: number; corretivas: number; preventivas: number; canceladas: number };
  encerradas: Encerradas;
  serie: { inicio: string; fim: string; corretivas: number; preventivas: number }[];
  preventivas: SituacaoDasPreventivas;
  tempo: TempoDetalhado;
  interrupcoes: {
    total: number;
    /** `executor` é `null` para quem não acompanha a equipe (técnico). */
    recentes: { os_id: string; numero_ordem: string | null; titulo: string; motivo: string | null; fim: string; executor: string | null }[];
  };
  reprogramacoes: number;
  locais: { id: string; codigo: string; critico: boolean; encerradas: number }[];
  pendencias: Pendencias;
}

interface MedidasDeTrabalho extends MedidaDeTempo {
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
  /** O tempo do conjunto, com a pausa por motivo (a lista das OS com mais pausa fica no dashboard de OS). */
  tempo: MedidaDeTempo & { por_motivo: PausaPorMotivo[] };
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
  tempo: TempoDetalhado;
  aprs: { total: number; bloqueadas: number; anterior: number; bloqueadas_anterior: number };
  interrupcoes: { total: number; recentes: { os_id: string; numero_ordem: string | null; titulo: string; motivo: string | null; fim: string; executor: string | null }[] };
  locais: { id: string; codigo: string; critico: boolean; encerradas: number }[];
}
