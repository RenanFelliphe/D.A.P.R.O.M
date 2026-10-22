import { sql } from "drizzle-orm";
import { check, doublePrecision, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { instante } from "./comum";
import { execucao } from "./execucao";
import { os } from "./sap";
import { usuario } from "./usuarios";

/**
 * Um acionamento do botão de emergência (`docs/operacao-de-campo.md`, seção 5.9). O id nasce no aparelho (é o do evento
 * `emergencia_acionada`), então reenviar o mesmo acionamento não duplica. `acionada_em` é o relógio do aparelho e `recebida_em` o da `api`:
 * a diferença mostra o acionamento que esperou o sinal voltar. A posição é a do aparelho na hora, e vem nula quando o GPS falhou (o
 * botão nunca é barrado por isso). O atendimento é o supervisor ou o admin dizendo que a ocorrência foi tratada.
 */
export const emergencia = pgTable(
  "emergencia",
  {
    id: uuid().primaryKey(),
    osId: uuid()
      .notNull()
      .references(() => os.id),
    acionadaPorId: uuid()
      .notNull()
      .references(() => usuario.id),
    /** A execução aberta no momento, quando havia uma. */
    execucaoId: uuid().references(() => execucao.id),
    acionadaEm: instante().notNull(),
    recebidaEm: instante().notNull(),
    latitude: doublePrecision(),
    longitude: doublePrecision(),
    observacao: text(),
    atendidaEm: instante(),
    atendidaPorId: uuid().references(() => usuario.id),
    notaDoAtendimento: text(),
  },
  (t) => [
    check("emergencia_posicao_completa", sql`(${t.latitude} is null) = (${t.longitude} is null)`),
    check("emergencia_atendimento_completo", sql`(${t.atendidaEm} is null) = (${t.atendidaPorId} is null)`),
    index("emergencia_os_idx").on(t.osId, t.acionadaEm.desc()),
    index("emergencia_abertas_idx").on(t.acionadaEm).where(sql`${t.atendidaEm} is null`),
  ],
).enableRLS();
