import { sql } from "drizzle-orm";
import { check, date, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";
import { planoPreventiva } from "./preventivas";
import { importacao, os } from "./sap";
import { equipe, usuario } from "./usuarios";
import { ausencia } from "./ausencia";

/** Os avisos da ausência de um usuário: apontam para a ausência, não para uma OS. */
export const ALERTA_TIPOS_DE_AUSENCIA = [
  "ausencia_pedida",
  "ausencia_aprovada",
  "ausencia_recusada",
  "ausencia_registrada",
  "ausencia_fim_pedido",
  "ausencia_fim_respondido",
  "ausencia_alterada",
  "ausencia_vencida",
  "ausencia_cancelada",
] as const;

/** Os avisos de que o representante assumiu a equipe ou de que o supervisor voltou: apontam para a equipe. */
export const ALERTA_TIPOS_DE_REPRESENTACAO = ["representacao_iniciada", "representacao_encerrada"] as const;

export const ALERTA_TIPOS = [
  "bloqueio",
  "conflito_planejamento",
  "execucao_duplicada",
  "apoio_encerrado",
  "falha_importacao",
  "preventiva_proxima",
  "preventiva_vencida",
  "inspecao_com_pendencia",
  ...ALERTA_TIPOS_DE_AUSENCIA,
  ...ALERTA_TIPOS_DE_REPRESENTACAO,
] as const;
export type AlertaTipo = (typeof ALERTA_TIPOS)[number];

/**
 * Aviso no sino do painel. Os alertas de OS (impedimento, conflito, execução duplicada, apoio encerrado) apontam para a OS;
 * a falha de importação (sincronização ou planilha) aponta para o registro da importação que falhou, e não tem OS. Os do ciclo
 * das preventivas (próximo ou vencido) apontam para o plano e para a última OS dele.
 */
export const alerta = pgTable(
  "alerta",
  {
    id: uuid().primaryKey().defaultRandom(),
    tipo: text({ enum: ALERTA_TIPOS }).notNull(),
    /** Obrigatória em todo alerta, menos na falha de importação. */
    osId: uuid().references(() => os.id),
    /** Só na falha de importação. */
    importacaoId: uuid().references(() => importacao.id),
    /** Só nos alertas do ciclo das preventivas (`preventiva_proxima`, `preventiva_vencida`). */
    planoPreventivaId: uuid().references(() => planoPreventiva.id),
    /** Só nos alertas da ausência de um usuário (`ausencia_*`). */
    ausenciaId: uuid().references(() => ausencia.id),
    /** A pessoa da ausência, nos mesmos alertas. */
    usuarioAlvoId: uuid().references(() => usuario.id),
    /** Só nos alertas da representação da equipe (`representacao_*`). */
    equipeId: uuid().references(() => equipe.id),
    /** Alerta de OS: supervisor da equipe; sem supervisor, um alerta por administrador ativo. Falha de importação: ver `dominio/alertas.ts`. */
    destinatarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    detalhe: text().notNull(),
    emailEnviadoEm: instante(),
    lidoEm: instante(),
    criadoEm: instante().notNull().defaultNow(),
  },
  (t) => [
    check("alerta_tipo_check", emLista(t.tipo, ALERTA_TIPOS)),
    check(
      "alerta_alvo",
      sql`(${t.tipo} = 'falha_importacao' and ${t.importacaoId} is not null and ${t.osId} is null and ${t.ausenciaId} is null and ${t.equipeId} is null) or (${emLista(t.tipo, ALERTA_TIPOS_DE_AUSENCIA)} and ${t.ausenciaId} is not null and ${t.osId} is null and ${t.importacaoId} is null and ${t.equipeId} is null) or (${emLista(t.tipo, ALERTA_TIPOS_DE_REPRESENTACAO)} and ${t.equipeId} is not null and ${t.osId} is null and ${t.importacaoId} is null and ${t.ausenciaId} is null) or (${t.tipo} <> 'falha_importacao' and not ${emLista(t.tipo, ALERTA_TIPOS_DE_AUSENCIA)} and not ${emLista(t.tipo, ALERTA_TIPOS_DE_REPRESENTACAO)} and ${t.osId} is not null and ${t.importacaoId} is null and ${t.ausenciaId} is null and ${t.equipeId} is null)`,
    ),
    check("alerta_alvo_da_ausencia", sql`(${t.ausenciaId} is null) = (${t.usuarioAlvoId} is null)`),
    check(
      "alerta_plano_so_na_preventiva",
      sql`(${t.tipo} in ('preventiva_proxima', 'preventiva_vencida')) = (${t.planoPreventivaId} is not null)`,
    ),
    index("alerta_destinatario_idx").on(t.destinatarioId, t.criadoEm.desc()),
    index("alerta_nao_lidos_idx").on(t.destinatarioId).where(sql`${t.lidoEm} is null`),
    index("alerta_os_idx").on(t.osId),
    index("alerta_ausencia_idx").on(t.ausenciaId).where(sql`${t.ausenciaId} is not null`),
    index("alerta_plano_idx").on(t.planoPreventivaId).where(sql`${t.planoPreventivaId} is not null`),
  ],
).enableRLS();

/** Histórico das justificativas que o indicador de atraso e a auditoria leem. */
export const reprogramacao = pgTable(
  "reprogramacao",
  {
    id: uuid().primaryKey().defaultRandom(),
    osId: uuid()
      .notNull()
      .references(() => os.id),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    dataAnterior: date({ mode: "string" }).notNull(),
    dataNova: date({ mode: "string" }).notNull(),
    equipeAnteriorId: uuid().references(() => equipe.id),
    equipeNovaId: uuid().references(() => equipe.id),
    justificativa: text().notNull(),
    /** A assinatura do perfil de quem reprogramou (cópia). Nula nas reprogramações anteriores à assinatura. */
    assinaturaPath: text(),
    criadaEm: instante().notNull().defaultNow(),
  },
  (t) => [
    check("reprogramacao_justificativa_check", sql`nullif(btrim(${t.justificativa}), '') is not null`),
    index("reprogramacao_os_idx").on(t.osId, t.criadaEm.desc()),
  ],
).enableRLS();
