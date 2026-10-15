import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";
import { usuario } from "./usuarios";

/**
 * Unidade do intervalo entre ciclos: `n` dias, semanas, quinzenas (15 dias), meses, bimestres, trimestres, semestres ou anos.
 * As unidades de mês em diante somam meses de calendário (31/01 + 1 mês = 28/02 ou 29/02).
 */
export const INTERVALO_UNIDADES = ["dia", "semana", "quinzena", "mes", "bimestre", "trimestre", "semestre", "ano"] as const;
export type IntervaloUnidade = (typeof INTERVALO_UNIDADES)[number];

/**
 * De onde o próximo ciclo é contado: do encerramento da última OS do plano (`execucao`: o ciclo só recomeça quando a
 * equipe executa) ou da data programada dela (`programacao`: o calendário fixo do plano, mesmo que a OS atrase).
 */
export const CICLO_BASES = ["execucao", "programacao"] as const;
export type CicloBase = (typeof CICLO_BASES)[number];

/**
 * O ciclo de uma preventiva: o plano e o item de manutenção do SAP (a OS preventiva traz os dois) e o intervalo entre um
 * ciclo e outro. O sistema não cria OS: quando o próximo ciclo se aproxima ou vence sem OS nova do plano, ele avisa
 * (alertas `preventiva_proxima` e `preventiva_vencida`) quem planeja. As OS de cada ciclo são as que têm o mesmo plano e
 * item (`os.plano_manutencao`, `os.item_manutencao`); o plano nasce na importação da primeira delas.
 */
export const planoPreventiva = pgTable(
  "plano_preventiva",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Plano de manutenção do SAP (`10573`). */
    planoManutencao: text().notNull(),
    /** Item de manutenção do SAP (`10603`); nulo quando a OS só traz o plano. */
    itemManutencao: text(),
    /** Intervalo entre ciclos; os dois nulos enquanto ninguém o definiu. */
    intervaloQuantidade: integer(),
    intervaloUnidade: text({ enum: INTERVALO_UNIDADES }),
    contarAPartir: text({ enum: CICLO_BASES }).notNull().default("execucao"),
    /** Quantos dias antes do vencimento o alerta de ciclo próximo sai. */
    antecedenciaDias: integer().notNull().default(7),
    /** Pausado: sem contagem nem alertas (o equipamento saiu de operação, o plano foi suspenso no SAP). */
    ativo: boolean().notNull().default(true),
    observacao: text(),
    /** O vencimento para o qual o alerta de ciclo próximo já saiu (um alerta por ciclo). */
    alertaProximoPara: date({ mode: "string" }),
    /** O vencimento para o qual o alerta de ciclo vencido já saiu. */
    alertaVencidoPara: date({ mode: "string" }),
    criadoEm: instante().notNull().defaultNow(),
    atualizadoEm: instante().notNull().defaultNow(),
    /** Quem mexeu por último no intervalo (nulo quando veio só da importação). */
    atualizadoPor: uuid().references(() => usuario.id),
  },
  (t) => [
    unique("plano_preventiva_plano_item_key").on(t.planoManutencao, t.itemManutencao).nullsNotDistinct(),
    check("plano_preventiva_unidade_check", emLista(t.intervaloUnidade, INTERVALO_UNIDADES)),
    check("plano_preventiva_base_check", emLista(t.contarAPartir, CICLO_BASES)),
    check("plano_preventiva_intervalo_completo", sql`(${t.intervaloQuantidade} is null) = (${t.intervaloUnidade} is null)`),
    check("plano_preventiva_quantidade_check", sql`${t.intervaloQuantidade} is null or ${t.intervaloQuantidade} between 1 and 999`),
    check("plano_preventiva_antecedencia_check", sql`${t.antecedenciaDias} between 0 and 365`),
    check("plano_preventiva_plano_preenchido", sql`btrim(${t.planoManutencao}) <> ''`),
  ],
).enableRLS();

/** Quantas perguntas o checklist de inspeção de um plano pode ter, e o tamanho de cada uma. */
export const CHECKLIST_MAX_PERGUNTAS = 50;
export const CHECKLIST_MAX_TEXTO = 300;

/**
 * O checklist de inspeção de um plano de preventiva: as perguntas que o técnico marca no encerramento de cada OS do plano
 * (ver `inspecao-preventivas.md`). Ficam no plano, ao lado do intervalo, na ordem de `posicao`. A execução não aponta para
 * elas: copia o texto de cada pergunta no momento do encerramento (`execucao.dados_inspecao`), então mudar o checklist depois
 * não altera o que já foi respondido.
 */
export const planoPreventivaPergunta = pgTable(
  "plano_preventiva_pergunta",
  {
    id: uuid().primaryKey().defaultRandom(),
    planoId: uuid()
      .notNull()
      .references(() => planoPreventiva.id),
    texto: text().notNull(),
    posicao: integer().notNull(),
    criadaEm: instante().notNull().defaultNow(),
  },
  (t) => [
    check("plano_preventiva_pergunta_texto_check", sql`btrim(${t.texto}) <> '' and char_length(${t.texto}) <= ${sql.raw(String(CHECKLIST_MAX_TEXTO))}`),
    check("plano_preventiva_pergunta_posicao_check", sql`${t.posicao} >= 0`),
    index("plano_preventiva_pergunta_plano_idx").on(t.planoId, t.posicao),
  ],
).enableRLS();
