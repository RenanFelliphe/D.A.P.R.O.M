/**
 * O convite de participação na APR (`docs/operacao-de-campo.md`, seção 4.9). Ao escolher os participantes, o responsável convida cada
 * um; a pessoa responde "Aceito" ou "Não posso" (com o motivo), e o responsável só segue com a APR quando todos os convidados
 * aceitaram, ou troca quem recusou ou não respondeu. É anterior à APR: o rascunho dela fica só no aparelho do responsável.
 *
 * O aceite é "eu vou"; a assinatura continua no fim ("li e concordo com os riscos"), e o direito de recusa também. Sem sinal, o
 * convite não existe e vale o presencial de sempre: quem não foi convidado não é cobrado.
 */

import type { TomDoSelo } from "./tipos";

/** Quanto tempo o convite espera a resposta; depois disso ele é "sem resposta" e só serve para ser trocado. A confirmar com o usuário. */
export const PRAZO_DO_CONVITE_MIN = 15;

/** O motivo da recusa é curto: o responsável o lê para trocar a pessoa. */
export const LIMITE_DO_MOTIVO_DO_CONVITE = 160;

/** Quantas pessoas se convida de uma vez. */
export const MAX_CONVIDADOS = 20;

/** Como o convite se apresenta (o estado do banco, com o prazo vencido já contado): quem convida vê as quatro; quem é convidado, as duas primeiras. */
export type SituacaoDoConvite = "aguardando" | "aceito" | "recusado" | "sem_resposta";

export const ROTULO_DA_SITUACAO_DO_CONVITE: Record<SituacaoDoConvite, string> = {
  aguardando: "Aguardando resposta",
  aceito: "Aceitou",
  recusado: "Não pode",
  sem_resposta: "Sem resposta",
};

/** A pessoa de um convite. */
export interface PessoaDoConvite {
  id: string;
  nome: string;
  matricula: string;
}

/** O convite que o responsável fez (`GET /os/{id}/apr-convites`, `POST /os/{id}/apr-convites`). */
export interface ConviteFeito {
  id: string;
  os_id: string;
  convidado: PessoaDoConvite;
  situacao: SituacaoDoConvite;
  /** Por que a pessoa não pode (só na recusa). */
  motivo: string | null;
  criado_em: string;
  /** Até quando espera a resposta. */
  expira_em: string;
  respondido_em: string | null;
}

/** O convite que a pessoa recebeu (`GET /me/apr-convites`): o que espera a resposta dela e o que ela aceitou e ainda não virou APR. */
export interface ConviteRecebido {
  id: string;
  situacao: "aguardando" | "aceito";
  criado_em: string;
  expira_em: string;
  convidado_por: PessoaDoConvite;
  os: { id: string; numero_ordem: string | null; titulo: string; local: string };
}

/** Os convites de um responsável numa OS: pode seguir com a APR quando nenhum espera, recusou ou ficou sem resposta. */
export interface ConvitesDaOs {
  convites: ConviteFeito[];
}

/**
 * O que falta para o responsável seguir com a APR: o nome de quem ainda não aceitou, por situação. Só conta quem está marcado como
 * participante (quem saiu da lista já não importa) e foi convidado; o participante sem convite (o presencial, o offline) não é cobrado.
 */
export interface PendenciaDosConvites {
  aguardando: string[];
  recusaram: { nome: string; motivo: string | null }[];
  sem_resposta: string[];
  /** Nada impede de seguir. */
  livre: boolean;
}

export function pendenciaDosConvites(convites: ConviteFeito[], participantes: string[]): PendenciaDosConvites {
  const marcados = new Set(participantes);
  const doGrupo = convites.filter((c) => marcados.has(c.convidado.id));
  const aguardando = doGrupo.filter((c) => c.situacao === "aguardando").map((c) => c.convidado.nome);
  const recusaram = doGrupo.filter((c) => c.situacao === "recusado").map((c) => ({ nome: c.convidado.nome, motivo: c.motivo }));
  const semResposta = doGrupo.filter((c) => c.situacao === "sem_resposta").map((c) => c.convidado.nome);
  return { aguardando, recusaram, sem_resposta: semResposta, livre: aguardando.length === 0 && recusaram.length === 0 && semResposta.length === 0 };
}

/** A frase que diz por que ainda não dá para começar o checklist; `null` quando dá. */
export function frasePendenteDosConvites(p: PendenciaDosConvites): string | null {
  if (p.livre) return null;
  const partes: string[] = [];
  if (p.aguardando.length > 0) partes.push(`${lista(p.aguardando)} ainda não ${p.aguardando.length === 1 ? "respondeu" : "responderam"} ao convite`);
  if (p.recusaram.length > 0) partes.push(`${lista(p.recusaram.map((r) => r.nome))} não ${p.recusaram.length === 1 ? "pode" : "podem"} participar: troque ${p.recusaram.length === 1 ? "a pessoa" : "as pessoas"}`);
  if (p.sem_resposta.length > 0) partes.push(`${lista(p.sem_resposta)} não ${p.sem_resposta.length === 1 ? "respondeu" : "responderam"} no prazo: convide de novo ou troque`);
  const texto = partes.join("; ");
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}.`;
}

function lista(nomes: string[]): string {
  const primeiros = nomes.map((n) => n.split(" ")[0]!);
  return primeiros.length <= 1 ? (primeiros[0] ?? "") : `${primeiros.slice(0, -1).join(", ")} e ${primeiros[primeiros.length - 1]}`;
}

/**
 * Quem o responsável ainda pode convidar: os participantes marcados (menos ele mesmo) que não têm convite em aberto. O que está
 * aguardando ou já aceitou não se convida de novo; o recusado e o sem resposta, sim (é o "convidar de novo" depois de trocar de ideia).
 */
export function quemConvidar(marcados: string[], usuarioId: string, convites: ConviteFeito[]): string[] {
  const emAberto = new Set(convites.filter((c) => c.situacao === "aguardando" || c.situacao === "aceito").map((c) => c.convidado.id));
  return marcados.filter((id) => id !== usuarioId && !emAberto.has(id));
}

/** O convite a desfazer quando o responsável tira a pessoa da lista: o que ainda está em aberto (aguardando ou aceito). */
export function conviteADesfazer(convites: ConviteFeito[], usuarioId: string): ConviteFeito | null {
  return convites.find((c) => c.convidado.id === usuarioId && (c.situacao === "aguardando" || c.situacao === "aceito")) ?? null;
}

const TOM_DA_SITUACAO: Record<SituacaoDoConvite, TomDoSelo> = { aguardando: "exe", aceito: "enc", recusado: "blq", sem_resposta: "al" };

/** O selo do convidado na lista de participantes. */
export const seloDoConvite = (c: Pick<ConviteFeito, "situacao">): { tom: TomDoSelo; rotulo: string } => ({ tom: TOM_DA_SITUACAO[c.situacao], rotulo: ROTULO_DA_SITUACAO_DO_CONVITE[c.situacao] });

/** O tempo que resta para responder, como "12 min" ou "40 s"; `null` quando o prazo acabou. */
export function restanteDoConvite(expiraEm: string, agoraMs: number): string | null {
  const ms = Date.parse(expiraEm) - agoraMs;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const s = Math.ceil(ms / 1000);
  return s >= 60 ? `${Math.ceil(s / 60)} min` : `${s} s`;
}

/** O que falta no motivo da recusa; `null` se está certo. */
export function faltaNoMotivoDaRecusa(motivo: string): string | null {
  if (motivo.trim() === "") return "Diga por que você não pode participar.";
  if (motivo.trim().length > LIMITE_DO_MOTIVO_DO_CONVITE) return `O motivo passa de ${LIMITE_DO_MOTIVO_DO_CONVITE} caracteres.`;
  return null;
}
