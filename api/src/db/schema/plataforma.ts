import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";

export const TAREFA_TIPOS = ["pdf_os", "email_alerta", "leitura_sap"] as const;
export const TAREFA_ESTADOS = ["pendente", "em_andamento", "concluida", "falhou"] as const;

/** Tarefas em segundo plano: geração de PDF, e-mail de alerta e leitura do SAP. */
export const tarefa = pgTable(
  "tarefa",
  {
    id: uuid().primaryKey().defaultRandom(),
    tipo: text({ enum: TAREFA_TIPOS }).notNull(),
    /** os.id, alerta.id ou nulo (leitura agendada). */
    referenciaId: uuid(),
    estado: text({ enum: TAREFA_ESTADOS }).notNull().default("pendente"),
    tentativas: integer().notNull().default(0),
    proximaEm: instante().notNull().defaultNow(),
    /** Última mensagem de erro. */
    erro: text(),
    criadaEm: instante().notNull().defaultNow(),
  },
  (t) => [
    check("tarefa_tipo_check", emLista(t.tipo, TAREFA_TIPOS)),
    check("tarefa_estado_check", emLista(t.estado, TAREFA_ESTADOS)),
    check("tarefa_tentativas_check", sql`${t.tentativas} >= 0`),
    // O executor lê as tarefas pendentes na ordem em que vencem.
    index("tarefa_pendentes_idx").on(t.proximaEm).where(sql`${t.estado} = 'pendente'`),
    index("tarefa_referencia_idx").on(t.tipo, t.referenciaId),
  ],
).enableRLS();
