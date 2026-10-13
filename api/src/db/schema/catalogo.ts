import { sql } from "drizzle-orm";
import { boolean, check, index, integer, numeric, pgTable, primaryKey, text, unique, uuid } from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";
import { atividade } from "./modelos-apr";

/** `material`: consumo e peças; `ferramenta`: ferramentas e instrumentos; `epi`: equipamento de proteção individual. */
export const MATERIAL_CATEGORIAS = ["material", "ferramenta", "epi"] as const;
export type MaterialCategoria = (typeof MATERIAL_CATEGORIAS)[number];

/**
 * Catálogo de materiais, ferramentas e EPIs, mantido pelo admin. Cada serviço do catálogo (a `atividade` do plano de
 * manutenção) lista os que usa, em `atividade_material`.
 */
export const material = pgTable(
  "material",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Código do material no SAP, quando existe (ex.: 10002345). */
    codigo: text().unique(),
    descricao: text().notNull(),
    /** Unidade de medida: un, m, kg, L, par… */
    unidade: text().notNull(),
    categoria: text({ enum: MATERIAL_CATEGORIAS }).notNull().default("material"),
    /** Desativado: não pode entrar em mais nenhum serviço, mas continua nos que já o listam. */
    ativo: boolean().notNull().default(true),
    criadoEm: instante().notNull().defaultNow(),
  },
  (t) => [
    check("material_categoria_check", emLista(t.categoria, MATERIAL_CATEGORIAS)),
    check("material_descricao_preenchida", sql`btrim(${t.descricao}) <> ''`),
    check("material_unidade_preenchida", sql`btrim(${t.unidade}) <> ''`),
  ],
).enableRLS();

/**
 * O que um serviço usa: a lista de materiais da atividade, na ordem em que aparece na OS. A OS chega ao serviço pelo
 * código da atividade (`os.codigo_atividade`), o mesmo que escolhe o modelo de APR.
 */
export const atividadeMaterial = pgTable(
  "atividade_material",
  {
    atividadeCodigo: text()
      .notNull()
      .references(() => atividade.codigo, { onDelete: "cascade" }),
    materialId: uuid()
      .notNull()
      .references(() => material.id),
    /** Quantidade prevista por execução, na unidade do material; nula = conforme a necessidade. */
    quantidade: numeric({ precision: 12, scale: 3, mode: "number" }),
    /** Ex.: "só se houver vazamento". */
    observacao: text(),
    ordem: integer().notNull(),
  },
  (t) => [
    primaryKey({ name: "atividade_material_pkey", columns: [t.atividadeCodigo, t.materialId] }),
    unique("atividade_material_atividade_codigo_ordem_key").on(t.atividadeCodigo, t.ordem),
    check("atividade_material_quantidade_check", sql`${t.quantidade} is null or ${t.quantidade} > 0`),
    index("atividade_material_material_idx").on(t.materialId),
  ],
).enableRLS();
