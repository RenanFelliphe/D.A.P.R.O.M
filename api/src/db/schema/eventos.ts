import { sql } from "drizzle-orm";
import { boolean, check, index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";
import { execucao } from "./execucao";
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
  /** Execução compartilhada: um participante pede ao responsável para encerrar ou suspender; o responsável decide; o solicitante desiste; outro participante apoia. */
  "pedido_aberto",
  "pedido_decidido",
  "pedido_cancelado",
  "pedido_apoiado",
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
    /**
     * Chegou da fila offline: o atraso entre `ocorrido_em` e `recebido_em` passou de `ATRASO_OFFLINE_MS` (60 s). É a `api` quem decide, pelo
     * relógio dela, nunca o aparelho; só os eventos aplicados chegam aqui (o recusado desfaz a própria transação). Alimenta a conquista
     * de sincronização offline.
     */
    offline: boolean().notNull().default(false),
    /**
     * A execução de que o evento trata (execução compartilhada, etapa 3): a `api` a anota ao aplicar o evento, para comparar o que cada
     * aparelho registrou. Nulo nos eventos que não são de execução e nos anteriores a esta coluna.
     */
    execucaoId: uuid().references(() => execucao.id),
    /**
     * O evento veio da fila offline e conflitou com o que outro aparelho já tinha registrado (duas pausas abertas, dois fins): não é
     * recusado nem muda a execução; fica guardado como a versão de quem o fez, para a conferência comparar. A sincronização nunca descarta dado de campo.
     */
    soVersao: boolean().notNull().default(false),
  },
  (t) => [
    check("evento_campo_tipo_check", emLista(t.tipo, EVENTO_TIPOS)),
    index("evento_campo_execucao_idx").on(t.execucaoId, t.ocorridoEm).where(sql`${t.execucaoId} is not null`),
    // O id local da execução que outro aparelho iniciou (`resolverExecucaoId`) e o da pausa que ficou como versão.
    index("evento_campo_id_do_payload_idx")
      .on(sql`(${t.payload}->>'id')`)
      .where(sql`${t.tipo} in ('execucao_iniciada', 'pausa_iniciada')`),
    index("evento_campo_os_idx").on(t.osId, t.ocorridoEm),
    index("evento_campo_usuario_idx").on(t.usuarioId, t.recebidoEm.desc()),
  ],
).enableRLS();
