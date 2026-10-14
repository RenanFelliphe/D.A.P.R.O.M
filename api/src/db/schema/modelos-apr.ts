import { boolean, check, date, index, integer, jsonb, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { emLista, instante } from "./comum";

export const ITEM_SECOES = ["verificacao", "medida_preventiva"] as const;
export const ITEM_TIPOS = ["eliminatorio", "alerta"] as const;
/**
 * O que o item reprovado exige, além da observação: `foto` (obstáculo físico), `texto` (só a justificativa, como no
 * direito de recusa) ou `pdf` (um documento, como um laudo ou certificado vencido). Fotos e PDFs a mais são sempre aceitos.
 */
export const ITEM_EVIDENCIAS = ["foto", "texto", "pdf"] as const;
export const RESPOSTAS_BLOQUEANTES = ["sim", "nao"] as const;

/** Um modelo publicado é imutável: editar cria versão nova (gatilho em `gatilhos.sql`). */
export const modeloApr = pgTable(
  "modelo_apr",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** APR 01 … APR 09. */
    codigo: text().notNull(),
    versao: integer().notNull(),
    /** "DATA" do documento em papel. */
    dataDocumento: date({ mode: "string" }),
    titulo: text().notNull(),
    /** Plano de atendimento a emergências: grupos de contatos. */
    pae: jsonb(),
    /** Nulo = rascunho. */
    publicadoEm: instante(),
    /**
     * Modelo excluído depois de publicado: sai das listas e das APRs novas, mas as versões ficam para o histórico das
     * APRs e dos PDFs (e para a APR offline que ainda vai chegar). Vale para todas as versões do código; é a única
     * coluna que uma versão publicada aceita mudar (gatilho em `0006_modelo_apr_arquivado.sql`).
     */
    arquivadoEm: instante(),
  },
  (t) => [
    unique("modelo_apr_codigo_versao_key").on(t.codigo, t.versao),
    check("modelo_apr_versao_check", sql`${t.versao} > 0`),
    // O rascunho de um modelo excluído é apagado, não arquivado.
    check("modelo_apr_arquivado_publicado", sql`${t.arquivadoEm} is null or ${t.publicadoEm} is not null`),
  ],
).enableRLS();

/**
 * A planilha das medidas preventivas tem três níveis: Classificação → Risco → Medida (Veicular → Insolação →
 * "Faz uso do protetor solar?"). O risco é um campo que a equipe marca "( )" na APR; só as medidas dos riscos
 * marcados são respondidas (as dos outros ficam em branco no papel). Imutável junto com o modelo publicado.
 */
export const riscoModeloApr = pgTable(
  "risco_modelo_apr",
  {
    id: uuid().primaryKey().defaultRandom(),
    modeloAprId: uuid()
      .notNull()
      .references(() => modeloApr.id, { onDelete: "cascade" }),
    /** "Classificação" da planilha (Veicular, Ambiente de trabalho). */
    classificacao: text().notNull(),
    /** "Riscos" da planilha (Insolação, Áreas molhadas). */
    nome: text().notNull(),
    ordem: integer().notNull(),
  },
  (t) => [unique("risco_modelo_apr_modelo_apr_id_ordem_key").on(t.modeloAprId, t.ordem)],
).enableRLS();

export const itemModeloApr = pgTable(
  "item_modelo_apr",
  {
    id: uuid().primaryKey().defaultRandom(),
    modeloAprId: uuid()
      .notNull()
      .references(() => modeloApr.id, { onDelete: "cascade" }),
    secao: text({ enum: ITEM_SECOES }).notNull(),
    /** O risco que a medida controla; só as medidas preventivas têm, os itens de verificação não. */
    riscoId: uuid().references(() => riscoModeloApr.id, { onDelete: "cascade" }),
    /** Ordem da pergunta na tela. */
    ordem: integer().notNull(),
    texto: text().notNull(),
    respostaBloqueante: text({ enum: RESPOSTAS_BLOQUEANTES }),
    tipo: text({ enum: ITEM_TIPOS }).notNull(),
    evidencia: text({ enum: ITEM_EVIDENCIAS }).notNull().default("foto"),
    permiteNa: boolean().notNull().default(false),
  },
  (t) => [
    unique("item_modelo_apr_modelo_apr_id_ordem_key").on(t.modeloAprId, t.ordem),
    check("item_modelo_apr_secao_check", emLista(t.secao, ITEM_SECOES)),
    check("item_modelo_apr_resposta_bloqueante_check", emLista(t.respostaBloqueante, RESPOSTAS_BLOQUEANTES)),
    check("item_modelo_apr_tipo_check", emLista(t.tipo, ITEM_TIPOS)),
    check("item_modelo_apr_evidencia_check", emLista(t.evidencia, ITEM_EVIDENCIAS)),
    check("item_modelo_apr_risco_da_medida", sql`(${t.secao} = 'medida_preventiva') = (${t.riscoId} is not null)`),
    index("item_modelo_apr_risco_idx").on(t.riscoId).where(sql`${t.riscoId} is not null`),
  ],
).enableRLS();

/**
 * O que o técnico vê ao escolher o modelo da APR (a escolha é sempre dele): a descrição dos serviços que o modelo atende,
 * exemplos e as palavras-chave com que o sistema lê a OS e recomenda um modelo. Uma linha por código, fora do
 * versionamento: mudar a orientação não cria versão nova do modelo. `codigo` não é chave estrangeira porque o código do
 * modelo só é único junto com a versão.
 */
export const orientacaoModeloApr = pgTable("orientacao_modelo_apr", {
  /** APR 01 … APR 09. */
  codigo: text().primaryKey(),
  descricao: text().notNull().default(""),
  exemplos: text().array().notNull().default(sql`'{}'::text[]`),
  /** Comparadas sem acento nem maiúsculas; a de 4 letras ou mais vale também como começo de palavra ("calibr" acha "calibração"). */
  palavrasChave: text().array().notNull().default(sql`'{}'::text[]`),
  atualizadaEm: instante().notNull().defaultNow(),
}).enableRLS();

/**
 * A atividade do plano de manutenção que a OS traz (`os.codigo_atividade`): é o serviço do catálogo, com a lista de
 * materiais. Não escolhe o modelo da APR (quem escolhe é o técnico, com a recomendação de `orientacao_modelo_apr`).
 */
export const atividade = pgTable("atividade", {
  /** Ex.: 8.7.1. */
  codigo: text().primaryKey(),
  descricao: text().notNull(),
  /** Código inventado na carga inicial, à espera do código real do SAP. */
  provisorio: boolean().notNull().default(false),
}).enableRLS();
