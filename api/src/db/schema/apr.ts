import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";
import { itemModeloApr, modeloApr, riscoModeloApr } from "./modelos-apr";
import { os } from "./sap";
import { usuario } from "./usuarios";

export const APR_RESULTADOS = ["aprovada", "bloqueada"] as const;
export const APR_FUNCOES = ["responsavel", "executor"] as const;
export const APR_RESPOSTAS = ["sim", "nao", "na"] as const;

/**
 * Uma APR vale para uma única OS e ampara uma única Execução (decisão-chave 4, `docs/especificacao.md`, seção 2.4).
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
    /**
     * Cópia da assinatura do perfil no momento em que o participante assinou a APR na própria conta (Reunião 3). Nula enquanto
     * ele não assinou (a APR registrada espera a assinatura de todos) e em quem recusou.
     */
    assinaturaPath: text(),
    assinadaEm: instante(),
    /**
     * A assinatura foi dada no aparelho do responsável (o modo offline, que é contingência) e não na conta de quem assina. As
     * APRs anteriores à Reunião 3 foram todas assim.
     */
    assinaturaPresencial: boolean().notNull().default(false),
    /** Direito de recusa: o participante não concordou, saiu da APR e deixou o motivo. Ele não conta como participante nem assina. */
    recusouEm: instante(),
    recusaMotivo: text(),
  },
  (t) => [
    primaryKey({ name: "apr_participante_pkey", columns: [t.aprId, t.usuarioId] }),
    check("apr_participante_funcao_check", emLista(t.funcao, APR_FUNCOES)),
    check("apr_participante_assinatura_completa", sql`(${t.assinaturaPath} is null) = (${t.assinadaEm} is null)`),
    check("apr_participante_recusa_completa", sql`(${t.recusouEm} is null) = (${t.recusaMotivo} is null) and (${t.recusouEm} is null or ${t.assinadaEm} is null)`),
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
