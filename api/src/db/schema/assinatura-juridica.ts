import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { SITUACOES_DA_ASSINATURA_JURIDICA } from "../../../../shared/api/assinatura-juridica";
import { emLista, instante } from "./comum";
import { os } from "./sap";
import { usuario } from "./usuarios";

/**
 * Uma assinatura com validade jurídica (`docs/pessoas-e-equipes.md`, seção 3.3): o documento (o termo do ato, em PDF) que a pessoa
 * assina no provedor (ZapSign). Serve a **um** ato só: quando o ato chega à `api` com o código dela, a `api` confere (é da pessoa,
 * está assinada, é recente, não foi usada) e grava `usada_em` e `ato` (o ato que a usou), que ficam como trilha de auditoria.
 *
 * `pendente_offline` é o ato feito sem sinal, que valeu com a assinatura desenhada: a linha nasce sem documento (`documento_id` nulo)
 * e a pessoa a assina depois, online (`POST /assinaturas-juridicas/{id}/enviar`). Já nasce `usada_em`: o ato já aconteceu.
 */
export const assinaturaJuridica = pgTable(
  "assinatura_juridica",
  {
    id: uuid().primaryKey().defaultRandom(),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    /** O que a pessoa assina (o título da janela de assinatura) e a frase que a explica. */
    titulo: text().notNull(),
    resumo: text(),
    osId: uuid().references(() => os.id),
    situacao: text({ enum: SITUACOES_DA_ASSINATURA_JURIDICA }).notNull(),
    /** Qual provedor criou o documento (`zapsign` ou `simulado`); nulo enquanto `pendente_offline`. */
    provedor: text(),
    /** O código do documento no provedor. */
    documentoId: text(),
    urlAssinatura: text(),
    /** O PDF assinado, no bucket `pdfs` (guardado quando a assinatura é confirmada). */
    pdfPath: text(),
    /** O ato nasceu sem sinal (`pendente_offline` ou já assinada depois). */
    origemOffline: boolean().notNull().default(false),
    /** O ato que a usou: `POST /os/{id}/cancelar`, `evento:{id}`… */
    ato: text(),
    criadaEm: instante().notNull().defaultNow(),
    assinadaEm: instante(),
    usadaEm: instante(),
  },
  (t) => [
    check("assinatura_juridica_situacao_check", emLista(t.situacao, SITUACOES_DA_ASSINATURA_JURIDICA)),
    check("assinatura_juridica_documento_completo", sql`(${t.situacao} = 'pendente_offline') = (${t.documentoId} is null)`),
    check("assinatura_juridica_assinada_completa", sql`(${t.situacao} = 'assinada') = (${t.assinadaEm} is not null)`),
    uniqueIndex("assinatura_juridica_documento_key").on(t.documentoId),
    index("assinatura_juridica_usuario_idx").on(t.usuarioId, t.criadaEm.desc()),
    index("assinatura_juridica_pendentes_idx").on(t.usuarioId).where(sql`${t.situacao} = 'pendente_offline'`),
  ],
).enableRLS();
