/**
 * O que o `POST /sync/pull` entrega (a cópia da equipe) e o que a fila guarda, com as chaves em `snake_case`, como a `api` as manda.
 * É o que se grava no banco local e o que a projeção das ações pendentes lê.
 */

import type { PerguntaDoChecklist } from "@shared/api/checklist-inspecao";
import type { ServicoDaOs } from "@shared/api/catalogo";
import type { ItemDoModelo, RiscoDoModelo } from "@shared/api/apr";
import type { OsStatus } from "@shared/api/tipos";

export interface OsDaCopia {
  id: string;
  numero_ordem: string | null;
  numero_nota: string | null;
  tipo: "corretiva" | "preventiva";
  tipo_atividade: string | null;
  codigo_atividade: string | null;
  titulo: string;
  descricao: string | null;
  equipamento: string | null;
  local_instalacao_id: string;
  equipe_id: string;
  plano_manutencao: string | null;
  item_manutencao: string | null;
  prioridade: string | null;
  data_inicio_prog: string;
  data_fim_prog: string | null;
  status: OsStatus;
  status_sap: string | null;
  pdf_path: string | null;
  ciencia_em: string | null;
  justificativa_cancelamento: string | null;
  responsavel_id: string | null;
  reservada_por: string | null;
  reservada_em: string | null;
  devolvida_em: string | null;
  devolvida_por: string | null;
  justificativa_devolucao: string | null;
  devolucao_exportada_em: string | null;
  /** O modelo que a leitura da OS recomendou e o que cada modelo achou nela. */
  escolha_do_modelo: { recomendado: string | null; fonte?: "ia" | "palavras"; motivo?: string | null; encontradas: { codigo: string; palavras: string[] }[] };
  checklist_inspecao: PerguntaDoChecklist[];
}

export interface ParticipanteDaCopia {
  usuario_id: string;
  funcao: "responsavel" | "executor";
  assinada_em: string | null;
  assinatura_presencial: boolean;
  recusou_em: string | null;
  recusa_motivo?: string | null;
}

export interface AprDaCopia {
  id: string;
  os_id: string;
  modelo_apr_id: string;
  preenchida_por: string;
  resultado: "aprovada" | "bloqueada";
  concluida_em: string;
  participantes: ParticipanteDaCopia[];
  /** Só nas APRs que nasceram sem sinal neste aparelho: o servidor ainda não as validou. Nunca vem da `api`. */
  aguardando_validacao?: boolean;
  /** As respostas da APR feita sem sinal (para mostrar quantos itens foram respondidos). Nunca vem da `api`. */
  itens_respondidos?: number;
}

export interface PausaDaCopia {
  id: string;
  execucao_id: string;
  inicio: string;
  fim: string | null;
  motivo: string | null;
  complemento: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface ExecucaoDaCopia {
  id: string;
  os_id: string;
  apr_id: string;
  executor_id: string;
  numero_pessoas: number;
  inicio: string;
  fim: string | null;
  resultado: "encerrada" | "interrompida" | "suspensa" | "cancelada" | null;
  motivo: string | null;
  suspensao_motivo: string | null;
  suspensao_complemento: string | null;
  encerramento_assinado_em: string | null;
  /** Quem encerrou, interrompeu ou suspendeu (execução compartilhada); ausente nas execuções anteriores: vale o responsável. */
  finalizada_por?: string | null;
  inicio_latitude: number | null;
  inicio_longitude: number | null;
  fim_latitude: number | null;
  fim_longitude: number | null;
  pausas: PausaDaCopia[];
}

export interface LocalDaCopia {
  id: string;
  codigo: string;
  endereco: string | null;
  plus_code: string | null;
  cliente: string | null;
  critico: boolean;
}

export interface AtividadeDaCopia {
  codigo: string;
  descricao: string;
  materiais: ServicoDaOs["materiais"];
}

export interface ModeloDaCopia {
  id: string;
  codigo: string;
  versao: number;
  titulo: string;
  data_documento: string | null;
  publicado_em: string | null;
  arquivado_em: string | null;
  orientacao: { descricao: string; exemplos: string[] };
  riscos: RiscoDoModelo[];
  itens: ItemDoModelo[];
}

export interface UsuarioDaCopia {
  id: string;
  nome: string;
  matricula: string;
  cargo: string | null;
  perfil: string;
  equipe_id: string | null;
  assinatura_path: string | null;
  ausencia?: unknown;
}

export interface EquipeDaCopia {
  id: string;
  nome: string;
  centro_trabalho: string;
  supervisor_id: string | null;
}

/** A resposta de `POST /sync/pull`. */
export interface SnapshotDaApi {
  os: OsDaCopia[];
  aprs: AprDaCopia[];
  execucoes: ExecucaoDaCopia[];
  locais: LocalDaCopia[];
  atividades: AtividadeDaCopia[];
  modelos_apr: ModeloDaCopia[];
  equipe?: EquipeDaCopia | null;
  usuarios: UsuarioDaCopia[];
  cursor: string;
}

/** Um evento de campo guardado na fila, esperando para subir. */
export interface EventoDaFila {
  seq: number;
  id: string;
  usuarioId: string;
  tipo: string;
  osId: string | null;
  payload: Record<string, unknown>;
  ocorridoEm: string;
  criadoEm: string;
  tentativas: number;
  ultimoErro: string | null;
}

/** Um arquivo (foto ou PDF) guardado na fila, esperando para subir antes do evento que o cita. */
export interface ArquivoDaFila {
  seq: number;
  id: string;
  usuarioId: string;
  tipo: "foto" | "pdf";
  uri: string;
  nome: string;
  tipoMime: string;
  criadoEm: string;
  tentativas: number;
  ultimoErro: string | null;
}

/** Um evento que a `api` recusou de vez (ou que esperou demais): fica guardado para o técnico mostrar ao supervisor. */
export interface EventoRecusado {
  id: string;
  usuarioId: string;
  tipo: string;
  osId: string | null;
  payload: Record<string, unknown>;
  ocorridoEm: string;
  codigo: string;
  mensagem: string;
  recusadoEm: string;
}
