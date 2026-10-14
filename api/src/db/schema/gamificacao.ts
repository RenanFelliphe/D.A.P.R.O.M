import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, numeric, pgTable, primaryKey, text, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";
import { os } from "./sap";
import { equipe, usuario } from "./usuarios";

/**
 * Gamificação (decisões em `gameficacao.md`): o extrato de pontos (`lancamento_pontos`), as temporadas (trimestres), as
 * patentes, as conquistas e o fechamento de cada temporada. Só o servidor grava; nenhum cliente envia pontuação.
 */

/** As tarefas que pontuam. São fixas no código: o admin muda só o valor e o estado de cada uma (`regra_pontuacao`). */
export const REGRA_CODIGOS = [
  "apr_completa",
  "responsavel_apr",
  "execucao_concluida",
  "preventiva_em_dia",
  "local_critico",
  "resgate",
  "apoio",
  "tecnico_novo",
  "assinatura_cadastrada",
  "treinamento_concluido",
  "ciencia_no_prazo",
  "intervalo_definido",
  "conquista_obtida",
] as const;
export type RegraCodigo = (typeof REGRA_CODIGOS)[number];

/** Critérios de meta das conquistas de pessoa e de equipe (seção 7.3 do planner). */
export const CRITERIOS_DE_PESSOA = [
  "aprs_completas",
  "responsavel_apr",
  "execucoes_concluidas",
  "preventivas_em_dia",
  "locais_criticos",
  "os_retomadas",
  "os_apoio",
  "tecnicos_novos",
  "locais_diferentes",
  "ciencias_no_prazo",
  "intervalos_definidos",
  "campo_de_treino",
  "pontos_gerais",
  "pontos_numa_temporada",
  "patente",
  "posicao",
  "temporadas",
] as const;
export const CRITERIOS_DE_EQUIPE = [
  "aprs_da_equipe",
  "execucoes_da_equipe",
  "preventivas_em_dia_da_equipe",
  "pontos_gerais_da_equipe",
  "patente_da_equipe",
  "posicao_da_equipe",
  "temporadas_impecaveis",
] as const;
export const CRITERIOS = [...CRITERIOS_DE_PESSOA, ...CRITERIOS_DE_EQUIPE] as const;
export type Criterio = (typeof CRITERIOS)[number];
export type CriterioDePessoa = (typeof CRITERIOS_DE_PESSOA)[number];
export type CriterioDeEquipe = (typeof CRITERIOS_DE_EQUIPE)[number];

/** Os critérios que escolhem uma patente como meta (os demais têm só a quantidade). */
export const CRITERIOS_DE_PATENTE = ["patente", "patente_da_equipe"] as const;

/** Uma tarefa que pontua e o valor que o admin definiu. A carga inicial (migração) traz as 13, com os valores da seção 2. */
export const regraPontuacao = pgTable(
  "regra_pontuacao",
  {
    codigo: text().primaryKey(),
    nome: text().notNull(),
    descricao: text().notNull(),
    /** `conquista_obtida` não tem valor próprio: os pontos vêm de cada conquista, e desativá-la desliga os pontos de todas. */
    pontos: integer().notNull().default(0),
    ativa: boolean().notNull().default(true),
    atualizadaEm: instante().notNull().defaultNow(),
    atualizadaPor: uuid().references(() => usuario.id),
  },
  (t) => [
    check("regra_pontuacao_codigo_check", emLista(t.codigo, REGRA_CODIGOS)),
    check("regra_pontuacao_pontos_check", sql`${t.pontos} between 0 and 1000`),
  ],
).enableRLS();

/**
 * Um trimestre do calendário, no fuso de São Paulo (`2026-T4` = Primavera 2026). A linha nasce quando a primeira pontuação do
 * trimestre chega e é fechada 7 dias depois do último dia (`fechada_em`), quando `temporada_usuario` e `temporada_equipe`
 * guardam o resultado.
 */
export const temporada = pgTable(
  "temporada",
  {
    codigo: text().primaryKey(),
    nome: text().notNull(),
    inicio: date({ mode: "string" }).notNull(),
    fim: date({ mode: "string" }).notNull(),
    fechadaEm: instante(),
  },
  (t) => [
    check("temporada_codigo_check", sql`${t.codigo} ~ '^[0-9]{4}-T[1-4]$'`),
    check("temporada_fim_apos_inicio", sql`${t.fim} > ${t.inicio}`),
  ],
).enableRLS();

/**
 * O extrato de pontos: cada pontuação é uma linha, gravada pelo servidor na mesma transação que grava o que a gerou. A chave
 * (`apr:<os>`, `execucao:<os>`, `assinatura`, `conquista:<id>`…) é única por pessoa, então o limite de cada tarefa e a proteção
 * contra reenvio são a mesma restrição. Guarda os pontos do momento: mudar o valor de uma tarefa não altera o que já foi lançado.
 */
export const lancamentoPontos = pgTable(
  "lancamento_pontos",
  {
    id: uuid().primaryKey().defaultRandom(),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    regra: text()
      .notNull()
      .references(() => regraPontuacao.codigo),
    pontos: integer().notNull(),
    chave: text().notNull(),
    /** A OS que gerou a pontuação; nula nas boas-vindas, no intervalo de preventiva e nas conquistas. */
    osId: uuid().references(() => os.id),
    /** Quando a tarefa aconteceu (a data que define a temporada). */
    ocorridoEm: instante().notNull(),
    temporada: text()
      .notNull()
      .references(() => temporada.codigo),
    criadoEm: instante().notNull().defaultNow(),
  },
  (t) => [
    unique("lancamento_pontos_usuario_chave_key").on(t.usuarioId, t.chave),
    check("lancamento_pontos_pontos_check", sql`${t.pontos} >= 0`),
    index("lancamento_pontos_temporada_usuario_idx").on(t.temporada, t.usuarioId),
    index("lancamento_pontos_usuario_data_idx").on(t.usuarioId, t.ocorridoEm.desc()),
    index("lancamento_pontos_regra_idx").on(t.regra, t.usuarioId),
    index("lancamento_pontos_os_idx").on(t.osId).where(sql`${t.osId} is not null`),
  ],
).enableRLS();

/** As equipes creditadas por um lançamento: a equipe da pessoa naquele momento e as que ela supervisionava. */
export const lancamentoEquipe = pgTable(
  "lancamento_equipe",
  {
    lancamentoId: uuid()
      .notNull()
      .references(() => lancamentoPontos.id),
    equipeId: uuid()
      .notNull()
      .references(() => equipe.id),
  },
  (t) => [primaryKey({ name: "lancamento_equipe_pkey", columns: [t.lancamentoId, t.equipeId] }), index("lancamento_equipe_equipe_idx").on(t.equipeId)],
).enableRLS();

/** Os níveis da escada de patentes, cadastrados pelo admin. A patente da pessoa é a de maior pontuação necessária que ela atingiu. */
export const patente = pgTable(
  "patente",
  {
    id: uuid().primaryKey().defaultRandom(),
    nome: text().notNull().unique(),
    pontosNecessarios: integer().notNull(),
    /** Imagem no bucket `gamificacao`. */
    imagemPath: text().notNull(),
    /** Hexadecimal (`#CD7F32`): destaca o nome e a barra de progresso. */
    cor: text().notNull(),
    descricao: text(),
    /** A desativada deixa de ser atribuída, mas continua no histórico. */
    ativa: boolean().notNull().default(true),
    criadaEm: instante().notNull().defaultNow(),
    atualizadaEm: instante().notNull().defaultNow(),
  },
  (t) => [
    check("patente_pontos_check", sql`${t.pontosNecessarios} >= 0`),
    check("patente_cor_check", sql`${t.cor} ~ '^#[0-9A-Fa-f]{6}$'`),
    check("patente_nome_preenchido", sql`btrim(${t.nome}) <> ''`),
    uniqueIndex("patente_pontos_ativas_idx").on(t.pontosNecessarios).where(sql`${t.ativa}`),
  ],
).enableRLS();

/** Os troféus (de pessoa ou de equipe, conforme o critério). Permanentes: não zeram com a temporada. */
export const conquista = pgTable(
  "conquista",
  {
    id: uuid().primaryKey().defaultRandom(),
    titulo: text().notNull().unique(),
    descricao: text().notNull(),
    criterio: text({ enum: CRITERIOS }).notNull(),
    quantidade: integer().notNull().default(1),
    /** Só nos critérios de patente (a meta é alcançar essa patente). */
    patenteId: uuid().references(() => patente.id),
    /** O que a pessoa ganha ao obter a conquista; sempre 0 nas de equipe. */
    pontos: integer().notNull().default(0),
    imagemPath: text().notNull(),
    ativa: boolean().notNull().default(true),
    criadaEm: instante().notNull().defaultNow(),
    criadaPor: uuid().references(() => usuario.id),
  },
  (t) => [
    check("conquista_criterio_check", emLista(t.criterio, CRITERIOS)),
    check("conquista_quantidade_check", sql`${t.quantidade} >= 1`),
    check("conquista_pontos_check", sql`${t.pontos} between 0 and 1000`),
    check("conquista_titulo_preenchido", sql`btrim(${t.titulo}) <> ''`),
    check("conquista_patente_so_no_criterio", sql`(${t.criterio} in ('patente', 'patente_da_equipe')) = (${t.patenteId} is not null)`),
    check(
      "conquista_equipe_sem_pontos",
      sql`${t.pontos} = 0 or ${t.criterio} not in ('aprs_da_equipe', 'execucoes_da_equipe', 'preventivas_em_dia_da_equipe', 'pontos_gerais_da_equipe', 'patente_da_equipe', 'posicao_da_equipe', 'temporadas_impecaveis')`,
    ),
    index("conquista_patente_idx").on(t.patenteId).where(sql`${t.patenteId} is not null`),
  ],
).enableRLS();

/** A conquista de pessoa obtida; `vista_em` nulo é o aviso "Conquista desbloqueada" ainda pendente. */
export const conquistaUsuario = pgTable(
  "conquista_usuario",
  {
    conquistaId: uuid()
      .notNull()
      .references(() => conquista.id),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    obtidaEm: instante().notNull(),
    vistaEm: instante(),
  },
  (t) => [
    primaryKey({ name: "conquista_usuario_pkey", columns: [t.conquistaId, t.usuarioId] }),
    index("conquista_usuario_usuario_idx").on(t.usuarioId),
    index("conquista_usuario_pendentes_idx").on(t.usuarioId).where(sql`${t.vistaEm} is null`),
  ],
).enableRLS();

export const conquistaEquipe = pgTable(
  "conquista_equipe",
  {
    conquistaId: uuid()
      .notNull()
      .references(() => conquista.id),
    equipeId: uuid()
      .notNull()
      .references(() => equipe.id),
    obtidaEm: instante().notNull(),
  },
  (t) => [primaryKey({ name: "conquista_equipe_pkey", columns: [t.conquistaId, t.equipeId] }), index("conquista_equipe_equipe_idx").on(t.equipeId)],
).enableRLS();

/** O resultado de cada pessoa numa temporada fechada: pontos, patente e posição como ficaram no fechamento. */
export const temporadaUsuario = pgTable(
  "temporada_usuario",
  {
    temporada: text()
      .notNull()
      .references(() => temporada.codigo),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    pontos: integer().notNull(),
    patenteId: uuid().references(() => patente.id),
    posicao: integer().notNull(),
  },
  (t) => [primaryKey({ name: "temporada_usuario_pkey", columns: [t.temporada, t.usuarioId] }), index("temporada_usuario_usuario_idx").on(t.usuarioId)],
).enableRLS();

/**
 * O resultado de cada equipe numa temporada fechada: a soma, o número de pessoas e a média por membro (que define a patente e a
 * posição). `impecavel`: a equipe teve preventivas no trimestre e nenhuma ficou atrasada sem justificativa.
 */
export const temporadaEquipe = pgTable(
  "temporada_equipe",
  {
    temporada: text()
      .notNull()
      .references(() => temporada.codigo),
    equipeId: uuid()
      .notNull()
      .references(() => equipe.id),
    pontos: integer().notNull(),
    membros: integer().notNull(),
    media: numeric({ precision: 12, scale: 2, mode: "number" }).notNull(),
    patenteId: uuid().references(() => patente.id),
    posicao: integer().notNull(),
    impecavel: boolean().notNull().default(false),
  },
  (t) => [primaryKey({ name: "temporada_equipe_pkey", columns: [t.temporada, t.equipeId] }), index("temporada_equipe_equipe_idx").on(t.equipeId)],
).enableRLS();
