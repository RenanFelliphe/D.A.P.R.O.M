/**
 * As contas da notificação push no app (sem React Native, para testar): ler o que a notificação traz e decidir para onde o toque leva.
 * A notificação leva o que `destinoDoAvisoNoApp` precisa do aviso (`DadosDoPush`), então o toque abre a mesma tela do toque no sino.
 */

import type { Alerta } from "@shared/api/alertas";
import { TIPOS_DE_AVISO } from "@shared/notificacoes/avisos";
import type { DadosDoPush } from "@shared/notificacoes/push";
import { destinoDoAvisoNoApp } from "../avisos/destino";

const texto = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

/** O que a notificação traz, conferido: o que não tem a forma esperada (de outro app, de uma versão futura) é ignorado em vez de abrir uma tela errada. */
export function lerDadosDoPush(bruto: unknown): DadosDoPush | null {
  if (!bruto || typeof bruto !== "object") return null;
  const d = bruto as Record<string, unknown>;
  const alertaId = texto(d.alerta_id);
  const destinatarioId = texto(d.destinatario_id);
  const tipo = (TIPOS_DE_AVISO as readonly string[]).includes(d.tipo as string) ? (d.tipo as DadosDoPush["tipo"]) : null;
  if (!alertaId || !destinatarioId || !tipo) return null;
  return { alerta_id: alertaId, tipo, destinatario_id: destinatarioId, os_id: texto(d.os_id), usuario_alvo_id: texto(d.usuario_alvo_id), sugestao_id: texto(d.sugestao_id) };
}

/**
 * Para onde o toque leva dentro do app: a tela do aviso, ou `null` quando ele só existe na web (a notificação abre o app no que estava) e
 * quando a notificação é de outra pessoa (o aparelho trocou de mãos depois do envio: não abre a tela de quem não a recebeu).
 */
export function destinoDoPush(dados: DadosDoPush, usuarioId: string): string | null {
  if (dados.destinatario_id !== usuarioId) return null;
  return destinoDoAvisoNoApp(dados as Pick<Alerta, "tipo" | "os_id" | "destinatario_id" | "usuario_alvo_id" | "sugestao_id">);
}

/** Como a pessoa quer as notificações neste aparelho (a escolha dela); a permissão do sistema é outra coisa. */
export type PreferenciaDePush = "ligado" | "desligado";

/** Em que pé estão as notificações neste aparelho, para a tela de configurações dizer. */
export type SituacaoDoPush =
  | { tipo: "ligado" }
  | { tipo: "desligado" }
  /** O sistema negou a permissão: só a pessoa muda, nas configurações do aparelho. */
  | { tipo: "bloqueado" }
  /** O aparelho não consegue (sem os serviços do Google, sem rede, emulador): o motivo vai na tela. Os avisos seguem no sino. */
  | { tipo: "indisponivel"; motivo: string };

export const MOTIVO_SEM_SERVICOS_DO_GOOGLE = "Este aparelho não recebe notificações (talvez sem os serviços do Google). Os avisos continuam no sino do app.";
