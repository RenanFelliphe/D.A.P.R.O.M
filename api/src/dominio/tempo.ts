const FUSO = "America/Sao_Paulo";

const formatadorDia = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" });

/** O "dia" do negócio (`AAAA-MM-DD` em America/Sao_Paulo) de um instante guardado em UTC. */
export const diaDe = (instante: Date): string => formatadorDia.format(instante);

export const mesmoDia = (a: Date, b: Date) => diaDe(a) === diaDe(b);
