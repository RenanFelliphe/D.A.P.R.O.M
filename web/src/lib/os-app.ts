/** Tipos das respostas de OS usadas nas telas do técnico (lista, detalhe e APR) e pequenas regras sobre elas. Chaves em snake_case, como a `api` devolve. */

import type { BadgeTone } from "@/components/ui/Badge";
import { MIN_PARTICIPANTES } from "./apr";
import type { ServicoDaOs } from "./catalogo";
import type { DocumentoDeEvidencia, OsStatus, Paginacao, ResponsavelDaOs } from "./tipos";

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
  /** Reservada a uma pessoa da equipe; ausente ou `null` = a OS é da equipe toda. */
  responsavel?: ResponsavelDaOs | null;
}

export interface ListaDeOs extends Paginacao {
  os: OsResumo[];
  contagem_por_status: Record<OsStatus, number>;
}

/**
 * Participante de uma APR. Cada um assina na própria conta, depois da validação: `assinatura_path` e `assinada_em` são nulos
 * enquanto não assinou. `recusou_em` (com `recusa_motivo`) é o direito de recusa: a pessoa saiu da APR e não conta mais.
 */
export interface ParticipanteDaApr {
  usuario_id: string;
  nome: string;
  matricula: string;
  funcao: "responsavel" | "executor";
  assinatura_path: string | null;
  assinada_em: string | null;
  /** A assinatura foi dada no aparelho do responsável (contingência offline), não na conta da pessoa. */
  assinatura_presencial?: boolean;
  recusou_em?: string | null;
  recusa_motivo?: string | null;
}

export interface ItemReprovadoDaApr {
  item_id: string;
  texto: string;
  resposta: "sim" | "nao" | "na";
  observacao: string | null;
  fotos: { id: string; foto_path: string; capturada_em: string; latitude: number | null; longitude: number | null }[];
  /** PDFs anexados ao item; ausente na API antiga. */
  documentos?: DocumentoDeEvidencia[];
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
  respostas: { item_id: string; texto: string; reprovado: boolean }[];
  itens_reprovados: ItemReprovadoDaApr[];
}

export interface ExecucaoDaOs {
  id: string;
  apr_id: string;
  executor: { id: string; nome: string; matricula: string };
  inicio: string;
  fim: string | null;
  resultado: "encerrada" | "interrompida" | "suspensa" | "cancelada" | null;
  /**
   * `encerrada` com isto nulo: o tempo parou ("Encerrar OS"), mas o responsável ainda não preencheu e assinou o encerramento
   * (a OS está `encerrando`).
   */
  encerramento_assinado_em?: string | null;
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
  /** A pessoa para quem a OS está reservada, com quem a reservou; `null` = a OS é da equipe toda. */
  responsavel?: (ResponsavelDaOs & { reservada_por_nome: string | null; reservada_em: string | null }) | null;
  /** O apêndice da OS devolvida ao SAP: quem devolveu, quando e a justificativa. */
  devolucao?: DevolucaoDaOs | null;
}

export interface DevolucaoDaOs {
  em: string;
  por_nome: string | null;
  justificativa: string | null;
  exportada_em: string | null;
}

export interface DetalheDaOs {
  os: OsDetalhada;
  /** O serviço do catálogo da atividade da OS, com a lista de materiais; nulo quando a OS não tem atividade. */
  servico: ServicoDaOs | null;
  aprs: AprDaOs[];
  execucoes: ExecucaoDaOs[];
}

/** Selo de cada status da OS. */
export const statusDaOs: Record<OsStatus, { tone: BadgeTone; rotulo: string }> = {
  liberada: { tone: "lib", rotulo: "Liberada" },
  pendente: { tone: "blq", rotulo: "Pendente" },
  em_execucao: { tone: "exe", rotulo: "Em execução" },
  encerrando: { tone: "al", rotulo: "Encerrando" },
  aguardando_supervisor: { tone: "al", rotulo: "Aguardando o supervisor" },
  encerrada: { tone: "enc", rotulo: "Encerrada" },
  cancelada: { tone: "neu", rotulo: "Cancelada" },
  devolvida: { tone: "neu", rotulo: "Devolvida ao SAP" },
};

/** Ordem dos grupos da lista. */
export const ordemDosStatus: OsStatus[] = ["liberada", "pendente", "em_execucao", "encerrando", "aguardando_supervisor", "encerrada", "cancelada", "devolvida"];

/** A OS está reservada a outra pessoa da equipe: o usuário a vê, mas só o responsável inicia a APR e a execução. */
export const reservadaParaOutro = (o: { responsavel?: { id: string } | null }, usuarioId: string) => Boolean(o.responsavel) && o.responsavel!.id !== usuarioId;

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

/** A execução do técnico cujo tempo parou ("Encerrar OS") e que espera o preenchimento e a assinatura do responsável; `null` se não houver. */
export const execucaoEncerrando = (execucoes: ExecucaoDaOs[]) => [...execucoes].reverse().find((e) => e.resultado === "encerrada" && !e.encerramento_assinado_em) ?? null;

/**
 * Como estão as assinaturas de uma APR aprovada (as mesmas regras da `api`): quem continua na APR (`ativos`), quem recusou, quem
 * ainda falta assinar, e se ela ainda serve. `inviavel` = o responsável recusou ou restaram menos de 2 participantes: é preciso
 * uma APR nova. `pronta` = dá para iniciar a execução (todos os que ficaram assinaram).
 */
export function situacaoDaApr<P extends { funcao: string; assinada_em?: string | null; recusou_em?: string | null }>(apr: { participantes: P[] }) {
  const ativos = apr.participantes.filter((p) => !p.recusou_em);
  const recusaram = apr.participantes.filter((p) => p.recusou_em);
  const faltam = ativos.filter((p) => !p.assinada_em);
  const responsavelRecusou = recusaram.some((p) => p.funcao === "responsavel");
  const semParticipantes = ativos.length < MIN_PARTICIPANTES;
  const inviavel = responsavelRecusou || semParticipantes;
  const motivoInviavel = responsavelRecusou
    ? "O responsável recusou a APR, então ela não vale mais."
    : semParticipantes
      ? `Restaram menos de ${MIN_PARTICIPANTES} participantes na APR, e ninguém executa o serviço sozinho.`
      : null;
  return { ativos, recusaram, faltam, responsavelRecusou, semParticipantes, inviavel, motivoInviavel, pronta: !inviavel && faltam.length === 0 };
}

/**
 * A APR aprovada de hoje que ainda não amparou uma execução (as canceladas liberam a APR de novo), mesmo a que deixou de
 * servir (recusa): é a que a tela de assinaturas mostra. Com `participante`, só a APR de que ele participou. `null` se não houver.
 */
export function aprDeHoje(aprs: AprDaOs[], execucoes: ExecucaoDaOs[], participante?: string) {
  const usadas = new Set(execucoes.filter((e) => e.resultado !== "cancelada").map((e) => e.apr_id));
  return (
    [...aprs]
      .reverse()
      .find((a) => a.resultado === "aprovada" && ehHoje(a.concluida_em) && !usadas.has(a.id) && (participante === undefined || a.participantes.some((p) => p.usuario_id === participante))) ?? null
  );
}

/**
 * A APR aprovada de hoje que ainda serve para executar (nem o responsável nem tantos participantes recusaram): é a que,
 * depois de assinada por todos, permite "Iniciar execução" sem refazer o checklist. Com `participante`, só a APR de que ele
 * participa e da qual não saiu (só quem ficou nela assina e inicia a execução). `null` se não houver.
 */
export function aprAprovadaDisponivel(aprs: AprDaOs[], execucoes: ExecucaoDaOs[], participante?: string) {
  const usadas = new Set(execucoes.filter((e) => e.resultado !== "cancelada").map((e) => e.apr_id));
  return (
    [...aprs]
      .reverse()
      .find(
        (a) =>
          a.resultado === "aprovada" &&
          ehHoje(a.concluida_em) &&
          !usadas.has(a.id) &&
          !situacaoDaApr(a).inviavel &&
          (participante === undefined || a.participantes.some((p) => p.usuario_id === participante && !p.recusou_em)),
      ) ?? null
  );
}

/** O número da OS como se mostra ("OS 4031187"); OS de apoio ainda não tem número. */
export const rotuloDaOs = (o: { numero_ordem: string | null }) => (o.numero_ordem ? `OS ${o.numero_ordem}` : "OS sem número");
