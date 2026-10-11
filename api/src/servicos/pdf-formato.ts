/** Formatação de datas, horas e durações no fuso do negócio, para o PDF e o e-mail. */
export const FUSO = "America/Sao_Paulo";

const formatoData = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });
const formatoHora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** `dd/mm/aaaa` em horário de Brasília. */
export const dataBr = (d: Date) => formatoData.format(d);
/** `hh:mm` em horário de Brasília. */
export const horaBr = (d: Date) => formatoHora.format(d);
export const dataHoraBr = (d: Date) => `${dataBr(d)} ${horaBr(d)}`;

/** `AAAA-MM-DD` (coluna `date`) → `dd/mm/aaaa`. */
export function dataIsoBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** Milissegundos → `2h 05min` (ou `35min`). */
export function duracao(ms: number): string {
  const total = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(total / 60);
  const min = total % 60;
  return h > 0 ? `${h}h ${String(min).padStart(2, "0")}min` : `${min}min`;
}
