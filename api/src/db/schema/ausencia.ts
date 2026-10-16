import { sql } from "drizzle-orm";
import { check, date, index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";
import { equipe, usuario } from "./usuarios";

/**
 * Estados gravados. "Agendada", "em curso" e "vencida" não são gravados: saem das datas da ausência `confirmada` (ver
 * `dominio/ausencia.ts`). `encerrada`, `recusada` e `cancelada` são finais.
 */
export const AUSENCIA_ESTADOS = ["pedida", "aguardando_confirmacao", "confirmada", "encerrada", "recusada", "cancelada"] as const;
export type AusenciaEstado = (typeof AUSENCIA_ESTADOS)[number];

/** Como a ausência nasceu: o técnico pediu, o supervisor registrou a de outra pessoa, ou o supervisor registrou a própria. */
export const AUSENCIA_ORIGENS = ["pedido", "supervisor", "propria"] as const;
export type AusenciaOrigem = (typeof AUSENCIA_ORIGENS)[number];

export const AUSENCIA_FORMAS_DE_ENCERRAMENTO = ["retorno", "antecipada", "supervisor", "emergencia"] as const;
export type AusenciaFormaDeEncerramento = (typeof AUSENCIA_FORMAS_DE_ENCERRAMENTO)[number];

/** Cada ato da linha do tempo da ausência. `inicio` e `cancelamento_automatico` são do sistema (sem autor nem assinatura). */
export const AUSENCIA_ATOS = [
  "pedido",
  "registro",
  "aprovacao",
  "recusa",
  "confirmacao",
  "recusa_ajuste",
  "cancelamento",
  "cancelamento_automatico",
  "inicio",
  "fim_pedido",
  "fim_aprovado",
  "fim_recusado",
  "prorrogacao",
  "encerramento",
  "retorno",
] as const;
export type AusenciaAto = (typeof AUSENCIA_ATOS)[number];

/**
 * O estado "ausente" de um técnico: ele continua ativo e vê o sistema, mas não altera nada, não recebe reserva de OS e não
 * entra em APR. `inicio` e `retorno` são dias (fuso de São Paulo): a ausência vale da 0h do `inicio` até a véspera do
 * `retorno`, o primeiro dia de volta ao trabalho. Ela não termina sozinha: passada a data de retorno fica "vencida" até
 * o retorno ser confirmado ou o supervisor encerrar.
 */
export const ausencia = pgTable(
  "ausencia",
  {
    id: uuid().primaryKey().defaultRandom(),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    /** A equipe da pessoa na hora do pedido: é o supervisor dela quem responde. */
    equipeId: uuid()
      .notNull()
      .references(() => equipe.id),
    /** Quem aprovou ou registrou; nulo enquanto `pedida`. */
    supervisorId: uuid().references(() => usuario.id),
    motivo: text().notNull(),
    inicio: date({ mode: "string" }).notNull(),
    /** O primeiro dia de volta ao trabalho. */
    retorno: date({ mode: "string" }).notNull(),
    /** Os dias corridos que a pessoa informou; nulo quando ela informou a data de retorno. */
    diasInformados: integer(),
    estado: text({ enum: AUSENCIA_ESTADOS }).notNull(),
    origem: text({ enum: AUSENCIA_ORIGENS }).notNull(),
    /** O fim antecipado pedido pelo ausente e ainda sem resposta: a data de retorno que ele quer. */
    fimPedidoData: date({ mode: "string" }),
    fimPedidoEm: instante(),
    /** Quando a ausência chegou a um estado final (`encerrada`, `recusada` ou `cancelada`). */
    encerradaEm: instante(),
    /** Quem a encerrou; nulo quando foi o sistema (pedido parado que venceu). */
    encerradaPor: uuid().references(() => usuario.id),
    formaEncerramento: text({ enum: AUSENCIA_FORMAS_DE_ENCERRAMENTO }),
    /** Quando o sistema aplicou o início (desfez as reservas e suspendeu a execução aberta); a tarefa periódica não repete. */
    inicioAplicadoEm: instante(),
    /** Quando o supervisor foi avisado de que a data de retorno chegou. */
    vencidaAvisadaEm: instante(),
    criadaEm: instante().notNull().defaultNow(),
  },
  (t) => [
    check("ausencia_estado_check", emLista(t.estado, AUSENCIA_ESTADOS)),
    check("ausencia_origem_check", emLista(t.origem, AUSENCIA_ORIGENS)),
    check("ausencia_forma_encerramento_check", emLista(t.formaEncerramento, AUSENCIA_FORMAS_DE_ENCERRAMENTO)),
    check("ausencia_periodo", sql`${t.retorno} > ${t.inicio}`),
    check("ausencia_motivo_check", sql`nullif(btrim(${t.motivo}), '') is not null and char_length(${t.motivo}) <= 500`),
    check("ausencia_dias_check", sql`${t.diasInformados} is null or ${t.diasInformados} between 1 and 365`),
    check(
      "ausencia_encerramento_coerente",
      sql`(${t.estado} in ('encerrada', 'recusada', 'cancelada')) = (${t.encerradaEm} is not null) and (${t.estado} = 'encerrada') = (${t.formaEncerramento} is not null)`,
    ),
    check("ausencia_supervisor_check", sql`${t.estado} not in ('aguardando_confirmacao', 'confirmada') or ${t.supervisorId} is not null`),
    check("ausencia_fim_pedido_completo", sql`(${t.fimPedidoEm} is null) = (${t.fimPedidoData} is null)`),
    index("ausencia_usuario_idx").on(t.usuarioId, t.inicio.desc()),
    index("ausencia_equipe_idx").on(t.equipeId, t.inicio.desc()),
    // As abertas de cada pessoa (a sobreposição e o bloqueio do ausente leem só estas).
    index("ausencia_abertas_idx").on(t.usuarioId).where(sql`${t.estado} in ('pedida', 'aguardando_confirmacao', 'confirmada')`),
    // O que a tarefa periódica varre: as confirmadas por início.
    index("ausencia_confirmadas_idx").on(t.inicio).where(sql`${t.estado} = 'confirmada'`),
  ],
).enableRLS();

/** A linha do tempo da ausência: um ato por linha, com quem fez, a assinatura usada e os dados do ato (datas antigas e novas, motivo). */
export const ausenciaAto = pgTable(
  "ausencia_ato",
  {
    id: uuid().primaryKey().defaultRandom(),
    ausenciaId: uuid()
      .notNull()
      .references(() => ausencia.id),
    tipo: text({ enum: AUSENCIA_ATOS }).notNull(),
    /** Nulo nos atos do sistema. */
    autorId: uuid().references(() => usuario.id),
    em: instante().notNull().defaultNow(),
    /** Cópia da imagem da assinatura do perfil usada no ato (como em `execucao_assinatura`); nula nos atos sem assinatura. */
    assinaturaPath: text(),
    dados: jsonb(),
  },
  (t) => [
    check("ausencia_ato_tipo_check", emLista(t.tipo, AUSENCIA_ATOS)),
    index("ausencia_ato_ausencia_idx").on(t.ausenciaId, t.em),
  ],
).enableRLS();
