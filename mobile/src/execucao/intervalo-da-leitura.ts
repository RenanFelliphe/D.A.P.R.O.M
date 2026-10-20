import { pedidoAberto } from "@shared/api/execucao-pedidos";
import type { ExecucaoDaApi } from "@shared/api/execucao-tempo";

/** De quanto em quanto tempo a tela relê a execução de outra pessoa que a equipe acompanha (só com a tela aberta, em primeiro plano). */
export const ACOMPANHAR_A_CADA_MS = 10_000;
/** O responsável relê a própria execução para ver o que os participantes fizeram nela (pausas e pedidos). */
export const ACOMPANHAR_A_MINHA_A_CADA_MS = 5_000;
/** Com um pedido aberto, todos releem mais depressa: o responsável tem 2 minutos, e quem pediu espera a resposta. */
export const ACOMPANHAR_COM_PEDIDO_A_CADA_MS = 3_000;

/**
 * Quanto esperar para reler a execução, ou `false` para não reler: com um pedido aberto, depressa; o responsável com a execução dele em
 * andamento, a cada 5 s; quem acompanha a execução de outra pessoa (andamento ou preenchimento do encerramento), a cada 10 s.
 */
export function intervaloDaLeitura(execucoes: ExecucaoDaApi[], usuarioId: string): number | false {
  if (execucoes.some((e) => e.resultado === null && pedidoAberto(e))) return ACOMPANHAR_COM_PEDIDO_A_CADA_MS;
  if (execucoes.some((e) => e.resultado === null && e.executor.id === usuarioId)) return ACOMPANHAR_A_MINHA_A_CADA_MS;
  const deOutro = execucoes.some((e) => e.executor.id !== usuarioId && (e.resultado === null || (e.resultado === "encerrada" && !e.encerramento_assinado_em)));
  return deOutro ? ACOMPANHAR_A_CADA_MS : false;
}
