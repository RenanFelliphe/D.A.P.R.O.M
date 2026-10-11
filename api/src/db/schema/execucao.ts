import { sql } from "drizzle-orm";
import {
  jsonb,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";
import { apr, aprResposta } from "./apr";
import { itemModeloApr } from "./modelos-apr";
import { os } from "./sap";
import { usuario } from "./usuarios";

export const EXECUCAO_RESULTADOS = ["encerrada", "interrompida", "suspensa", "cancelada"] as const;
export const PAUSA_MOTIVOS = ["almoco", "descanso", "outro"] as const;

/**
 * Um trecho de trabalho amparado por uma APR aprovada. Os ids nascem no cliente.
 * Não há índice único de "uma execução em andamento por OS" de propósito: duas pessoas podem executar
 * a mesma OS offline, e as duas execuções são guardadas (vale a primeira encerrada, com alerta
 * `execucao_duplicada`).
 */
export const execucao = pgTable(
  "execucao",
  {
    id: uuid().primaryKey(),
    osId: uuid()
      .notNull()
      .references(() => os.id),
    /** A api exige a APR `aprovada`. */
    aprId: uuid()
      .notNull()
      .references(() => apr.id),
    /** Quem estava logado. */
    executorId: uuid()
      .notNull()
      .references(() => usuario.id),
    numeroPessoas: integer().notNull(),
    inicio: instante().notNull(),
    fim: instante(),
    /** Nulo = em andamento. */
    resultado: text({ enum: EXECUCAO_RESULTADOS }),
    descricaoAtividade: text(),
    motivo: text(),
    /**
     * Leituras e conformidades do formulário de inspeção da OS preventiva (OS 4019821: horímetro, tensões,
     * "Conforme / Não conforme" por componente). A estrutura do formulário ainda não está definida (questão 57),
     * por isso é JSON.
     */
    dadosInspecao: jsonb(),
  },
  (t) => [
    check("execucao_resultado_check", emLista(t.resultado, EXECUCAO_RESULTADOS)),
    check("execucao_numero_pessoas_check", sql`${t.numeroPessoas} >= 1`),
    check("execucao_fim_apos_inicio", sql`${t.fim} is null or ${t.fim} >= ${t.inicio}`),
    check(
      "execucao_encerrada_completa",
      sql`${t.resultado} is distinct from 'encerrada' or (${t.fim} is not null and nullif(btrim(${t.descricaoAtividade}), '') is not null)`,
    ),
    check(
      "execucao_interrompida_com_motivo",
      sql`${t.resultado} is distinct from 'interrompida' or (${t.fim} is not null and nullif(btrim(${t.motivo}), '') is not null)`,
    ),
    check("execucao_suspensa_com_fim", sql`${t.resultado} is distinct from 'suspensa' or ${t.fim} is not null`),
    // Uma APR ampara uma única Execução. A cancelada não conta: cancelar por engano devolve a APR para uso.
    uniqueIndex("execucao_apr_unica_idx").on(t.aprId).where(sql`${t.resultado} is distinct from 'cancelada'`),
    index("execucao_os_idx").on(t.osId),
    index("execucao_executor_idx").on(t.executorId, t.inicio.desc()),
    // Execuções em andamento (o painel destaca as abertas há mais de 12 h).
    index("execucao_abertas_idx").on(t.inicio).where(sql`${t.resultado} is null`),
  ],
).enableRLS();

export const execucaoPausa = pgTable(
  "execucao_pausa",
  {
    id: uuid().primaryKey(),
    execucaoId: uuid()
      .notNull()
      .references(() => execucao.id),
    inicio: instante().notNull(),
    /** Nulo = pausa aberta. */
    fim: instante(),
    motivo: text({ enum: PAUSA_MOTIVOS }),
  },
  (t) => [
    check("execucao_pausa_motivo_check", emLista(t.motivo, PAUSA_MOTIVOS)),
    check("execucao_pausa_fim_apos_inicio", sql`${t.fim} is null or ${t.fim} >= ${t.inicio}`),
    index("execucao_pausa_execucao_idx").on(t.execucaoId),
    // No máximo uma pausa aberta por execução.
    uniqueIndex("execucao_pausa_unica_aberta_idx").on(t.execucaoId).where(sql`${t.fim} is null`),
  ],
).enableRLS();

export const execucaoAssinatura = pgTable(
  "execucao_assinatura",
  {
    execucaoId: uuid()
      .notNull()
      .references(() => execucao.id),
    /** Um por participante da APR. */
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    /** Cópia da assinatura do perfil. */
    assinaturaPath: text().notNull(),
    assinadaEm: instante().notNull(),
  },
  (t) => [primaryKey({ name: "execucao_assinatura_pkey", columns: [t.execucaoId, t.usuarioId] })],
).enableRLS();

export const evidencia = pgTable(
  "evidencia",
  {
    id: uuid().primaryKey(),
    execucaoId: uuid().references(() => execucao.id),
    /** Foto do item reprovado. */
    aprId: uuid().references(() => apr.id),
    itemId: uuid().references(() => itemModeloApr.id),
    /** Bucket `fotos`. */
    fotoPath: text().notNull(),
    capturadaEm: instante().notNull(),
    latitude: numeric({ precision: 9, scale: 6, mode: "number" }),
    longitude: numeric({ precision: 9, scale: 6, mode: "number" }),
  },
  (t) => [
    check("evidencia_tem_dono", sql`${t.execucaoId} is not null or ${t.aprId} is not null`),
    check("evidencia_item_da_apr", sql`(${t.aprId} is null) = (${t.itemId} is null)`),
    check("evidencia_gps_completo", sql`(${t.latitude} is null) = (${t.longitude} is null)`),
    check("evidencia_latitude_check", sql`${t.latitude} between -90 and 90`),
    check("evidencia_longitude_check", sql`${t.longitude} between -180 and 180`),
    // A foto de item só vale para um item que a APR respondeu.
    foreignKey({
      name: "evidencia_resposta_fk",
      columns: [t.aprId, t.itemId],
      foreignColumns: [aprResposta.aprId, aprResposta.itemId],
    }),
    index("evidencia_execucao_idx").on(t.execucaoId).where(sql`${t.execucaoId} is not null`),
    index("evidencia_apr_idx").on(t.aprId, t.itemId).where(sql`${t.aprId} is not null`),
  ],
).enableRLS();
