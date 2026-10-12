/** Tipos das respostas de OS usadas nas telas do técnico (lista, detalhe e APR) e pequenas regras sobre elas. Chaves em snake_case, como a `api` devolve. */

import type { BadgeTone } from "@/components/ui/Badge";
import type { OsStatus, Paginacao } from "./tipos";

export interface LocalDaOs {
  id: string;
  codigo: string;
  endereco?: string | null;
  plus_code?: string | null;
  cliente?: string | null;
  critico: boolean;
}

/** Uma OS da lista (`GET /os`). */
export interface OsResumo {
  id: string;
  numero_ordem: string | null;
  tipo: "corretiva" | "preventiva";
  titulo: string;
  status: OsStatus;
  equipe_id: string;
  equipe_nome: string;
  local_instalacao: { id: string; codigo: string; critico: boolean };
  equipamento: string | null;
  prioridade: string | null;
  data_inicio_prog: string | null;
  data_fim_prog: string | null;
  pdf_pronto: boolean;
  atrasada: boolean;
}

export interface ListaDeOs extends Paginacao {
  os: OsResumo[];
  contagem_por_status: Record<OsStatus, number>;
}

export interface ParticipanteDaApr {
  usuario_id: string;
  nome: string;
  matricula: string;
  funcao: "responsavel" | "executor";
  assinatura_path: string;
  assinada_em: string;
}

export interface ItemReprovadoDaApr {
  item_id: string;
  texto: string;
  resposta: "sim" | "nao" | "na";
  observacao: string | null;
  tipo: "eliminatorio" | "alerta";
  evidencia: "foto" | "texto";
  fotos: { id: string; foto_path: string; capturada_em: string; latitude: number | null; longitude: number | null }[];
}

/** Uma APR do histórico da OS (`aprs[]` do `GET /os/{id}`). */
export interface AprDaOs {
  id: string;
  os_id: string;
  resultado: "aprovada" | "bloqueada";
  observacao_geral: string | null;
  concluida_em: string;
  preenchida_por: { id: string; nome: string };
  modelo: { codigo: string; versao: number; titulo: string };
  participantes: ParticipanteDaApr[];
  respostas: { item_id: string; texto: string; reprovado: boolean; alerta_marcado: boolean }[];
  itens_reprovados: ItemReprovadoDaApr[];
}

export interface ExecucaoDaOs {
  id: string;
  apr_id: string;
  executor: { id: string; nome: string; matricula: string };
  inicio: string;
  fim: string | null;
  resultado: "encerrada" | "interrompida" | "suspensa" | "cancelada" | null;
}

export interface OsDetalhada {
  id: string;
  numero_ordem: string | null;
  numero_nota: string | null;
  tipo: "corretiva" | "preventiva";
  tipo_atividade: string | null;
  codigo_atividade: string | null;
  titulo: string;
  descricao: string | null;
  equipamento: string | null;
  plano_manutencao: string | null;
  item_manutencao: string | null;
  prioridade: string | null;
  data_inicio_prog: string | null;
  data_fim_prog: string | null;
  status: OsStatus;
  status_sap: string | null;
  equipe_id: string;
  local_instalacao: LocalDaOs;
  equipe: { id: string; nome: string; centro_trabalho: string; supervisor_id: string | null };
  justificativa_cancelamento: string | null;
  pdf_pronto: boolean;
  /** Modelo de APR da atividade da OS; `null` quando a OS não tem atividade mapeada. */
  modelo_apr_codigo: string | null;
}

export interface DetalheDaOs {
  os: OsDetalhada;
  aprs: AprDaOs[];
  execucoes: ExecucaoDaOs[];
}

/** Selo de cada status da OS. */
export const statusDaOs: Record<OsStatus, { tone: BadgeTone; rotulo: string }> = {
  liberada: { tone: "lib", rotulo: "Liberada" },
  pendente: { tone: "blq", rotulo: "Pendente" },
  em_execucao: { tone: "exe", rotulo: "Em execução" },
  encerrada: { tone: "enc", rotulo: "Encerrada" },
  cancelada: { tone: "neu", rotulo: "Cancelada" },
};

/** Ordem dos grupos da lista. */
export const ordemDosStatus: OsStatus[] = ["liberada", "pendente", "em_execucao", "encerrada", "cancelada"];

export const rotuloDoTipo = { preventiva: "Preventiva", corretiva: "Corretiva" } as const;

const FUSO = "America/Sao_Paulo";
const fmtDia = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO });

/** `AAAA-MM-DD` do dia (em America/Sao_Paulo) em que o instante cai. */
export const diaDoInstante = (instante: string | Date) => fmtDia.format(typeof instante === "string" ? new Date(instante) : instante);

/** O instante cai no dia de hoje em America/Sao_Paulo. */
export const ehHoje = (instante: string) => diaDoInstante(instante) === diaDoInstante(new Date());

/** "ter, 13 out" para o cabeçalho. */
export function diaPorExtenso(quando: Date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, weekday: "short", day: "numeric", month: "short" })
    .format(quando)
    .replace(/\./g, "")
    .replace(/ de /g, " ");
}

/** A execução aberta da OS (sem resultado), se houver. */
export const execucaoAberta = (execucoes: ExecucaoDaOs[]) => execucoes.find((e) => e.resultado === null) ?? null;

/**
 * APR aprovada de hoje que ainda não amparou uma execução (as canceladas liberam a APR de novo): é a que permite
 * "Iniciar execução" sem refazer o checklist. `null` se não houver.
 */
export function aprAprovadaDisponivel(aprs: AprDaOs[], execucoes: ExecucaoDaOs[]) {
  const usadas = new Set(execucoes.filter((e) => e.resultado !== "cancelada").map((e) => e.apr_id));
  return [...aprs].reverse().find((a) => a.resultado === "aprovada" && ehHoje(a.concluida_em) && !usadas.has(a.id)) ?? null;
}

/** O número da OS como se mostra ("OS 4031187"); OS de apoio ainda não tem número. */
export const rotuloDaOs = (o: { numero_ordem: string | null }) => (o.numero_ordem ? `OS ${o.numero_ordem}` : "OS sem número");
