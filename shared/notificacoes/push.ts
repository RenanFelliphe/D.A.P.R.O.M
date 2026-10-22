/**
 * A notificação push do app (`docs/pessoas-e-equipes.md`, seção 8.6): quais avisos do sino também tocam no celular e o que a notificação
 * leva. A `api` decide e envia (`api/src/dominio/push.ts`); o app registra o aparelho e abre a tela certa ao toque.
 *
 * O push nunca é o único canal: todo aviso continua no sino e, se o tipo tem categoria, no e-mail. Por isso a notificação é curta e o
 * que ela diz está sempre no aviso.
 */

import type { TipoDeAviso } from "./avisos";

/** Os canais do Android: o urgente toca com prioridade máxima (e acorda o aparelho); o padrão, em volume normal. */
export type CanalDoPush = "urgente" | "padrao";

export interface ConfigDoPush {
  canal: CanalDoPush;
  /** Quanto tempo o aviso vale, em segundos, se o aparelho estiver sem sinal. Depois disso a notificação já não serve (o pedido de ação vence em 2 min). */
  validadeS?: number;
}

/**
 * Os avisos que tocam no celular. O critério: alguém precisa agir no campo, ou saber na hora, e só o sino chegaria tarde. Fora daqui, por
 * decisão: os avisos de gestão do admin (cadastro, falhas do SAP e do registro, treinamentos), o ciclo das preventivas, os "um participante
 * agiu" e "a lista de materiais mudou", que avisam muita gente ou valem pouco.
 */
export const PUSH_DO_AVISO: Partial<Record<TipoDeAviso, ConfigDoPush>> = {
  // Segurança: o supervisor sabe na hora
  emergencia: { canal: "urgente" },
  emergencia_atendida: { canal: "urgente" },
  bloqueio: { canal: "urgente" },
  direito_de_recusa: { canal: "urgente" },
  lesao_ou_enfermidade: { canal: "urgente" },
  clima_extremo: { canal: "urgente" },
  // Execução compartilhada: o pedido vence e se aprova sozinho em 2 minutos
  pedido_de_acao: { canal: "urgente", validadeS: 120 },
  pedido_decidido: { canal: "padrao", validadeS: 600 },
  // APR: assinar para a execução começar, e o convite para participar
  apr_para_assinar: { canal: "urgente" },
  apr_convite: { canal: "urgente", validadeS: 900 },
  apr_convite_aceito: { canal: "padrao", validadeS: 900 },
  apr_convite_recusado: { canal: "urgente", validadeS: 900 },
  apr_convite_cancelado: { canal: "padrao", validadeS: 900 },
  // OS: reservada, devolvida da reserva, assinatura final
  os_reservada: { canal: "padrao" },
  os_reserva_desfeita: { canal: "padrao" },
  os_para_assinar: { canal: "padrao" },
  os_ciencia: { canal: "padrao" },
  // A conferência do que a equipe registrou sem sinal
  conferencia_aberta: { canal: "padrao" },
  conferencia_cobranca: { canal: "padrao" },
  conferencia_para_decidir: { canal: "padrao" },
  conferencia_para_assinar: { canal: "padrao" },
  conferencia_tempo_esgotado: { canal: "padrao" },
  // Ausência: o pedido a responder e as respostas
  ausencia_pedida: { canal: "padrao" },
  ausencia_aprovada: { canal: "padrao" },
  ausencia_recusada: { canal: "padrao" },
  ausencia_fim_pedido: { canal: "padrao" },
  ausencia_fim_respondido: { canal: "padrao" },
  ausencia_vencida: { canal: "padrao" },
  // Equipe: quem responde por ela, e as sugestões de materiais a avaliar ou já avaliadas
  representacao_iniciada: { canal: "padrao" },
  representacao_encerrada: { canal: "padrao" },
  sugestao_materiais_nova: { canal: "padrao" },
  contestacao_materiais_nova: { canal: "padrao" },
  sugestao_materiais_aceita: { canal: "padrao" },
  sugestao_materiais_recusada: { canal: "padrao" },
};

export const temPush = (tipo: TipoDeAviso): boolean => tipo in PUSH_DO_AVISO;

/** O corpo da notificação: o texto do aviso, cortado para caber na bandeja (o aviso inteiro está no sino). */
export const LIMITE_DO_CORPO_DO_PUSH = 160;
export function corpoDoPush(detalhe: string): string {
  const texto = detalhe.replace(/\s+/g, " ").trim();
  return texto.length <= LIMITE_DO_CORPO_DO_PUSH ? texto : `${texto.slice(0, LIMITE_DO_CORPO_DO_PUSH - 1).trimEnd()}…`;
}

/**
 * O que a notificação leva para o app abrir a tela certa ao toque: o que `destinoDoAvisoNoApp` precisa do aviso (a mesma regra do toque
 * no sino). O app não consulta nada para decidir; consulta só o aviso, ao abrir, para marcá-lo como lido.
 */
export interface DadosDoPush {
  alerta_id: string;
  tipo: TipoDeAviso;
  os_id: string | null;
  destinatario_id: string;
  usuario_alvo_id: string | null;
  sugestao_id: string | null;
}

/** O nome do canal do Android de cada tipo de canal (criado no app na primeira abertura). */
export const NOME_DO_CANAL: Record<CanalDoPush, string> = { urgente: "Urgentes", padrao: "Avisos" };

export const PLATAFORMAS_DE_PUSH = ["android", "ios"] as const;
export type PlataformaDePush = (typeof PLATAFORMAS_DE_PUSH)[number];

/** Corpo de `POST /me/dispositivos`: o token que o Expo deu ao aparelho. */
export interface RegistroDeDispositivo {
  token: string;
  plataforma: PlataformaDePush;
}

/** Um token do serviço de push da Expo tem esta forma; o resto é recusado na entrada. */
export const ehTokenDeExpo = (token: string): boolean => /^(Expo|Exponent)PushToken\[[^\]\s]+\]$/.test(token);
