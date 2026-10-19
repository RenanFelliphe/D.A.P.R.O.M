/** Datas e durações em pt-BR. Instantes vêm da `api` em UTC; o "dia" e a hora exibidos são de America/Sao_Paulo. */

const FUSO = "America/Sao_Paulo";

const fmtData = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });
const fmtDiaMes = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit" });
const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hour12: false });

const paraDate = (v: string | Date) => (v instanceof Date ? v : new Date(v));

/** `dd/mm/aaaa` de um instante ISO. */
export const data = (v: string | Date | null | undefined) => (v ? fmtData.format(paraDate(v)) : "—");

/** `dd/mm` de um instante ISO. */
export const diaMes = (v: string | Date | null | undefined) => (v ? fmtDiaMes.format(paraDate(v)) : "—");

/** `hh:mm` de um instante ISO. */
export const hora = (v: string | Date | null | undefined) => (v ? fmtHora.format(paraDate(v)) : "—");

/** `dd/mm/aaaa hh:mm`. */
export const dataHora = (v: string | Date | null | undefined) => (v ? `${data(v)} ${hora(v)}` : "—");

/** `AAAA-MM-DD` (coluna `date` da `api`) → `dd/mm/aaaa`, sem passar por fuso. */
export function dataDoDia(v: string | null | undefined) {
  if (!v) return "—";
  const [a, m, d] = v.split("-");
  return `${d}/${m}/${a}`;
}

/** `AAAA-MM-DD` de hoje em America/Sao_Paulo. */
export const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date());

/** Minutos → `1h 05min` / `45min`. */
export function duracao(minutos: number | null | undefined) {
  if (minutos === null || minutos === undefined) return "—";
  const total = Math.round(minutos);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`;
}
