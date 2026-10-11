import { diaDe, type AprDaApi, type ExecucaoAberta, type ExecucaoDaApi, type ParticipanteDaApr } from "./tempo";

/** O que a tela de execução mostra, decidido a partir dos dados da `api` (tabela de estados da especificação, seção "Execução"). */
export type Situacao =
  /** Execução esquecida de outro dia (em qualquer OS): só resta suspendê-la, informando a hora real do fim. */
  | { tipo: "esquecida"; execucao: ExecucaoAberta }
  /** Execução do usuário em andamento nesta OS. */
  | { tipo: "em_andamento"; execucao: ExecucaoDaApi; participantes: ParticipanteDaApr[] }
  /** Outra pessoa está executando esta OS. */
  | { tipo: "outra_pessoa"; executor: string }
  /** A OS já foi encerrada ou cancelada. */
  | { tipo: "fechada" }
  /** Há APR aprovada do dia, desta OS e ainda não usada: dá para iniciar. */
  | { tipo: "iniciar"; apr: Pick<AprDaApi, "id" | "concluida_em" | "participantes"> }
  | { tipo: "sem_apr" };

interface Entrada {
  osStatus: string;
  usuarioId: string;
  execucoes: ExecucaoDaApi[];
  aprs: AprDaApi[];
  abertas: ExecucaoAberta[];
  /** Instante de referência (o "hoje" das regras). */
  agora: Date;
}

export function definirSituacao({ osStatus, usuarioId, execucoes, aprs, abertas, agora }: Entrada): Situacao {
  const hoje = diaDe(agora);

  const esquecida = abertas.find((e) => diaDe(e.inicio) !== hoje);
  if (esquecida) return { tipo: "esquecida", execucao: esquecida };

  const minha = execucoes.find((e) => e.resultado === null && e.executor.id === usuarioId);
  if (minha) {
    const apr = aprs.find((a) => a.id === minha.apr_id);
    return { tipo: "em_andamento", execucao: minha, participantes: apr?.participantes ?? [] };
  }

  const deOutro = execucoes.find((e) => e.resultado === null);
  if (deOutro) return { tipo: "outra_pessoa", executor: deOutro.executor.nome };

  if (osStatus === "encerrada" || osStatus === "cancelada") return { tipo: "fechada" };

  const usadas = new Set(execucoes.filter((e) => e.resultado !== "cancelada").map((e) => e.apr_id));
  const apr = aprs
    .filter((a) => a.resultado === "aprovada" && diaDe(a.concluida_em) === hoje && !usadas.has(a.id) && a.participantes.some((p) => p.usuario_id === usuarioId))
    .sort((a, b) => b.concluida_em.localeCompare(a.concluida_em))[0];
  return apr ? { tipo: "iniciar", apr } : { tipo: "sem_apr" };
}
