import "server-only";

import { api, apiOuNulo } from "@/lib/api";
import type { ServicoDaOs } from "@/lib/catalogo";
import type { PerguntaDoChecklist } from "@/lib/checklist-inspecao";
import type { Posicao } from "@/lib/geolocalizacao";
import type { DevolucaoDaOs } from "@/lib/os-app";
import type { DocumentoDeEvidencia, OsStatus, Paginacao, ResponsavelDaOs } from "@/lib/tipos";

export interface LocalDaOs {
  id: string;
  codigo: string;
  endereco: string | null;
  plus_code: string | null;
  cliente: string | null;
  critico: boolean;
}

/** O que a folha em papel diz da execução de uma OS digitalizada (início e fim reais escritos à mão, pessoas e descrição). */
export interface ExecucaoEmPapel {
  inicio_real: string | null;
  fim_real: string | null;
  numero_pessoas: number | null;
  texto_manuscrito: string | null;
  /** Quem preencheu: a IA de visão, a pessoa na conferência, ou ninguém. */
  fonte: "ia" | "manual" | "nenhuma";
  folhas: number;
  registrada_em: string;
  registrada_por_nome: string;
}

/** A OS no detalhe: a linha inteira do banco mais o local, a equipe e os campos derivados. */
export interface OsDetalhe {
  id: string;
  numero_ordem: string | null;
  numero_nota: string | null;
  tipo: "preventiva" | "corretiva";
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
  data_ordem: string | null;
  criado_por_sap: string | null;
  status_sap: string | null;
  solicitante: string | null;
  os_origem_id: string | null;
  origem: "sap" | "planilha" | "pdf" | "apoio" | "digitalizacao";
  pdf_path: string | null;
  pdf_em: string | null;
  ciencia_por: string | null;
  ciencia_em: string | null;
  exportada_sap_em: string | null;
  cancelada_em: string | null;
  cancelada_por: string | null;
  justificativa_cancelamento: string | null;
  responsavel_id: string | null;
  reservada_por: string | null;
  reservada_em: string | null;
  devolvida_em: string | null;
  devolvida_por: string | null;
  justificativa_devolucao: string | null;
  devolucao_exportada_em: string | null;
  local_instalacao: LocalDaOs;
  equipe: { id: string; nome: string; centro_trabalho: string; supervisor_id: string | null };
  ciencia_por_nome: string | null;
  /** Atribuição individual: a pessoa para quem a OS está reservada; `null` = a OS é da equipe toda. */
  responsavel: (ResponsavelDaOs & { reservada_por_nome: string | null; reservada_em: string | null }) | null;
  /** O apêndice da OS devolvida ao SAP; `null` se a OS não foi devolvida. */
  devolucao: DevolucaoDaOs | null;
  pdf_pronto: boolean;
  /** A execução em papel das OS que a Digitalização encerrou (não há `execucao`); `null` nas demais. */
  em_papel: ExecucaoEmPapel | null;
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
  /** Nulos enquanto o participante não assinou a APR na própria conta (e em quem recusou). */
  assinatura_path: string | null;
  assinada_em: string | null;
  /** A assinatura foi dada no aparelho do responsável (contingência offline). */
  assinatura_presencial: boolean;
  /** Direito de recusa: o participante saiu da APR e deixou o motivo; `null` = não recusou. */
  recusou_em: string | null;
  recusa_motivo: string | null;
}

/** Onde a pessoa estava num momento da execução; `null` no campo = "sem localização". */
export type LocalizacaoDaOs = Posicao;

export interface PausaDaExecucao {
  id: string;
  inicio: string;
  fim: string | null;
  /** `almoco`, `aguardando`, `descanso`, `clima`, `enfermidade`, `lesao` ou `outro` (`null` nas pausas antigas, sem motivo). */
  motivo: string | null;
  /** O que ou quem (em `aguardando`) ou a descrição (em `outro`). */
  complemento: string | null;
  localizacao: LocalizacaoDaOs | null;
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
  pausas: PausaDaExecucao[];
  /** Só na suspensa: por que o serviço não continua hoje (`enfermidade`, `lesao`, `fim_expediente`, `clima`, `falta_material` ou `outro`), com o complemento. */
  suspensao_motivo: string | null;
  suspensao_complemento: string | null;
  /** Quando o responsável assinou o encerramento; nulo na `encerrada` = a OS está `encerrando`. */
  encerramento_assinado_em: string | null;
  /** Onde a pessoa estava ao iniciar e ao terminar (encerrar, suspender ou interromper). */
  localizacao_inicio: LocalizacaoDaOs | null;
  localizacao_fim: LocalizacaoDaOs | null;
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
  /** O checklist de inspeção do plano da OS preventiva, na ordem; vazio quando a OS não tem. O Campo de treino não o traz. */
  checklist_inspecao?: PerguntaDoChecklist[];
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
