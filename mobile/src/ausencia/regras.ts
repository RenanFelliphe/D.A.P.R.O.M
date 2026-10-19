/**
 * As contas da ausência no app (sem React Native, para testar): a data digitada como `dd/mm/aaaa`, o que falta no pedido e nas ações, o
 * modo da pessoa (pedir ou registrar) e os botões de cada ausência. A `api` confere tudo de novo; aqui só se evita ir até ela à toa.
 */

import { somarDias, type Ausencia } from "@shared/api/ausencia";
import { periodoParaApi, retornoDoPeriodo, type PeriodoDigitado } from "@shared/api/ausencia-periodo";
import type { RespostaMe } from "@shared/api/tipos";

export const LIMITE_DO_MOTIVO = 500;

/** `dd/mm/aaaa` como `AAAA-MM-DD`; `null` se faltar algo, não for número ou a data não existir (31/02). */
export function diaDoCampo(texto: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const [dia, mes, ano] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return d.toISOString().slice(0, 10);
}

/** `AAAA-MM-DD` como `dd/mm/aaaa`, o que a pessoa digita. */
export function campoDoDia(dia: string): string {
  const [ano, mes, d] = dia.split("-");
  return `${d}/${mes}/${ano}`;
}

/** O que a pessoa digitou do período, ainda como texto de campo. */
export interface PeriodoEmTexto {
  inicio: string;
  modo: "dias" | "retorno";
  dias: string;
  retorno: string;
}

/** O período em texto como `PeriodoDigitado` (dias ISO); campo que não é data vira vazio. */
export const periodoDoTexto = (p: PeriodoEmTexto): PeriodoDigitado => ({ inicio: diaDoCampo(p.inicio) ?? "", modo: p.modo, dias: p.dias.trim(), retorno: diaDoCampo(p.retorno) ?? "" });

/** O que falta no primeiro dia, em uma frase; `null` se está certo. Não pode ser anterior a hoje (`hoje` é `AAAA-MM-DD`). */
export function faltaNoInicio(texto: string, hoje: string): string | null {
  const inicio = diaDoCampo(texto);
  if (!inicio) return "Informe o primeiro dia da ausência (dd/mm/aaaa).";
  return inicio < hoje ? "O primeiro dia não pode ser anterior a hoje." : null;
}

/** Os dias corridos da ausência: inteiros, de 1 a 365. */
export function faltaNosDias(texto: string): string | null {
  const dias = Number(texto.trim());
  return texto.trim() !== "" && Number.isInteger(dias) && dias >= 1 && dias <= 365 ? null : "Informe os dias corridos de ausência (de 1 a 365).";
}

/** A data de retorno digitada: existir e ser depois do primeiro dia (quando este já está certo). */
export function faltaNoRetornoDigitado(texto: string, inicioTexto: string): string | null {
  const retorno = diaDoCampo(texto);
  if (!retorno) return "Informe a data de retorno (dd/mm/aaaa).";
  const inicio = diaDoCampo(inicioTexto);
  return inicio && retorno <= inicio ? "O retorno precisa ser depois do primeiro dia da ausência." : null;
}

/** O que falta no período, em uma frase; `null` se está certo. */
export function faltaNoPeriodo(p: PeriodoEmTexto, hoje: string): string | null {
  return faltaNoInicio(p.inicio, hoje) ?? (p.modo === "dias" ? faltaNosDias(p.dias) : faltaNoRetornoDigitado(p.retorno, p.inicio)) ?? (retornoDoPeriodo(periodoDoTexto(p)) ? null : "Confira o período da ausência.");
}

/** O corpo de `POST /ausencias`: o motivo e o período (`inicio` mais os `dias` ou o `retorno`); o supervisor que registra a própria também assina. */
export function corpoDoPedido(motivo: string, periodo: PeriodoEmTexto, registrar: boolean) {
  const digitado = periodoDoTexto(periodo);
  return { motivo: motivo.trim(), ...periodoParaApi(digitado), ...(registrar ? { assinar: true as const } : {}) };
}

/** O que falta no pedido (motivo e período); `null` se está certo. */
export function faltaNoPedido(motivo: string, periodo: PeriodoEmTexto, hoje: string): string | null {
  if (motivo.trim() === "") return "Diga o motivo da ausência.";
  if (motivo.length > LIMITE_DO_MOTIVO) return `O motivo passa de ${LIMITE_DO_MOTIVO} caracteres.`;
  return faltaNoPeriodo(periodo, hoje);
}

/** O fim antecipado: a data em que a pessoa quer voltar, de hoje até o último dia da ausência (a véspera do retorno previsto). */
export function faltaNoFimAntecipado(texto: string, ausencia: Pick<Ausencia, "retorno">, hoje: string): string | null {
  const dia = diaDoCampo(texto);
  if (!dia) return "Informe o dia em que quer voltar (dd/mm/aaaa).";
  if (dia < hoje) return "O dia de volta não pode ser anterior a hoje.";
  if (dia > somarDias(ausencia.retorno, -1)) return "O dia de volta precisa ser antes do retorno previsto.";
  return null;
}

/** A nova data de retorno (a ausência registrada pelo próprio supervisor): depois de hoje ou do início, e diferente da de agora. */
export function faltaNoNovoRetorno(texto: string, ausencia: Pick<Ausencia, "inicio" | "retorno">, hoje: string): string | null {
  const dia = diaDoCampo(texto);
  if (!dia) return "Informe a nova data de retorno (dd/mm/aaaa).";
  if (dia < somarDias(hoje > ausencia.inicio ? hoje : ausencia.inicio, 1)) return "O retorno precisa ser depois de hoje e do primeiro dia da ausência.";
  if (dia === ausencia.retorno) return "Essa já é a data de retorno.";
  return null;
}

/** O modo de pedir da pessoa e o que a impede de pedir (equipe sem supervisor, sem equipe). */
export interface ModoDaAusencia {
  /** `registrar`: o supervisor titular registra a própria ausência (vale na hora, assinada). `pedir`: o técnico pede e o supervisor responde. */
  modo: "pedir" | "registrar";
  titular: boolean;
  /** Por que o botão de pedir está desabilitado, ou `null` quando pode pedir. */
  motivoSemPedido: string | null;
}

/**
 * Só o supervisor titular registra a própria ausência; o representante no comando pede, como qualquer técnico. O técnico pede a quem
 * responde pela equipe (o supervisor ou, na equipe sem supervisor, o representante): sem equipe, sem ninguém ou quando quem responde é
 * a própria pessoa, não há a quem pedir.
 */
export function modoDaAusencia(eu: Pick<RespostaMe, "usuario" | "equipe">): ModoDaAusencia {
  const u = eu.usuario;
  const equipe = eu.equipe;
  const titular = (u.equipes_supervisionadas ?? []).some((e) => !(u.equipes_representadas ?? []).some((r) => r.id === e.id));
  if (titular) return { modo: "registrar", titular, motivoSemPedido: null };
  const semSupervisor = equipe?.representacao?.motivo === "sem_supervisor";
  const motivoSemPedido = !equipe
    ? "Você não está em uma equipe: não há supervisor para responder ao pedido."
    : semSupervisor && equipe.representante_id === u.id
      ? "A sua equipe está sem supervisor e é você quem responde por ela: não há quem responda ao seu pedido de ausência. Fale com o administrador."
      : !equipe.supervisor_id && !equipe.representante_id
        ? "A sua equipe está sem supervisor e ninguém responde por ela: fale com o administrador."
        : null;
  return { modo: "pedir", titular, motivoSemPedido };
}

export type AcaoDaAusencia = "cancelar" | "confirmar" | "recusar-ajuste" | "pedir-fim" | "confirmar-retorno" | "prorrogar" | "encerrar";

export interface BotaoDaAusencia {
  acao: AcaoDaAusencia;
  rotulo: string;
  variante: "primario" | "secundario" | "texto";
}

/**
 * O que a pessoa pode fazer com a PRÓPRIA ausência (a tela só lista as dela). A pedida: cancelar o pedido; a aprovada, confirmar,
 * recusar as datas ou cancelar; a em curso, pedir o fim antecipado; a vencida, confirmar o retorno. A que o supervisor titular
 * registrou para si ainda pode ter o retorno alterado e ser encerrada. As ações de supervisor sobre a ausência dos outros ficam na web.
 */
export function botoesDaAusencia(a: Pick<Ausencia, "origem" | "situacao" | "fim_pedido_em">, titular: boolean): BotaoDaAusencia[] {
  const botoes: BotaoDaAusencia[] = [];
  const propria = a.origem === "propria";
  if (!propria) {
    if (a.situacao === "pedida") botoes.push({ acao: "cancelar", rotulo: "Cancelar o pedido", variante: "secundario" });
    if (a.situacao === "aguardando_confirmacao") {
      botoes.push({ acao: "confirmar", rotulo: "Confirmar a ausência", variante: "primario" });
      botoes.push({ acao: "recusar-ajuste", rotulo: "Recusar as datas", variante: "secundario" });
      botoes.push({ acao: "cancelar", rotulo: "Cancelar o pedido", variante: "texto" });
    }
    if (a.situacao === "em_curso" && !a.fim_pedido_em) botoes.push({ acao: "pedir-fim", rotulo: "Pedir fim antecipado", variante: "secundario" });
    if (a.situacao === "vencida") botoes.push({ acao: "confirmar-retorno", rotulo: "Confirmar o retorno", variante: "primario" });
  } else if (titular && (a.situacao === "agendada" || a.situacao === "em_curso" || a.situacao === "vencida")) {
    botoes.push({ acao: "prorrogar", rotulo: "Alterar o retorno", variante: "secundario" });
    botoes.push({ acao: "encerrar", rotulo: a.situacao === "agendada" ? "Encerrar a ausência" : "Encerrar a minha ausência", variante: "secundario" });
  }
  return botoes;
}
