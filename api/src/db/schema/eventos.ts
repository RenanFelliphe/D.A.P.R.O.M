import { check, index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";
import { os } from "./sap";
import { usuario } from "./usuarios";

export const EVENTO_TIPOS = [
  "apr_concluida",
  /** Um participante assina a APR na própria conta (a execução só começa com a assinatura de todos). */
  "apr_assinada",
  /** Direito de recusa: o participante não concorda, sai da APR e deixa o motivo. */
  "apr_recusada",
  "execucao_iniciada",
  "pausa_iniciada",
  "pausa_encerrada",
  /** O clique em "Encerrar OS": grava o fim e a localização, e o tempo para. */
  "execucao_encerrada",
  /** Depois do fim: a descrição, as fotos e o checklist (opcionais) e a assinatura do responsável. */
  "encerramento_assinado",
  "execucao_interrompida",
  "execucao_suspensa",
  "execucao_cancelada",
] as const;
export type EventoTipo = (typeof EVENTO_TIPOS)[number];

/**
 * O canal único de escrita de APR e execução (online e pela fila offline). A chave primária, gerada no
 * cliente, torna o reenvio inofensivo (Decisão-chave 3): a api insere aqui primeiro com
 * `on conflict (id) do nothing` e só aplica o resto se a linha for nova.
 */
export const eventoCampo = pgTable(
  "evento_campo",
  {
    /** Gerado no cliente. */
    id: uuid().primaryKey(),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    tipo: text({ enum: EVENTO_TIPOS }).notNull(),
    osId: uuid().references(() => os.id),
    payload: jsonb().notNull(),
    /** Relógio do dispositivo. */
    ocorridoEm: instante().notNull(),
    /** Relógio do servidor. */
    recebidoEm: instante().notNull().defaultNow(),
  },
  (t) => [
    check("evento_campo_tipo_check", emLista(t.tipo, EVENTO_TIPOS)),
    index("evento_campo_os_idx").on(t.osId, t.ocorridoEm),
    index("evento_campo_usuario_idx").on(t.usuarioId, t.recebidoEm.desc()),
  ],
).enableRLS();
