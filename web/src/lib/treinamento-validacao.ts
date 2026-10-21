import type { RascunhoDoEditor } from "./treinamento-servico";

/**
 * A validação do treinamento pelos supervisores (`funcionalidades/validacao-de-treinamento.md`): as 3 equipes que mais fazem o
 * serviço (sem a de quem criou) escolhem, cada uma por um supervisor, e 2 dos 3 assinam para publicar; qualquer recusa devolve o
 * treinamento ao autor. Os tipos abaixo são as respostas de `/treinamentos/{codigo}/validacao` e das rotas vizinhas.
 */

export type DecisaoDoValidador = "aprovou" | "recusou";

export interface ValidadorDaRodada {
  equipe_id: string;
  equipe_nome: string;
  /** 1 = a equipe que mais faz o serviço (ou a seguinte, se a primeira é a do autor). */
  posicao: number;
  supervisor_nome: string | null;
  decisao: DecisaoDoValidador | null;
  decidida_por_nome: string | null;
  decidida_em: string | null;
  motivo: string | null;
}

export interface ValidadorPrevisto {
  equipe_nome: string;
  supervisor_nome: string | null;
}

/** Uma rodada que terminou sem publicar: um validador recusou e devolveu o treinamento ao autor (retirar da validação não entra aqui). */
export interface RodadaEncerrada {
  rodada: number;
  resultado: "recusada";
  motivo: string | null;
  por_nome: string | null;
  em: string | null;
}

/** `GET /treinamentos/{codigo}/validacao` (admin, autor ou validador da rodada). */
export interface ValidacaoDoTreinamento {
  codigo: string;
  versao: number;
  versao_id: string;
  em_validacao: boolean;
  rodada: number;
  autor: { id: string; nome: string } | null;
  enviada_em: string | null;
  /** Quantas assinaturas publicam: 2, ou todas quando só há 1 ou 2 validadores. */
  necessarias: number;
  aprovacoes: number;
  validadores: ValidadorDaRodada[];
  /** Quem validaria se o rascunho fosse enviado agora (vazio quando já está em validação). */
  validadores_previstos: ValidadorPrevisto[];
  pode_enviar: boolean;
  pode_retirar: boolean;
  posso_decidir: boolean;
  ja_decidi: boolean;
  historico: RodadaEncerrada[];
  /** O conteúdo para o validador rever, com o gabarito (o mesmo de `GET .../rascunho`, sem a situação da IA). */
  rascunho: RascunhoDoEditor;
}

/**
 * O retorno de `.../validacao/aprovar`: se essa assinatura fechou as necessárias, o treinamento foi publicado (`publicada: true`, com a versão
 * no ar, e já não há validação para mostrar); senão, a validação atualizada.
 */
export type RespostaDaAprovacao = { publicada: true; versao: number } | (ValidacaoDoTreinamento & { publicada: false });

/** O retorno de `.../validacao/recusar`: o treinamento voltou ao autor. */
export interface RespostaDaRecusa {
  devolvido: true;
}

/** `GET /treinamentos/meus-servicos`: onde a pessoa pode criar e editar treinamento (o admin, em todos). */
export interface MeusServicosDeTreinamento {
  admin: boolean;
  servicos: string[];
}

/** Um treinamento que espera a decisão da pessoa (`GET /treinamentos/para-validar`). */
export interface TreinamentoParaValidar {
  codigo: string;
  descricao: string;
  versao: number;
  rodada: number;
  autor_nome: string | null;
  enviada_em: string;
  aprovacoes: number;
  necessarias: number;
  validadores: { equipe_nome: string; decisao: DecisaoDoValidador | null }[];
}

/** O que a visão geral e a tela de publicar dizem da validação, numa frase e num tom. */
export type SituacaoDaValidacao = "nao_enviado" | "em_validacao" | "devolvido";

export function situacaoDaValidacao(v: Pick<ValidacaoDoTreinamento, "em_validacao" | "historico" | "rodada"> | null): SituacaoDaValidacao {
  if (!v) return "nao_enviado";
  if (v.em_validacao) return "em_validacao";
  const ultima = v.historico[0];
  return ultima && ultima.rodada === v.rodada && ultima.resultado === "recusada" ? "devolvido" : "nao_enviado";
}

/** "1 de 2 assinaturas"; mostra o que falta para publicar. */
export const textoDoAndamento = (v: Pick<ValidacaoDoTreinamento, "aprovacoes" | "necessarias">) =>
  `${v.aprovacoes} de ${v.necessarias} ${v.necessarias === 1 ? "assinatura" : "assinaturas"}`;

/** O motivo de a pessoa não poder decidir agora, em linguagem simples (a tela de validar o mostra no lugar dos botões). */
export function motivoDeNaoDecidir(v: Pick<ValidacaoDoTreinamento, "em_validacao" | "ja_decidi" | "posso_decidir">): string | null {
  if (v.posso_decidir) return null;
  if (!v.em_validacao) return "Este treinamento não está em validação agora.";
  if (v.ja_decidi) return "Você já deu a sua decisão nesta rodada.";
  return "A decisão desta validação é dos supervisores das equipes escolhidas.";
}
