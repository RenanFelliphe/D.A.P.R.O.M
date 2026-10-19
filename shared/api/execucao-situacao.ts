import { situacaoDaApr } from "./os-app";
import { diaDe, type AprDaApi, type ExecucaoAberta, type ExecucaoDaApi, type ParticipanteDaApr } from "./execucao-tempo";

/** O que a tela de execução mostra, decidido a partir dos dados da `api` (tabela de estados da especificação, seção "Execução"). */
export type Situacao =
  /** Execução esquecida de outro dia (em qualquer OS): só resta suspendê-la, informando a hora real do fim. */
  | { tipo: "esquecida"; execucao: ExecucaoAberta }
  /** Execução do usuário em andamento nesta OS. */
  | { tipo: "em_andamento"; execucao: ExecucaoDaApi; participantes: ParticipanteDaApr[] }
  /**
   * O usuário clicou em "Encerrar OS" (o tempo parou), mas ainda não preencheu e assinou o encerramento: a OS está `encerrando`.
   * Voltar à tela leva de novo ao formulário.
   */
  | { tipo: "encerrando"; execucao: ExecucaoDaApi }
  /** Outra pessoa está executando esta OS (ou preenchendo o encerramento dela). */
  | { tipo: "outra_pessoa"; executor: string; encerrando?: boolean }
  /**
   * A execução acabou e o responsável assinou: a OS está `aguardando_supervisor` (falta o supervisor ler o relatório e assinar)
   * ou já `encerrada` (concluída).
   */
  | { tipo: "terminada"; status: "aguardando_supervisor" | "encerrada" }
  /** A OS foi cancelada. */
  | { tipo: "fechada" }
  /** O supervisor devolveu a OS ao SAP. */
  | { tipo: "devolvida" }
  /** O supervisor reservou a OS a outra pessoa da equipe: só ela inicia a execução. */
  | { tipo: "reservada"; responsavel: string }
  /** Há APR aprovada do dia, desta OS, ainda não usada e assinada por todos: dá para iniciar. */
  | { tipo: "iniciar"; apr: Pick<AprDaApi, "id" | "concluida_em" | "participantes"> }
  /** Há APR aprovada do dia, mas falta a assinatura de algum participante: a execução espera por elas. */
  | { tipo: "aguardando_assinaturas"; apr: Pick<AprDaApi, "id" | "concluida_em" | "participantes">; faltam: string[]; euFalto: boolean }
  | { tipo: "sem_apr" };

interface Entrada {
  osStatus: string;
  usuarioId: string;
  execucoes: ExecucaoDaApi[];
  aprs: AprDaApi[];
  abertas: ExecucaoAberta[];
  /** Instante de referência (o "hoje" das regras). */
  agora: Date;
  /** A pessoa para quem a OS está reservada, se estiver. */
  reservadaPara?: { id: string; nome: string } | null;
}

export function definirSituacao({ osStatus, usuarioId, execucoes, aprs, abertas, agora, reservadaPara }: Entrada): Situacao {
  const hoje = diaDe(agora);

  const esquecida = abertas.find((e) => diaDe(e.inicio) !== hoje);
  if (esquecida) return { tipo: "esquecida", execucao: esquecida };

  const minha = execucoes.find((e) => e.resultado === null && e.executor.id === usuarioId);
  if (minha) {
    const apr = aprs.find((a) => a.id === minha.apr_id);
    return { tipo: "em_andamento", execucao: minha, participantes: apr?.participantes ?? [] };
  }

  // O tempo parou, mas o encerramento não foi assinado: quem executou volta ao formulário; os demais esperam por ele.
  const semAssinar = [...execucoes].reverse().find((e) => e.resultado === "encerrada" && !e.encerramento_assinado_em);
  if (semAssinar) {
    return semAssinar.executor.id === usuarioId ? { tipo: "encerrando", execucao: semAssinar } : { tipo: "outra_pessoa", executor: semAssinar.executor.nome, encerrando: true };
  }

  const deOutro = execucoes.find((e) => e.resultado === null);
  if (deOutro) return { tipo: "outra_pessoa", executor: deOutro.executor.nome };

  if (osStatus === "aguardando_supervisor" || osStatus === "encerrada") return { tipo: "terminada", status: osStatus };
  if (osStatus === "cancelada") return { tipo: "fechada" };
  if (osStatus === "devolvida") return { tipo: "devolvida" };
  if (reservadaPara && reservadaPara.id !== usuarioId) return { tipo: "reservada", responsavel: reservadaPara.nome };

  // A APR serve se é de hoje, não amparou outra execução, o usuário continua nela e ela não ficou sem o responsável ou sem o mínimo de participantes.
  const usadas = new Set(execucoes.filter((e) => e.resultado !== "cancelada").map((e) => e.apr_id));
  const apr = aprs
    .filter(
      (a) =>
        a.resultado === "aprovada" &&
        diaDe(a.concluida_em) === hoje &&
        !usadas.has(a.id) &&
        a.participantes.some((p) => p.usuario_id === usuarioId && !p.recusou_em) &&
        !situacaoDaApr(a).inviavel,
    )
    .sort((a, b) => b.concluida_em.localeCompare(a.concluida_em))[0];
  if (!apr) return { tipo: "sem_apr" };
  const situacaoApr = situacaoDaApr(apr);
  if (situacaoApr.pronta) return { tipo: "iniciar", apr };
  return { tipo: "aguardando_assinaturas", apr, faltam: situacaoApr.faltam.map((p) => p.nome), euFalto: situacaoApr.faltam.some((p) => p.usuario_id === usuarioId) };
}
