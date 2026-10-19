import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";
import { importacao, os } from "./sap";
import { usuario } from "./usuarios";

/**
 * `lendo`: a tarefa em segundo plano ainda lê as folhas (OCR e IA); `lida`: a leitura está guardada e espera a conferência do
 * admin; `falhou`: a leitura não saiu (`erro` diz por quê); `registrada`: as OS entraram como encerradas, de histórico.
 */
export const DIGITALIZACAO_ESTADOS = ["lendo", "lida", "falhou", "registrada"] as const;
/** Em que passo a leitura está, para a tela mostrar o andamento. */
export const DIGITALIZACAO_ETAPAS = ["preparando", "ocr", "ia", "conferindo"] as const;
/** De onde veio o que está escrito à mão: lido pela IA de visão, digitado/corrigido na conferência, ou não preenchido. */
export const MANUSCRITO_FONTES = ["ia", "manual", "nenhuma"] as const;

/**
 * Um PDF digitalizado (folhas de OS já executadas no papel) em leitura ou em conferência. O PDF original e as folhas (JPEG) ficam
 * no bucket `importacoes`, em `digitalizacoes/{id}/`; a leitura inteira fica em `leitura` (a IA custa e não responde igual duas
 * vezes: o registro usa a leitura guardada, não lê de novo).
 */
export const digitalizacao = pgTable(
  "digitalizacao",
  {
    id: uuid().primaryKey().defaultRandom(),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    nomeArquivo: text().notNull(),
    /** Caminho do PDF original no bucket `importacoes`. */
    arquivo: text().notNull(),
    paginas: integer().notNull().default(0),
    paginasLidas: integer().notNull().default(0),
    estado: text({ enum: DIGITALIZACAO_ESTADOS }).notNull().default("lendo"),
    etapa: text({ enum: DIGITALIZACAO_ETAPAS }).notNull().default("preparando"),
    /** As OS lidas, com os campos, o que foi escrito à mão, o estado de cada campo e os avisos. Nula até a leitura terminar. */
    leitura: jsonb(),
    /** A IA de visão leu a parte manuscrita (senão, só o OCR leu o impresso e a pessoa digita o resto). */
    usouIa: boolean().notNull().default(false),
    erro: text(),
    /** A importação que o registro criou. */
    importacaoId: uuid().references(() => importacao.id),
    criadaEm: instante().notNull().defaultNow(),
    atualizadaEm: instante().notNull().defaultNow(),
  },
  (t) => [
    check("digitalizacao_estado_check", emLista(t.estado, DIGITALIZACAO_ESTADOS)),
    check("digitalizacao_etapa_check", emLista(t.etapa, DIGITALIZACAO_ETAPAS)),
    check("digitalizacao_paginas_check", sql`${t.paginas} >= 0 and ${t.paginasLidas} >= 0 and ${t.paginasLidas} <= ${t.paginas}`),
    check("digitalizacao_registrada_com_importacao", sql`${t.estado} <> 'registrada' or ${t.importacaoId} is not null`),
    index("digitalizacao_abertas_idx").on(t.criadaEm.desc()).where(sql`${t.estado} <> 'registrada'`),
  ],
).enableRLS();

/**
 * O que a folha em papel diz da execução de uma OS digitalizada (`os.origem = 'digitalizacao'`, ou uma OS que já existia, sem
 * execução, e foi encerrada pela folha). Não há `execucao`: não houve APR nem execução no sistema, e a OS não pontua nem entra
 * nos indicadores de tempo. As assinaturas e as rubricas ficam só na imagem das folhas (`os.pdf_path`).
 */
export const osDigitalizacao = pgTable(
  "os_digitalizacao",
  {
    osId: uuid()
      .primaryKey()
      .references(() => os.id),
    digitalizacaoId: uuid()
      .notNull()
      .references(() => digitalizacao.id),
    /** As folhas do PDF digitalizado que pertencem a esta OS (a partir de 1). */
    paginas: jsonb().notNull(),
    /** Início e fim reais da execução, escritos à mão na linha da operação. */
    inicioReal: instante(),
    fimReal: instante(),
    numeroPessoas: integer(),
    /** A descrição da atividade e as observações escritas à mão. */
    textoManuscrito: text(),
    manuscritoFonte: text({ enum: MANUSCRITO_FONTES }).notNull().default("nenhuma"),
    registradaPor: uuid()
      .notNull()
      .references(() => usuario.id),
    registradaEm: instante().notNull().defaultNow(),
  },
  (t) => [
    check("os_digitalizacao_fonte_check", emLista(t.manuscritoFonte, MANUSCRITO_FONTES)),
    check("os_digitalizacao_fim_apos_inicio", sql`${t.fimReal} is null or ${t.inicioReal} is null or ${t.fimReal} >= ${t.inicioReal}`),
    check("os_digitalizacao_pessoas_check", sql`${t.numeroPessoas} is null or ${t.numeroPessoas} >= 1`),
    index("os_digitalizacao_lote_idx").on(t.digitalizacaoId),
  ],
).enableRLS();
