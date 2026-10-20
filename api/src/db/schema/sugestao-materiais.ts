import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, numeric, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";
import { MATERIAL_CATEGORIAS, material } from "./catalogo";
import { atividade } from "./modelos-apr";
import { equipe, usuario } from "./usuarios";

/** `sugestao`: lista nova ou corrigida; `contestacao`: "esta lista recomendada está errada", com o motivo e, se quiser, a lista certa. */
export const SUGESTAO_TIPOS = ["sugestao", "contestacao"] as const;
export type SugestaoTipo = (typeof SUGESTAO_TIPOS)[number];

export const SUGESTAO_ESTADOS = ["pendente", "aceita", "recusada", "cancelada"] as const;
export type SugestaoEstado = (typeof SUGESTAO_ESTADOS)[number];

/**
 * A sugestão (ou contestação) de uma pessoa sobre a lista de materiais de um serviço (`funcionalidades/sugestao-de-materiais.md`).
 * Quem avalia é o supervisor da equipe que mais faz o serviço, guardada aqui no envio (`equipe_responsavel_id`); sem equipe
 * (o serviço sem nenhuma OS), avalia o admin. Aceita, a lista passa a ser a do serviço (`atividade_material`).
 */
export const sugestaoMateriais = pgTable(
  "sugestao_materiais",
  {
    id: uuid().primaryKey().defaultRandom(),
    atividadeCodigo: text()
      .notNull()
      .references(() => atividade.codigo, { onDelete: "cascade" }),
    tipo: text({ enum: SUGESTAO_TIPOS }).notNull(),
    estado: text({ enum: SUGESTAO_ESTADOS }).notNull().default("pendente"),
    autorId: uuid()
      .notNull()
      .references(() => usuario.id),
    /** A equipe que mais faz o serviço quando a sugestão foi enviada; nula quando nenhuma equipe tem OS dele (avalia o admin). */
    equipeResponsavelId: uuid().references(() => equipe.id),
    /** Obrigatório na contestação; na sugestão, opcional ("por que mudar"). */
    motivo: text(),
    /** A contestação pode vir sem lista nova; a sugestão sempre traz. */
    temLista: boolean().notNull(),
    /** A lista do serviço no envio (`[{material_id, quantidade, observacao}]`): a base da diferença e do aviso "a lista mudou desde então". */
    listaBase: jsonb().notNull(),
    criadaEm: instante().notNull().defaultNow(),
    avaliadaPor: uuid().references(() => usuario.id),
    avaliadaEm: instante(),
    /** Obrigatória na recusa; opcional na aceitação. */
    resposta: text(),
    /** Aceita com a lista mudada pelo avaliador. */
    ajustada: boolean().notNull().default(false),
  },
  (t) => [
    check("sugestao_materiais_tipo_check", emLista(t.tipo, SUGESTAO_TIPOS)),
    check("sugestao_materiais_estado_check", emLista(t.estado, SUGESTAO_ESTADOS)),
    check("sugestao_materiais_contestacao_com_motivo", sql`${t.tipo} <> 'contestacao' or nullif(btrim(${t.motivo}), '') is not null`),
    check("sugestao_materiais_sugestao_com_lista", sql`${t.tipo} <> 'sugestao' or ${t.temLista}`),
    check("sugestao_materiais_avaliacao_completa", sql`(${t.estado} in ('aceita', 'recusada')) = (${t.avaliadaEm} is not null and ${t.avaliadaPor} is not null)`),
    check("sugestao_materiais_recusa_com_resposta", sql`${t.estado} <> 'recusada' or nullif(btrim(${t.resposta}), '') is not null`),
    // Uma sugestão pendente por pessoa e serviço: retire ou espere a avaliação antes de enviar outra.
    uniqueIndex("sugestao_materiais_pendente_idx").on(t.autorId, t.atividadeCodigo).where(sql`${t.estado} = 'pendente'`),
    index("sugestao_materiais_atividade_idx").on(t.atividadeCodigo, t.criadaEm.desc()),
    index("sugestao_materiais_equipe_pendentes_idx").on(t.equipeResponsavelId).where(sql`${t.estado} = 'pendente'`),
    index("sugestao_materiais_autor_idx").on(t.autorId, t.criadaEm.desc()),
  ],
).enableRLS();

/**
 * Um item da lista proposta: um material do catálogo (`material_id`) ou um item digitado ("Não achei": `descricao`, `unidade` e
 * `categoria`, sem material). Quem avalia liga o digitado a um material do catálogo ou o cadastra, ao aceitar.
 */
export const sugestaoMateriaisItem = pgTable(
  "sugestao_materiais_item",
  {
    sugestaoId: uuid()
      .notNull()
      .references(() => sugestaoMateriais.id, { onDelete: "cascade" }),
    ordem: integer().notNull(),
    /** Cascata: o material excluído some das sugestões já avaliadas (a exclusão recusa o que está numa pendente). */
    materialId: uuid().references(() => material.id, { onDelete: "cascade" }),
    descricao: text(),
    unidade: text(),
    categoria: text({ enum: MATERIAL_CATEGORIAS }),
    quantidade: numeric({ precision: 12, scale: 3, mode: "number" }),
    observacao: text(),
  },
  (t) => [
    primaryKey({ name: "sugestao_materiais_item_pkey", columns: [t.sugestaoId, t.ordem] }),
    check("sugestao_materiais_item_categoria_check", sql`${t.categoria} is null or ${emLista(t.categoria, MATERIAL_CATEGORIAS)}`),
    check(
      "sugestao_materiais_item_origem",
      sql`(${t.materialId} is not null and ${t.descricao} is null and ${t.unidade} is null and ${t.categoria} is null) or (${t.materialId} is null and nullif(btrim(${t.descricao}), '') is not null and nullif(btrim(${t.unidade}), '') is not null and ${t.categoria} is not null)`,
    ),
    check("sugestao_materiais_item_quantidade_check", sql`${t.quantidade} is null or ${t.quantidade} > 0`),
    index("sugestao_materiais_item_material_idx").on(t.materialId).where(sql`${t.materialId} is not null`),
  ],
).enableRLS();
