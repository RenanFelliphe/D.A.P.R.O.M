import { hora } from "@shared/api/formatar";
import type { EstadoDaSincronizacao } from "./estado";

/**
 * O que o app diz, em toda tela de campo, sobre a conexão e o que espera para subir: "Sem conexão — N registros pendentes" sem sinal,
 * "N registros pendentes" enquanto o sinal volta e a fila sobe, o erro que a pessoa precisa resolver, e "Sincronizado hh:mm" no
 * indicador do cabeçalho. Só para quem tem fila (o técnico com equipe): para os demais, nada.
 */

export type TomDaFaixa = "al" | "blq" | "info";

export interface FaixaDaSincronizacao {
  tom: TomDaFaixa;
  texto: string;
}

export const textoDosRegistros = (n: number): string => (n === 1 ? "1 registro pendente" : `${n} registros pendentes`);

export function faixaDaSincronizacao(e: Pick<EstadoDaSincronizacao, "aplicavel" | "pendentes" | "sincronizando" | "erro" | "semSinal">, online: boolean): FaixaDaSincronizacao | null {
  if (!e.aplicavel) return null;
  if (!online || e.semSinal) return { tom: "al", texto: e.pendentes > 0 ? `Sem conexão — ${textoDosRegistros(e.pendentes)}` : "Sem conexão — o que você fizer fica guardado neste aparelho" };
  if (e.erro && e.pendentes > 0) return { tom: "blq", texto: `${textoDosRegistros(e.pendentes)} — ${e.erro}` };
  if (e.erro) return { tom: "blq", texto: e.erro };
  if (e.pendentes > 0) return { tom: "info", texto: e.sincronizando ? `Enviando ${textoDosRegistros(e.pendentes)}…` : textoDosRegistros(e.pendentes) };
  return null;
}

/** O texto do indicador do cabeçalho: "Sem conexão", "Sincronizado hh:mm" ou só "Online" (ainda sem sincronização nesta abertura). */
export function rotuloDoIndicador(online: boolean, sincronizadoEm: string | null, aplicavel: boolean): string {
  if (!online) return "Sem conexão";
  return aplicavel && sincronizadoEm ? `Sincronizado ${hora(sincronizadoEm)}` : "Online";
}

/** A última vez que o app enviou a fila sozinho, com o app fechado: "Enviado com o app fechado às 14:32 (3 registros)". */
export const textoDoSegundoPlano = (em: string, enviados: number): string =>
  enviados > 0 ? `Enviado com o app fechado às ${hora(em)} (${enviados === 1 ? "1 registro" : `${enviados} registros`})` : `Tentativa com o app fechado às ${hora(em)}, sem conseguir enviar`;
