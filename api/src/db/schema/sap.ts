import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, jsonb, pgTable, text, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";
import { atividade } from "./modelos-apr";
import { equipe, usuario } from "./usuarios";

export const OS_TIPOS = ["corretiva", "preventiva"] as const;
/**
 * `encerrando` e `aguardando_supervisor` são os dois passos entre o fim da execução e a conclusão (Reunião 3): o tempo parou, e
 * o responsável preenche e assina o encerramento (`encerrando`); depois a OS espera o supervisor ler o relatório da execução e
 * assinar (`aguardando_supervisor`). Só com a assinatura do supervisor a OS fica `encerrada` (concluída): é aí que sai o PDF e
 * que ela entra na planilha de baixa do SAP.
 * `devolvida`: o supervisor a devolveu ao SAP com uma justificativa (erro na ordem). Sai do quadro da equipe, como a
 * `cancelada`, e a justificativa vai na planilha de baixa; só o SAP a traz de volta, ao alterar a ordem.
 */
export const OS_STATUS = ["liberada", "pendente", "em_execucao", "encerrando", "aguardando_supervisor", "encerrada", "cancelada", "devolvida"] as const;
/**
 * A OS entra pela leitura do SAP (API), pela planilha exportada do SAP ou pelo PDF da OS impressa pelo SAP; só a de apoio
 * nasce no sistema, ligada à OS que ela destrava. A `digitalizacao` é a OS antiga, já executada no papel, que o admin traz
 * como encerrada, de histórico (`os_digitalizacao`).
 */
export const OS_ORIGENS = ["sap", "planilha", "pdf", "apoio", "digitalizacao"] as const;
export const IMPORTACAO_ORIGENS = ["api", "planilha", "pdf", "digitalizacao"] as const;

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
 * (decisão-chave 3, `docs/especificacao.md`, seção 2.3); o banco só garante que o valor seja válido.
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
     * A atividade do plano de manutenção (o serviço do catálogo, com a lista de materiais). Nula quando a ordem não traz
     * uma: a corretiva 4023470 não tem plano algum. Não escolhe o modelo da APR: o técnico escolhe a cada APR
     * (`apr.modelo_apr_id` guarda a escolha), com a recomendação que o sistema tira da leitura da OS.
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
    /** A assinatura do perfil que o supervisor usou na ciência (cópia: refazer a do perfil não muda esta). Nula nas ciências anteriores à assinatura. */
    cienciaAssinaturaPath: text(),
    exportadaSapEm: instante(),
    /** Cancelamento: a OS de apoio é cancelada na web com justificativa; quando o SAP cancela, só `canceladaEm` é preenchido. */
    canceladaEm: instante(),
    canceladaPor: uuid().references(() => usuario.id),
    justificativaCancelamento: text(),
    /** A assinatura do perfil de quem cancelou a OS de apoio (cópia). Nula nos cancelamentos anteriores à assinatura e nos do SAP. */
    canceladaAssinaturaPath: text(),
    /**
     * Atribuição individual: a pessoa da equipe para quem o supervisor reservou a OS. A OS continua no quadro da equipe,
     * mas só ela inicia a APR e a execução. Nula = a OS é da equipe toda (o padrão). A leitura do SAP não mexe aqui.
     */
    responsavelId: uuid().references(() => usuario.id),
    reservadaPor: uuid().references(() => usuario.id),
    reservadaEm: instante(),
    /** Devolução ao SAP (status `devolvida`): quem devolveu, quando e a justificativa, que vai na planilha de baixa. */
    devolvidaEm: instante(),
    devolvidaPor: uuid().references(() => usuario.id),
    justificativaDevolucao: text(),
    /** A assinatura do perfil de quem devolveu a OS (cópia). Nula nas devoluções anteriores à assinatura. */
    devolvidaAssinaturaPath: text(),
    /** Quando a devolução foi na planilha de baixa; nulo enquanto ainda não saiu. */
    devolucaoExportadaEm: instante(),
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
    check(
      "os_reserva_completa",
      sql`(${t.responsavelId} is null) = (${t.reservadaPor} is null) and (${t.responsavelId} is null) = (${t.reservadaEm} is null)`,
    ),
    check(
      "os_devolucao_justificada",
      sql`(${t.devolvidaPor} is null) = (${t.devolvidaEm} is null) and (${t.devolvidaPor} is null or nullif(btrim(${t.justificativaDevolucao}), '') is not null)`,
    ),
    check("os_devolvida_registrada", sql`${t.status} <> 'devolvida' or ${t.devolvidaEm} is not null`),
    check("os_pdf_completo", sql`(${t.pdfPath} is null) = (${t.pdfEm} is null)`),
    index("os_equipe_status_idx").on(t.equipeId, t.status),
    index("os_local_idx").on(t.localInstalacaoId),
    index("os_atualizada_idx").on(t.atualizadaEm),
    index("os_equipamento_idx").on(t.equipamento),
    index("os_data_inicio_idx").on(t.dataInicioProg),
    index("os_atividade_idx").on(t.codigoAtividade),
    // As OS de cada ciclo das preventivas: as do mesmo plano e item.
    index("os_plano_idx").on(t.planoManutencao, t.itemManutencao).where(sql`${t.planoManutencao} is not null`),
    index("os_origem_idx").on(t.osOrigemId).where(sql`${t.osOrigemId} is not null`),
    // Fila de exportação para o SAP: encerradas ainda não exportadas.
    index("os_a_exportar_idx").on(t.id).where(sql`${t.status} = 'encerrada' and ${t.exportadaSapEm} is null`),
    // ...e as devolvidas que ainda não saíram na planilha.
    index("os_devolvida_a_exportar_idx").on(t.id).where(sql`${t.status} = 'devolvida' and ${t.devolucaoExportadaEm} is null`),
    index("os_responsavel_idx").on(t.responsavelId).where(sql`${t.responsavelId} is not null`),
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
    /** O que entrou mas merece atenção (ex.: o intervalo entre ciclos que não foi reconhecido): quantos e `[{linha ou numero_ordem, motivo}]`. */
    avisos: integer().notNull().default(0),
    detalheAvisos: jsonb(),
    erro: text(),
    criadaEm: instante().notNull().defaultNow(),
  },
  (t) => [
    check("importacao_origem_check", emLista(t.origem, IMPORTACAO_ORIGENS)),
    check("importacao_criadas_check", sql`${t.criadas} >= 0`),
    check("importacao_atualizadas_check", sql`${t.atualizadas} >= 0`),
    check("importacao_ignoradas_check", sql`${t.ignoradas} >= 0`),
    check("importacao_avisos_check", sql`${t.avisos} >= 0`),
    index("importacao_criada_idx").on(t.criadaEm.desc()),
  ],
).enableRLS();
