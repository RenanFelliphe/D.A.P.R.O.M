/** O período da ausência como a pessoa o digita (a web e o app): o início e, no lugar de um dos dois, os dias corridos ou a data de retorno. */

import { somarDias } from "./ausencia";

export interface PeriodoDigitado {
  /** `AAAA-MM-DD` (ou vazio enquanto a pessoa não escolheu). */
  inicio: string;
  modo: "dias" | "retorno";
  dias: string;
  /** `AAAA-MM-DD` (ou vazio). */
  retorno: string;
}

export const periodoVazio = (inicio = ""): PeriodoDigitado => ({ inicio, modo: "dias", dias: "", retorno: "" });

/** O retorno que o período digitado dá (o primeiro dia de volta), ou `null` enquanto está incompleto ou inválido. */
export function retornoDoPeriodo(p: PeriodoDigitado): string | null {
  if (!p.inicio) return null;
  if (p.modo === "retorno") return p.retorno && p.retorno > p.inicio ? p.retorno : null;
  const dias = Number(p.dias);
  return Number.isInteger(dias) && dias >= 1 && dias <= 365 ? somarDias(p.inicio, dias) : null;
}

/** O pedaço do corpo de `POST /ausencias` que o período digitado dá: `{ inicio, dias }` ou `{ inicio, retorno }`. */
export const periodoParaApi = (p: PeriodoDigitado) => (p.modo === "dias" ? { inicio: p.inicio, dias: Number(p.dias) } : { inicio: p.inicio, retorno: p.retorno });
