import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, jsonb, pgTable, text, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";
import { atividade } from "./modelos-apr";
import { equipe, usuario } from "./usuarios";

export const OS_TIPOS = ["corretiva", "preventiva"] as const;
export const OS_STATUS = ["liberada", "pendente", "em_execucao", "encerrada", "cancelada"] as const;
/**
 * A OS entra pela leitura do SAP (API), pela planilha exportada do SAP ou pelo PDF da OS impressa pelo SAP; só a de apoio
 * nasce no sistema, ligada à OS que ela destrava.
 */
export const OS_ORIGENS = ["sap", "planilha", "pdf", "apoio"] as const;
export const IMPORTACAO_ORIGENS = ["api", "planilha", "pdf"] as const;

export type OsStatus = (typeof OS_STATUS)[number];

export const localInstalacao = pgTable("local_instalacao", {
  id: uuid().primaryKey().defaultRandom(),
  /** Ex.: VILA VELHA/REDE VILA VELHA. */
  codigo: text().notNull().unique(),
  endereco: text(),
  plusCode: text(),
  /** Ex.: Vale, Suzano. */
  cliente: text(),
  /** Editado no painel. */
  critico: boolean().notNull().default(false),
}).enableRLS();

/**
 * A OS lida do SAP. O `status` é derivado no servidor a partir das APRs e execuções
 * (Decisão-chave 3); o banco só garante que o valor seja válido.
 */
export const os = pgTable(
  "os",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Ordem SAP; a OS de apoio, que o SAP ainda não conhece, fica nula. */
    numeroOrdem: text().unique(),
    numeroNota: text(),
    /** `corretiva` (YBA1) ou `preventiva` (YBA2). */
    tipo: text({ enum: OS_TIPOS }).notNull(),
    /** Texto do SAP; só exibição. */
    tipoAtividade: text(),
    /**
     * Chave que liga a OS a um modelo de APR, quando a Segurança do Trabalho já mapeou a atividade. Nula quando
     * não há mapeamento: a OS corretiva 4023470 não tem plano algum e o título da preventiva 4019821
     * ("1.2 - Inspeção Funcional de Retificador") não aparece em nenhuma APR. Nesse caso o técnico escolhe o
     * modelo ao iniciar a APR (`apr.modelo_apr_id` guarda a escolha).
     */
    codigoAtividade: text().references(() => atividade.codigo),
    titulo: text().notNull(),
    descricao: text(),
    /** Texto do SAP; chave do histórico. */
    equipamento: text(),
    localInstalacaoId: uuid()
      .notNull()
      .references(() => localInstalacao.id),
    /** Planejamento (web). */
    equipeId: uuid()
      .notNull()
      .references(() => equipe.id),
    /** Plano e item de manutenção do SAP (preventivas; a corretiva não tem), ex.: 10573 e 10603. */
    planoManutencao: text(),
    itemManutencao: text(),
    /** Como vem do SAP (Muito alto). */
    prioridade: text(),
    dataInicioProg: date({ mode: "string" }).notNull(),
    dataFimProg: date({ mode: "string" }),
    status: text({ enum: OS_STATUS }).notNull().default("liberada"),
    /** Data da Ordem (emissão), como aparece no cabeçalho da OS impressa. */
    dataOrdem: date({ mode: "string" }),
    /** Quem criou a ordem no SAP, ex.: RFAVARO ou IP1020251202 (usuário do plano). Aparece no PDF. */
    criadoPorSap: text(),
    /** Status do sistema no SAP: vem como lista de códigos (LIB IMPR CAPC NOAP SCDM); a api procura o LIB. */
    statusSap: text(),
    /** Geralmente vazio; aparece no PDF quando existe. */
    solicitante: text(),
    /** Preenchido só na OS de apoio (`origem = 'apoio'`): a OS que ela destrava. */
    osOrigemId: uuid().references((): AnyPgColumn => os.id),
    origem: text({ enum: OS_ORIGENS }).notNull(),
    /** PDF da OS no bucket `pdfs`; um por OS. */
    pdfPath: text(),
    pdfEm: instante(),
    cienciaPor: uuid().references(() => usuario.id),
    cienciaEm: instante(),
    exportadaSapEm: instante(),
    /** Cancelamento: a OS de apoio é cancelada na web com justificativa; quando o SAP cancela, só `canceladaEm` é preenchido. */
    canceladaEm: instante(),
    canceladaPor: uuid().references(() => usuario.id),
    justificativaCancelamento: text(),
    /** Cursor do snapshot do modo offline; atualizado por gatilho. */
    atualizadaEm: instante().notNull().defaultNow(),
  },
  (t) => [
    check("os_tipo_check", emLista(t.tipo, OS_TIPOS)),
    check("os_status_check", emLista(t.status, OS_STATUS)),
    check("os_origem_check", emLista(t.origem, OS_ORIGENS)),
    check("os_numero_ordem_obrigatorio", sql`${t.numeroOrdem} is not null or ${t.origem} = 'apoio'`),
    check("os_apoio_ligada", sql`(${t.origem} = 'apoio') = (${t.osOrigemId} is not null)`),
    check("os_datas_programadas", sql`${t.dataFimProg} is null or ${t.dataFimProg} >= ${t.dataInicioProg}`),
    check("os_apoio_nao_aponta_para_si", sql`${t.osOrigemId} is null or ${t.osOrigemId} <> ${t.id}`),
    check("os_ciencia_completa", sql`(${t.cienciaPor} is null) = (${t.cienciaEm} is null)`),
    check(
      "os_cancelamento_justificado",
      sql`${t.canceladaPor} is null or (${t.canceladaEm} is not null and nullif(btrim(${t.justificativaCancelamento}), '') is not null)`,
    ),
    check("os_pdf_completo", sql`(${t.pdfPath} is null) = (${t.pdfEm} is null)`),
    index("os_equipe_status_idx").on(t.equipeId, t.status),
    index("os_local_idx").on(t.localInstalacaoId),
    index("os_atualizada_idx").on(t.atualizadaEm),
    index("os_equipamento_idx").on(t.equipamento),
    index("os_data_inicio_idx").on(t.dataInicioProg),
    index("os_atividade_idx").on(t.codigoAtividade),
    index("os_origem_idx").on(t.osOrigemId).where(sql`${t.osOrigemId} is not null`),
    // Fila de exportação para o SAP: encerradas ainda não exportadas.
    index("os_a_exportar_idx").on(t.id).where(sql`${t.status} = 'encerrada' and ${t.exportadaSapEm} is null`),
  ],
).enableRLS();

/** Registro de cada leitura do SAP e de cada arquivo importado (planilha ou PDF da OS). */
export const importacao = pgTable(
  "importacao",
  {
    id: uuid().primaryKey().defaultRandom(),
    origem: text({ enum: IMPORTACAO_ORIGENS }).notNull(),
    /** Caminho no bucket `importacoes`, só nos arquivos (planilha ou PDF). */
    arquivo: text(),
    /** Nulo na leitura agendada. */
    usuarioId: uuid().references(() => usuario.id),
    criadas: integer().notNull().default(0),
    atualizadas: integer().notNull().default(0),
    ignoradas: integer().notNull().default(0),
    /** `[{linha ou numero_ordem, motivo}]`. */
    detalheIgnoradas: jsonb(),
    erro: text(),
    criadaEm: instante().notNull().defaultNow(),
  },
  (t) => [
    check("importacao_origem_check", emLista(t.origem, IMPORTACAO_ORIGENS)),
    check("importacao_criadas_check", sql`${t.criadas} >= 0`),
    check("importacao_atualizadas_check", sql`${t.atualizadas} >= 0`),
    check("importacao_ignoradas_check", sql`${t.ignoradas} >= 0`),
    index("importacao_criada_idx").on(t.criadaEm.desc()),
  ],
).enableRLS();
