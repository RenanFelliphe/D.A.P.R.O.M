import { sql } from "drizzle-orm";
import { check, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";
import { equipe, usuario } from "./usuarios";

/** `pendente` até alguém cadastrar a pessoa (`atendida`, ligada à conta criada) ou descartar o pedido. */
export const SOLICITACAO_CONTA_ESTADOS = ["pendente", "atendida", "descartada"] as const;
export type SolicitacaoContaEstado = (typeof SOLICITACAO_CONTA_ESTADOS)[number];

/**
 * O pedido de conta feito na tela de entrada por um funcionário que ainda não tem conta (`funcionalidades/solicitacao-de-conta.md`):
 * o nome, o e-mail e, se ele quiser, a equipe. Avisa os administradores e, com a equipe, quem responde por ela. Quem cadastra
 * a pessoa (`POST /usuarios` com o mesmo e-mail) atende o pedido sozinho. Um pedido pendente por e-mail.
 */
export const solicitacaoConta = pgTable(
  "solicitacao_conta",
  {
    id: uuid().primaryKey().defaultRandom(),
    nome: text().notNull(),
    /** Em minúsculas, como o login. */
    email: text().notNull(),
    equipeId: uuid().references(() => equipe.id, { onDelete: "set null" }),
    estado: text({ enum: SOLICITACAO_CONTA_ESTADOS }).notNull().default("pendente"),
    criadaEm: instante().notNull().defaultNow(),
    /** Quando foi atendida (a conta criada) ou descartada. */
    resolvidaEm: instante(),
    /** Quem cadastrou a pessoa ou descartou o pedido. */
    resolvidaPorId: uuid().references(() => usuario.id),
    /** A conta criada para a pessoa, quando o pedido foi atendido. */
    usuarioId: uuid().references(() => usuario.id),
  },
  (t) => [
    check("solicitacao_conta_estado_check", emLista(t.estado, SOLICITACAO_CONTA_ESTADOS)),
    check("solicitacao_conta_resolucao", sql`(${t.estado} = 'pendente') = (${t.resolvidaEm} is null)`),
    check("solicitacao_conta_atendida_com_conta", sql`(${t.estado} = 'atendida') = (${t.usuarioId} is not null)`),
    uniqueIndex("solicitacao_conta_pendente_email_idx").on(t.email).where(sql`${t.estado} = 'pendente'`),
    index("solicitacao_conta_equipe_idx").on(t.equipeId).where(sql`${t.estado} = 'pendente'`),
    index("solicitacao_conta_criada_idx").on(t.criadaEm),
  ],
).enableRLS();
