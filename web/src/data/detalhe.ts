import "server-only";

import { api, apiOuNulo } from "@/lib/api";
import type { MaterialDaApr, ServicoDaOs } from "@/lib/catalogo";
import type { DocumentoDeEvidencia, OsStatus, Paginacao } from "@/lib/tipos";

export interface LocalDaOs {
  id: string;
  codigo: string;
  endereco: string | null;
  plus_code: string | null;
  cliente: string | null;
  critico: boolean;
}

/** A OS no detalhe: a linha inteira do banco mais o local, a equipe e os campos derivados. */
export interface OsDetalhe {
  id: string;
  numero_ordem: string | null;
  numero_nota: string | null;
  tipo: "preventiva" | "corretiva";
  tipo_atividade: string | null;
  codigo_atividade: string | null;
  /** Modelo de APR que a atividade da OS usa; nulo quando a atividade não está ligada a um modelo (o técnico escolhe). */
  modelo_apr_codigo: string | null;
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
  data_ordem: string | null;
  criado_por_sap: string | null;
  status_sap: string | null;
  solicitante: string | null;
  os_origem_id: string | null;
  origem: "sap" | "planilha" | "pdf" | "apoio";
  pdf_path: string | null;
  pdf_em: string | null;
  ciencia_por: string | null;
  ciencia_em: string | null;
  exportada_sap_em: string | null;
  cancelada_em: string | null;
  cancelada_por: string | null;
  justificativa_cancelamento: string | null;
  local_instalacao: LocalDaOs;
  equipe: { id: string; nome: string; centro_trabalho: string; supervisor_id: string | null };
  ciencia_por_nome: string | null;
  pdf_pronto: boolean;
  execucao_aberta_ha_horas: number | null;
  atrasada: boolean;
  /** Eventos cujo horário do aparelho está à frente do servidor (relógio do aparelho adiantado). */
  eventos_com_relogio_suspeito: number;
}

export interface ParticipanteApr {
  usuario_id: string;
  nome: string;
  matricula: string;
  funcao: "responsavel" | "executor";
  assinatura_path: string | null;
  assinada_em: string | null;
}

export interface FotoDeEvidencia {
  id: string;
  foto_path: string;
  capturada_em: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * `tipo`, `evidencia`, `resposta_bloqueante` e `alerta_marcado` dizem o que é eliminatório e o que é alerta: a `api` só
 * os entrega ao admin, e para os demais perfis eles não vêm.
 */
export interface RespostaApr {
  item_id: string;
  secao: string;
  ordem: number;
  texto: string;
  tipo?: "eliminatorio" | "alerta" | "informativo" | string;
  evidencia?: string | null;
  resposta_bloqueante?: string | null;
  risco_id: string | null;
  resposta: "sim" | "nao" | "na";
  observacao: string | null;
  respondida_em: string;
  reprovado: boolean;
  alerta_marcado?: boolean;
}

export interface AprDaOs {
  id: string;
  os_id: string;
  resultado: "aprovada" | "bloqueada";
  observacao_geral: string | null;
  concluida_em: string;
  preenchida_por: { id: string; nome: string };
  modelo: { codigo: string; versao: number; titulo: string };
  participantes: ParticipanteApr[];
  riscos: { id: string; classificacao: string; nome: string }[];
  respostas: RespostaApr[];
  /** A conferência dos materiais do serviço: o que o técnico levou e a foto do item obrigatório. */
  materiais: MaterialDaApr[];
  itens_reprovados: {
    item_id: string;
    texto: string;
    resposta: string;
    observacao: string | null;
    tipo?: string;
    evidencia?: string | null;
    fotos: FotoDeEvidencia[];
    /** PDFs anexados ao item (laudo, certificado, atestado). */
    documentos: DocumentoDeEvidencia[];
  }[];
}

export interface ExecucaoDaOs {
  id: string;
  apr_id: string;
  executor: { id: string; nome: string; matricula: string };
  numero_pessoas: number;
  inicio: string;
  fim: string | null;
  resultado: "encerrada" | "interrompida" | "suspensa" | "cancelada" | null;
  descricao_atividade: string | null;
  motivo: string | null;
  dados_inspecao: unknown;
  tempo_liquido_min: number | null;
  pausa_min: number | null;
  pausas: { id: string; inicio: string; fim: string | null; motivo: string | null }[];
  assinaturas: { usuario_id: string; nome: string; matricula: string; assinatura_path: string | null; assinada_em: string }[];
  fotos: FotoDeEvidencia[];
  /** PDFs anexados ao encerramento ou à interrupção. */
  documentos: DocumentoDeEvidencia[];
}

export interface AlertaDaOs {
  id: string;
  tipo: string;
  detalhe: string;
  destinatario_id: string;
  destinatario_nome: string;
  email_enviado_em: string | null;
  lido_em: string | null;
  criado_em: string;
}

export interface ReprogramacaoDaOs {
  id: string;
  usuario_id: string;
  usuario_nome: string;
  data_anterior: string;
  data_nova: string;
  equipe_anterior_id: string | null;
  equipe_anterior_nome: string | null;
  equipe_nova_id: string | null;
  equipe_nova_nome: string | null;
  justificativa: string;
  criada_em: string;
}

export interface EventoDaLinhaDoTempo {
  em: string;
  tipo: string;
  descricao: string;
}

export interface DetalheDaOs {
  os: OsDetalhe;
  /** O serviço do catálogo (a atividade da OS) com os materiais, ferramentas e EPIs; nulo quando a OS não tem atividade. */
  servico: ServicoDaOs | null;
  aprs: AprDaOs[];
  execucoes: ExecucaoDaOs[];
  alertas: AlertaDaOs[];
  reprogramacoes: ReprogramacaoDaOs[];
  linha_do_tempo: EventoDaLinhaDoTempo[];
}

/** `GET /os/{id}`; `null` quando a OS não existe ou é de outra equipe (a `api` responde 404). */
export function carregarDetalhe(id: string): Promise<DetalheDaOs | null> {
  return apiOuNulo<DetalheDaOs>(`/os/${encodeURIComponent(id)}`);
}

export interface ExecucaoDoHistorico {
  id: string;
  os: { id: string; numero_ordem: string | null; titulo: string; equipamento: string | null };
  executor: { id: string; nome: string };
  inicio: string;
  fim: string | null;
  descricao_atividade: string | null;
  tempo_liquido_min: number | null;
}

export interface RespostaHistorico extends Paginacao {
  execucoes: ExecucaoDoHistorico[];
}

export const TAMANHO_DO_HISTORICO = 10;

/** Execuções encerradas do local (e, se informado, do equipamento), da mais recente para a mais antiga. */
export function carregarHistorico(localId: string, equipamento: string | null, pagina: number): Promise<RespostaHistorico> {
  return api<RespostaHistorico>("/historico", {
    consulta: { local_instalacao_id: localId, equipamento, pagina, tamanho: TAMANHO_DO_HISTORICO },
  });
}
