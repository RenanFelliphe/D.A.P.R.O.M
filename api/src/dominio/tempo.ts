const FUSO = "America/Sao_Paulo";

const formatadorDia = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" });

/** O "dia" do negócio (`AAAA-MM-DD` em America/Sao_Paulo) de um instante guardado em UTC. */
export const diaDe = (instante: Date): string => formatadorDia.format(instante);

export const mesmoDia = (a: Date, b: Date) => diaDe(a) === diaDe(b);

const DIA_MS = 86_400_000;

/** Soma `n` dias corridos a um dia `AAAA-MM-DD` (negativo volta). Só calendário: sem fuso, sem horário de verão. */
export const somarDias = (dia: string, n: number): string => new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);

/** Quantos dias corridos há de `de` até `ate` (`AAAA-MM-DD`); negativo quando `ate` vem antes. */
export const diasEntre = (de: string, ate: string): number => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / DIA_MS);

/** O instante em que um dia do negócio começa: 0h em São Paulo (UTC-3, sem horário de verão desde 2019). */
export const inicioDoDia = (dia: string): Date => new Date(`${dia}T00:00:00-03:00`);

/** `AAAA-MM-DD` → `DD/MM/AAAA`, como a pessoa lê. */
export const dataBr = (dia: string): string => `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;
