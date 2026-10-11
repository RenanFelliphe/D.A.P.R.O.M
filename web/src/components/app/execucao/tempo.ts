/** Tipos e contas da tela de execução: o que a `api` devolve em `GET /os/{id}` e o tempo calculado a partir disso. */

export interface PausaDaApi {
  id: string;
  inicio: string;
  fim: string | null;
  motivo: "almoco" | "descanso" | "outro" | null;
}

export interface ParticipanteDaApr {
  usuario_id: string;
  nome: string;
  matricula: string;
  funcao: string;
  /** Cópia da assinatura que a pessoa tinha no perfil ao concluir a APR. */
  assinatura_path: string | null;
}

export interface ExecucaoDaApi {
  id: string;
  apr_id: string;
  executor: { id: string; nome: string; matricula: string };
  numero_pessoas: number;
  inicio: string;
  fim: string | null;
  resultado: "encerrada" | "interrompida" | "suspensa" | "cancelada" | null;
  pausas: PausaDaApi[];
}

export interface AprDaApi {
  id: string;
  resultado: "aprovada" | "bloqueada";
  concluida_em: string;
  participantes: ParticipanteDaApr[];
}

/** Execução em andamento do usuário, em qualquer OS (`GET /me/execucoes-abertas`). */
export interface ExecucaoAberta {
  id: string;
  os_id: string;
  apr_id: string;
  inicio: string;
  numero_ordem: string | null;
  titulo: string;
}

const FUSO = "America/Sao_Paulo";
const fmtDia = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO });

/** `AAAA-MM-DD` do instante em America/Sao_Paulo: o "dia" das regras de execução. */
export const diaDe = (instante: string | Date) => fmtDia.format(typeof instante === "string" ? new Date(instante) : instante);

export interface TempoCalculado {
  totalMs: number;
  pausaMs: number;
  liquidoMs: number;
  /** Pausa aberta agora. */
  emPausa: boolean;
}

/** Total, pausas e líquido de uma execução em andamento no instante `agora` (pausa aberta vale até `agora`). */
export function calcularTempo(inicio: string, pausas: PausaDaApi[], agora: number): TempoCalculado {
  const i = new Date(inicio).getTime();
  let pausaMs = 0;
  for (const p of pausas) {
    const de = Math.max(new Date(p.inicio).getTime(), i);
    const ate = Math.min(p.fim ? new Date(p.fim).getTime() : agora, agora);
    if (ate > de) pausaMs += ate - de;
  }
  const totalMs = Math.max(0, agora - i);
  return { totalMs, pausaMs, liquidoMs: Math.max(0, totalMs - pausaMs), emPausa: pausas.some((p) => !p.fim) };
}

const dois = (n: number) => String(n).padStart(2, "0");

/** `1:07:09` (h:mm:ss) para o cronômetro. */
export function cronometro(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 3600)}:${dois(Math.floor((s % 3600) / 60))}:${dois(s % 60)}`;
}

/** `1h07` / `0h12`: duração curta para os totais. */
export function horasMinutos(ms: number) {
  const m = Math.floor(ms / 60_000);
  return `${Math.floor(m / 60)}h${dois(m % 60)}`;
}

/** Valor de `<input type="datetime-local">` (hora do aparelho) para um instante. */
export function paraCampoDataHora(instante: Date) {
  return `${instante.getFullYear()}-${dois(instante.getMonth() + 1)}-${dois(instante.getDate())}T${dois(instante.getHours())}:${dois(instante.getMinutes())}`;
}
