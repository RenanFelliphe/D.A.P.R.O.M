import { sql } from "drizzle-orm";
import { boolean, check, index, numeric, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { material } from "./catalogo";
import { emLista, instante } from "./comum";
import { itemModeloApr, modeloApr, riscoModeloApr } from "./modelos-apr";
import { os } from "./sap";
import { usuario } from "./usuarios";

export const APR_RESULTADOS = ["aprovada", "bloqueada"] as const;
export const APR_FUNCOES = ["responsavel", "executor"] as const;
export const APR_RESPOSTAS = ["sim", "nao", "na"] as const;

/**
 * Uma APR vale para uma única OS e ampara uma única Execução (Decisão-chave 4).
 * Os ids nascem no cliente (app ou navegador), por isso não têm default: reenviar o mesmo id não duplica.
 * `resultado` é recalculado no servidor a partir das respostas e da versão do modelo.
 */
export const apr = pgTable(
  "apr",
  {
    id: uuid().primaryKey(),
    osId: uuid()
      .notNull()
      .references(() => os.id),
    /** Versão exata do modelo que foi respondida. */
    modeloAprId: uuid()
      .notNull()
      .references(() => modeloApr.id),
    preenchidaPor: uuid()
      .notNull()
      .references(() => usuario.id),
    resultado: text({ enum: APR_RESULTADOS }).notNull(),
    observacaoGeral: text(),
    /** Também define o dia de validade. */
    concluidaEm: instante().notNull(),
  },
  (t) => [
    check("apr_resultado_check", emLista(t.resultado, APR_RESULTADOS)),
    index("apr_os_idx").on(t.osId, t.concluidaEm.desc()),
    index("apr_preenchida_por_idx").on(t.preenchidaPor),
    index("apr_modelo_idx").on(t.modeloAprId),
  ],
).enableRLS();

export const aprParticipante = pgTable(
  "apr_participante",
  {
    aprId: uuid()
      .notNull()
      .references(() => apr.id),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    funcao: text({ enum: APR_FUNCOES }).notNull(),
    /** Cópia da assinatura do perfil no momento da confirmação. */
    assinaturaPath: text().notNull(),
    assinadaEm: instante().notNull(),
  },
  (t) => [
    primaryKey({ name: "apr_participante_pkey", columns: [t.aprId, t.usuarioId] }),
    check("apr_participante_funcao_check", emLista(t.funcao, APR_FUNCOES)),
    // Exatamente um responsável por APR (o que o papel chama de "Supervisor da Atividade").
    uniqueIndex("apr_um_responsavel_idx").on(t.aprId).where(sql`${t.funcao} = 'responsavel'`),
    index("apr_participante_usuario_idx").on(t.usuarioId),
  ],
).enableRLS();

/** Os riscos que a equipe marcou "( )" na APR. A api só exige resposta nas medidas desses riscos. */
export const aprRisco = pgTable(
  "apr_risco",
  {
    aprId: uuid()
      .notNull()
      .references(() => apr.id),
    riscoId: uuid()
      .notNull()
      .references(() => riscoModeloApr.id),
  },
  (t) => [
    primaryKey({ name: "apr_risco_pkey", columns: [t.aprId, t.riscoId] }),
    index("apr_risco_risco_idx").on(t.riscoId),
  ],
).enableRLS();

export const aprResposta = pgTable(
  "apr_resposta",
  {
    aprId: uuid()
      .notNull()
      .references(() => apr.id),
    itemId: uuid()
      .notNull()
      .references(() => itemModeloApr.id),
    resposta: text({ enum: APR_RESPOSTAS }).notNull(),
    /** Obrigatória no item reprovado (a api confere) e no `na`. */
    observacao: text(),
    respondidaEm: instante().notNull(),
  },
  (t) => [
    primaryKey({ name: "apr_resposta_pkey", columns: [t.aprId, t.itemId] }),
    check("apr_resposta_resposta_check", emLista(t.resposta, APR_RESPOSTAS)),
    check("apr_resposta_na_com_observacao", sql`${t.resposta} <> 'na' or nullif(btrim(${t.observacao}), '') is not null`),
    index("apr_resposta_item_idx").on(t.itemId),
  ],
).enableRLS();

/**
 * A conferência dos materiais do serviço, feita no fim do checklist: para cada item da lista da atividade da OS, se o
 * técnico o levou e, no item obrigatório, a foto que comprova. `obrigatorio` guarda o que a lista dizia na hora da APR
 * (o admin pode mudar a lista depois). O servidor decide: obrigatório sem foto, ou não levado, bloqueia a APR.
 */
export const aprMaterial = pgTable(
  "apr_material",
  {
    aprId: uuid()
      .notNull()
      .references(() => apr.id),
    materialId: uuid()
      .notNull()
      .references(() => material.id),
    obrigatorio: boolean().notNull(),
    levou: boolean().notNull(),
    /** Id do arquivo da foto do item em mãos (bucket `fotos`). */
    fotoPath: text(),
    capturadaEm: instante(),
    latitude: numeric({ precision: 9, scale: 6, mode: "number" }),
    longitude: numeric({ precision: 9, scale: 6, mode: "number" }),
  },
  (t) => [
    primaryKey({ name: "apr_material_pkey", columns: [t.aprId, t.materialId] }),
    check("apr_material_foto_so_se_levou", sql`${t.levou} or ${t.fotoPath} is null`),
    check("apr_material_foto_completa", sql`(${t.fotoPath} is null) = (${t.capturadaEm} is null)`),
    check("apr_material_gps_completo", sql`(${t.latitude} is null) = (${t.longitude} is null)`),
    check("apr_material_latitude_check", sql`${t.latitude} between -90 and 90`),
    check("apr_material_longitude_check", sql`${t.longitude} between -180 and 180`),
    index("apr_material_material_idx").on(t.materialId),
  ],
).enableRLS();
