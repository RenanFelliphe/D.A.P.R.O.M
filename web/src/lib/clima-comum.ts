/**
 * O que a previsão do tempo tem de puro, sem navegador: os tipos e as regras do `shared` e os pequenos auxiliares de apresentação.
 * Serve às telas de servidor (o relatório e o detalhe da OS) e às de cliente (o quadro e a APR, em `lib/clima`).
 */

import type { ClimaRegistrado, NivelDeRisco } from "../../../shared/api/clima";

export * from "../../../shared/api/clima";

/** O rótulo curto do local: "Sua localização" quando veio do aparelho, senão o nome da cidade padrão. */
export const rotuloDoLocal = (c: Pick<ClimaRegistrado, "local">) => (c.local.origem === "aparelho" ? "Sua localização" : c.local.nome);

export const horaDaPrevisao = (hora: string) => `${Number(hora.slice(11, 13))}h`;

/** Escolhe até `max` horas, de dois em dois quando a janela é longa (o expediente tem 12), sem perder a última. */
export function horasParaMostrar<T>(horas: T[], max = 6): T[] {
  if (horas.length <= max) return horas;
  const passo = Math.ceil(horas.length / max);
  const escolhidas = horas.filter((_, i) => i % passo === 0);
  return escolhidas.length > max ? escolhidas.slice(0, max) : escolhidas;
}

/** A classe de cor de cada nível (`.clima-sem_risco`, `.clima-atencao`, `.clima-extremo`). */
export const classeDoNivel = (n: NivelDeRisco | null) => `clima-${n ?? "indisponivel"}`;
