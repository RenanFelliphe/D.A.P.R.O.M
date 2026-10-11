/**
 * Regras do checklist da APR: respostas, evidências, itens reprovados e alertas.
 * Funções puras sobre o estado — a navegação entre telas fica em state/checklist.tsx.
 */

import type { Bloqueio } from "@/data/bloqueio";
import { perguntasApr03, respostaDemo, type Resposta } from "@/data/checklist";

export type ModoChecklist = "pergunta" | "revisao";

export interface EstadoChecklist {
  /** Índice (base 0) da pergunta aberta. */
  indice: number;
  respostas: Partial<Record<number, Resposta>>;
  /** Observação do item reprovado (evidência em texto). */
  observacoes: Partial<Record<number, string>>;
  /** Item reprovado com foto anexada. */
  fotos: Partial<Record<number, boolean>>;
  modo: ModoChecklist;
  /** A APR já foi validada ao menos uma vez. */
  concluido: boolean;
}

export const totalPerguntas = perguntasApr03.length;

export const estadoInicialChecklist: EstadoChecklist = {
  indice: 0,
  respostas: {},
  observacoes: {},
  fotos: {},
  modo: "pergunta",
  concluido: false,
};

export function rotuloResposta(resposta: Resposta | undefined): string {
  return resposta === "sim" ? "Sim" : "Não";
}

/** Eliminatória respondida com a resposta que bloqueia a OS. */
export function estaReprovada(estado: EstadoChecklist, i: number): boolean {
  const pergunta = perguntasApr03[i];
  return pergunta.tipo === "elim" && estado.respostas[i] === pergunta.critica;
}

/** Pergunta de alerta respondida com a resposta que gera alerta (não bloqueia). */
export function geraAlerta(estado: EstadoChecklist, i: number): boolean {
  const pergunta = perguntasApr03[i];
  return pergunta.tipo === "alerta" && pergunta.critica !== null && estado.respostas[i] === pergunta.critica;
}

export function totalRespondidas(estado: EstadoChecklist): number {
  return perguntasApr03.reduce((n, _, i) => (estado.respostas[i] !== undefined ? n + 1 : n), 0);
}

export function itensReprovados(estado: EstadoChecklist): number[] {
  return perguntasApr03.flatMap((_, i) => (estaReprovada(estado, i) ? [i] : []));
}

export function totalAlertas(estado: EstadoChecklist): number {
  return perguntasApr03.reduce((n, _, i) => (geraAlerta(estado, i) ? n + 1 : n), 0);
}

/** Item reprovado sem a evidência exigida: observação sempre; foto, salvo quando a evidência é só texto. */
export function faltaEvidencia(estado: EstadoChecklist, i: number): boolean {
  if (!estaReprovada(estado, i)) return false;
  if (!(estado.observacoes[i] ?? "").trim()) return true;
  return perguntasApr03[i].evidencia !== "texto" && !estado.fotos[i];
}

/** "Próxima" só libera depois de responder e, se reprovada, de ter a evidência. */
export function podeAvancar(estado: EstadoChecklist): boolean {
  return estado.respostas[estado.indice] !== undefined && !faltaEvidencia(estado, estado.indice);
}

/** Completa com a resposta de demonstração as perguntas anteriores a `ate` que ainda não têm resposta. */
export function preencherAte(estado: EstadoChecklist, ate: number): EstadoChecklist {
  const respostas = { ...estado.respostas };
  for (let i = 0; i < ate; i++) {
    respostas[i] ??= respostaDemo(perguntasApr03[i]);
  }
  return { ...estado, respostas, indice: Math.min(ate, totalPerguntas - 1), modo: "pergunta" };
}

/** Monta a tela de bloqueio a partir dos itens eliminatórios reprovados na validação. */
export function bloqueioPorReprovacao(estado: EstadoChecklist): Bloqueio {
  const reprovados = itensReprovados(estado);
  const varios = reprovados.length > 1;
  return {
    variante: "apr",
    cabecalho: "APR · ERP Serra",
    subtitulo: "OS 4031187 · APR 03 v4 · agora",
    titulo: "Atividade impedida",
    descricao:
      `${reprovados.length} ${varios ? "itens eliminatórios tiveram resposta bloqueante." : "item eliminatório teve resposta bloqueante."} ` +
      "A OS fica pendente e a execução não pode começar. Uma nova APR, de qualquer pessoa da equipe, pode liberá-la.",
    itens: reprovados.map((i) => ({
      label: `Pergunta ${i + 1} · Eliminatório`,
      pergunta: perguntasApr03[i].texto,
      resposta: `Resposta: ${rotuloResposta(estado.respostas[i])}`,
      comFoto: Boolean(estado.fotos[i]),
      observacao: estado.observacoes[i] ?? "",
    })),
  };
}
