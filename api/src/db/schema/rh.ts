import { sql } from "drizzle-orm";
import { check, date, index, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";
import { usuario } from "./usuarios";

/** Situações de um funcionário no registro (`apifuncionarios.md`, seção 2.2). */
export const SITUACOES_FUNCIONARIO = ["ativo", "afastado", "desligado"] as const;
export type SituacaoFuncionario = (typeof SITUACOES_FUNCIONARIO)[number];

/**
 * O registro de funcionários simulado: o que o RH da empresa teria, com os dados fictícios que o SYNC OS consulta para
 * cadastrar usuários e saber de desligamentos. Fica no banco do SYNC OS (e não na memória) para sobreviver a um reinício, mas
 * não tem chave para nenhuma tabela do SYNC OS: o vínculo com `usuario` é só a matrícula, como seria com o RH de verdade. Vazia
 * quando `RH_SIMULADO=false`.
 */
export const funcionarioSimulado = pgTable(
  "funcionario_simulado",
  {
    /** Única e fixa depois de criada: é o vínculo com o SYNC OS. */
    matricula: text().primaryKey(),
    nome: text().notNull(),
    /** Institucional, em minúsculas: é o login no SYNC OS. */
    email: text().notNull().unique(),
    cargo: text().notNull(),
    /** Código do centro de trabalho; casa com `equipe.centro_trabalho`. */
    centroTrabalho: text().notNull(),
    setor: text().notNull(),
    registroProfissional: text(),
    situacao: text({ enum: SITUACOES_FUNCIONARIO }).notNull().default("ativo"),
    dataAdmissao: date({ mode: "string" }),
    dataNascimento: date({ mode: "string" }),
    telefone: text(),
    /** Matrícula de outro funcionário, sem chave estrangeira. */
    gestorMatricula: text(),
    lotacao: text(),
    criadoEm: instante().notNull().defaultNow(),
    alteradoEm: instante().notNull().defaultNow(),
  },
  (t) => [
    check("funcionario_simulado_situacao_check", emLista(t.situacao, SITUACOES_FUNCIONARIO)),
    check("funcionario_simulado_email_minusculo", sql`${t.email} = lower(${t.email})`),
  ],
).enableRLS();

export const ORIGENS_LEITURA_RH = ["agendada", "manual"] as const;

/**
 * Histórico das leituras completas do registro (a diária e o "Ler agora"). A leitura agendada ocupa o `dia` (no fuso de São
 * Paulo) e o índice único garante uma só por dia, mesmo que a `api` reinicie ou que duas instâncias disputem.
 */
export const leituraRh = pgTable(
  "leitura_rh",
  {
    id: uuid().primaryKey().defaultRandom(),
    origem: text({ enum: ORIGENS_LEITURA_RH }).notNull(),
    /** Quem pediu o "Ler agora"; nulo na agendada. */
    usuarioId: uuid().references(() => usuario.id, { onDelete: "set null" }),
    /** `AAAA-MM-DD` de São Paulo; só na leitura agendada. */
    dia: date({ mode: "string" }),
    iniciadaEm: instante().notNull().defaultNow(),
    /** Nulo enquanto a leitura não terminou (ou está tentando de novo depois de uma falha). */
    concluidaEm: instante(),
    conferidos: integer().notNull().default(0),
    atualizados: integer().notNull().default(0),
    desativados: integer().notNull().default(0),
    erro: text(),
  },
  (t) => [
    check("leitura_rh_origem_check", emLista(t.origem, ORIGENS_LEITURA_RH)),
    uniqueIndex("leitura_rh_dia_unico").on(t.dia).where(sql`${t.dia} is not null`),
    index("leitura_rh_iniciada_idx").on(t.iniciadaEm.desc()),
  ],
).enableRLS();
