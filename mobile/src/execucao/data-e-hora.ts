/**
 * A data e a hora que a pessoa digita ("19/10/2026" e "07:30") como um instante, e o contrário. O aparelho não tem seletor de data
 * nativo sem uma biblioteca a mais, e digitar dois campos curtos é rápido o bastante para o caso raro da execução esquecida de outro
 * dia. Vale a hora do aparelho (o fuso dele), como o `datetime-local` da web.
 */

const dois = (n: number) => String(n).padStart(2, "0");

export const paraCampoDeData = (d: Date) => `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}`;
export const paraCampoDeHora = (d: Date) => `${dois(d.getHours())}:${dois(d.getMinutes())}`;

/** `dd/mm/aaaa` e `hh:mm` como um `Date`; `null` se faltar algo, não for número ou a data não existir (31/02). */
export function dataEHoraComoInstante(dia: string, hora: string): Date | null {
  const d = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dia.trim());
  const h = /^(\d{1,2}):(\d{2})$/.exec(hora.trim());
  if (!d || !h) return null;
  const [diaN, mesN, anoN, horaN, minutoN] = [Number(d[1]), Number(d[2]), Number(d[3]), Number(h[1]), Number(h[2])];
  const instante = new Date(anoN, mesN - 1, diaN, horaN, minutoN, 0, 0);
  const confere = instante.getFullYear() === anoN && instante.getMonth() === mesN - 1 && instante.getDate() === diaN && instante.getHours() === horaN && instante.getMinutes() === minutoN;
  return confere ? instante : null;
}

/**
 * O que está errado no fim informado da execução esquecida, em uma frase; `null` se está certo. O fim tem de existir, ser depois do
 * início da execução e não estar no futuro (um minuto de folga para o relógio do aparelho).
 */
export function faltaNoFim(dia: string, hora: string, inicio: Date, agora: Date = new Date()): string | null {
  const fim = dataEHoraComoInstante(dia, hora);
  if (!fim) return "Informe a data (dd/mm/aaaa) e a hora (hh:mm) reais em que você parou.";
  if (fim < inicio) return "O fim precisa ser depois do início da execução.";
  if (fim.getTime() > agora.getTime() + 60_000) return "O fim não pode estar no futuro.";
  return null;
}
