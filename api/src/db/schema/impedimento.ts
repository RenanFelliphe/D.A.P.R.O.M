import { sql } from "drizzle-orm";
import { check, date, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";
import { os } from "./sap";
import { equipe, usuario } from "./usuarios";

export const ALERTA_TIPOS = ["bloqueio", "conflito_planejamento", "execucao_duplicada", "apoio_encerrado"] as const;
export type AlertaTipo = (typeof ALERTA_TIPOS)[number];

export const alerta = pgTable(
  "alerta",
  {
    id: uuid().primaryKey().defaultRandom(),
    tipo: text({ enum: ALERTA_TIPOS }).notNull(),
    osId: uuid()
      .notNull()
      .references(() => os.id),
    /** Supervisor da equipe; sem supervisor, um alerta por analista ativo. */
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
    index("alerta_destinatario_idx").on(t.destinatarioId, t.criadoEm.desc()),
    index("alerta_nao_lidos_idx").on(t.destinatarioId).where(sql`${t.lidoEm} is null`),
    index("alerta_os_idx").on(t.osId),
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
    criadaEm: instante().notNull().defaultNow(),
  },
  (t) => [
    check("reprogramacao_justificativa_check", sql`nullif(btrim(${t.justificativa}), '') is not null`),
    index("reprogramacao_os_idx").on(t.osId, t.criadaEm.desc()),
  ],
).enableRLS();
