import { sql } from "drizzle-orm";
import {
  jsonb,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";
import { apr, aprResposta } from "./apr";
import { itemModeloApr } from "./modelos-apr";
import { os } from "./sap";
import { usuario } from "./usuarios";

export const EXECUCAO_RESULTADOS = ["encerrada", "interrompida", "suspensa", "cancelada"] as const;
/** O que um participante pede ao responsável (execução compartilhada): encerrar a OS ou suspender a execução por um motivo comum. */
export const PEDIDO_TIPOS = ["encerrar", "suspender"] as const;
/**
 * Como um pedido terminou: `aprovado` e `recusado` pelo responsável; `aprovado_por_prazo` quando os 2 minutos passaram sem resposta;
 * `cancelado` pelo solicitante; `obsoleto` quando o responsável agiu antes ou a execução acabou.
 */
export const PEDIDO_ESTADOS = ["aberto", "aprovado", "aprovado_por_prazo", "recusado", "cancelado", "obsoleto"] as const;
/**
 * Por que a execução parou por um momento: a lista da pausa (Reunião 3). `aguardando` e `outro` pedem um complemento (o que ou
 * quem; a descrição); `enfermidade` e `lesao` avisam o supervisor na hora.
 */
export const PAUSA_MOTIVOS = ["almoco", "aguardando", "descanso", "clima", "enfermidade", "lesao", "outro"] as const;
/** Por que a execução foi suspensa (o serviço não continua hoje). `outro` pede o complemento; `enfermidade` e `lesao` avisam o supervisor. */
export const SUSPENSAO_MOTIVOS = ["enfermidade", "lesao", "fim_expediente", "clima", "falta_material", "outro"] as const;
/** Os motivos que são acidente de trabalho em potencial: o supervisor é avisado na hora (sino e e-mail) e o relatório os traz. */
export const MOTIVOS_DE_SAUDE = ["enfermidade", "lesao"] as const;
/** O arquivo de uma evidência: a foto (bucket `fotos`) ou um documento em PDF (bucket `documentos`), como um laudo ou um atestado. */
export const EVIDENCIA_TIPOS = ["foto", "pdf"] as const;
export type EvidenciaTipo = (typeof EVIDENCIA_TIPOS)[number];

/**
 * Um trecho de trabalho amparado por uma APR aprovada. Os ids nascem no cliente.
 * Não há índice único de "uma execução em andamento por OS" de propósito: duas pessoas podem executar
 * a mesma OS offline, e as duas execuções são guardadas (vale a primeira encerrada, com alerta
 * `execucao_duplicada`).
 */
export const execucao = pgTable(
  "execucao",
  {
    id: uuid().primaryKey(),
    osId: uuid()
      .notNull()
      .references(() => os.id),
    /** A api exige a APR `aprovada`. */
    aprId: uuid()
      .notNull()
      .references(() => apr.id),
    /** Quem estava logado. */
    executorId: uuid()
      .notNull()
      .references(() => usuario.id),
    numeroPessoas: integer().notNull(),
    inicio: instante().notNull(),
    fim: instante(),
    /** Nulo = em andamento. */
    resultado: text({ enum: EXECUCAO_RESULTADOS }),
    descricaoAtividade: text(),
    motivo: text(),
    /**
     * Leituras e conformidades do formulário de inspeção da OS preventiva (OS 4019821: horímetro, tensões,
     * "Conforme / Não conforme" por componente). A estrutura do formulário ainda não está definida (questão 57),
     * por isso é JSON.
     */
    dadosInspecao: jsonb(),
    /** A assinatura do perfil de quem interrompeu por risco ou cancelou por engano (cópia). Nula nas demais execuções e nas anteriores à assinatura. */
    assinaturaDoResultadoPath: text(),
    /** Onde a pessoa estava ao iniciar. Nula quando o aparelho não deu a posição (permissão negada, local coberto): fica "sem localização". */
    inicioLatitude: numeric({ precision: 9, scale: 6, mode: "number" }),
    inicioLongitude: numeric({ precision: 9, scale: 6, mode: "number" }),
    /** Onde estava ao terminar (encerrar, suspender ou interromper). */
    fimLatitude: numeric({ precision: 9, scale: 6, mode: "number" }),
    fimLongitude: numeric({ precision: 9, scale: 6, mode: "number" }),
    /** Só na suspensa: por que o serviço não continua hoje. As suspensas antigas não têm motivo. */
    suspensaoMotivo: text({ enum: SUSPENSAO_MOTIVOS }),
    suspensaoComplemento: text(),
    /**
     * Quando o responsável preencheu o encerramento (descrição, fotos, checklist) e o assinou. O encerramento tem dois passos: o
     * clique em "Encerrar OS" grava o fim (`resultado = encerrada`) e o tempo para; só depois vêm o preenchimento e a assinatura.
     * Nulo na encerrada = a OS está em `encerrando`, esperando a assinatura do responsável.
     */
    encerramentoAssinadoEm: instante(),
    /**
     * Quem encerrou, interrompeu ou suspendeu a execução: qualquer participante da APR pode (execução compartilhada). Quem encerrou
     * assina o encerramento. Nulo nas execuções anteriores e nas ainda em andamento: vale `executor_id`.
     */
    finalizadaPor: uuid().references(() => usuario.id),
  },
  (t) => [
    check("execucao_resultado_check", emLista(t.resultado, EXECUCAO_RESULTADOS)),
    check("execucao_numero_pessoas_check", sql`${t.numeroPessoas} >= 1`),
    check("execucao_suspensao_motivo_check", emLista(t.suspensaoMotivo, SUSPENSAO_MOTIVOS)),
    check("execucao_inicio_gps_completo", sql`(${t.inicioLatitude} is null) = (${t.inicioLongitude} is null)`),
    check("execucao_fim_gps_completo", sql`(${t.fimLatitude} is null) = (${t.fimLongitude} is null)`),
    check("execucao_inicio_latitude_check", sql`${t.inicioLatitude} between -90 and 90`),
    check("execucao_inicio_longitude_check", sql`${t.inicioLongitude} between -180 and 180`),
    check("execucao_fim_latitude_check", sql`${t.fimLatitude} between -90 and 90`),
    check("execucao_fim_longitude_check", sql`${t.fimLongitude} between -180 and 180`),
    check("execucao_fim_apos_inicio", sql`${t.fim} is null or ${t.fim} >= ${t.inicio}`),
    // A descrição do encerramento é opcional (só vale quando aconteceu algo): a encerrada só precisa do fim.
    check("execucao_encerrada_completa", sql`${t.resultado} is distinct from 'encerrada' or ${t.fim} is not null`),
    check(
      "execucao_interrompida_com_motivo",
      sql`${t.resultado} is distinct from 'interrompida' or (${t.fim} is not null and nullif(btrim(${t.motivo}), '') is not null)`,
    ),
    check("execucao_suspensa_com_fim", sql`${t.resultado} is distinct from 'suspensa' or ${t.fim} is not null`),
    // Uma APR ampara uma única Execução. A cancelada não conta: cancelar por engano devolve a APR para uso.
    uniqueIndex("execucao_apr_unica_idx").on(t.aprId).where(sql`${t.resultado} is distinct from 'cancelada'`),
    index("execucao_os_idx").on(t.osId),
    index("execucao_executor_idx").on(t.executorId, t.inicio.desc()),
    // Execuções em andamento (o painel destaca as abertas há mais de 12 h).
    index("execucao_abertas_idx").on(t.inicio).where(sql`${t.resultado} is null`),
  ],
).enableRLS();

export const execucaoPausa = pgTable(
  "execucao_pausa",
  {
    id: uuid().primaryKey(),
    execucaoId: uuid()
      .notNull()
      .references(() => execucao.id),
    inicio: instante().notNull(),
    /** Nulo = pausa aberta. */
    fim: instante(),
    /** Obrigatório nas pausas novas (a `api` confere); as antigas podem não ter. */
    motivo: text({ enum: PAUSA_MOTIVOS }),
    /** O que ou quem se espera (`aguardando`) ou a descrição (`outro`). */
    complemento: text(),
    /** Onde a pessoa estava ao pausar; nula = "sem localização". */
    latitude: numeric({ precision: 9, scale: 6, mode: "number" }),
    longitude: numeric({ precision: 9, scale: 6, mode: "number" }),
    /** Quem pausou e quem retomou (ou encerrou a execução que estava em pausa): qualquer participante da APR. Nulos nas pausas anteriores: vale `executor_id`. */
    iniciadaPor: uuid().references(() => usuario.id),
    encerradaPor: uuid().references(() => usuario.id),
  },
  (t) => [
    check("execucao_pausa_motivo_check", emLista(t.motivo, PAUSA_MOTIVOS)),
    check("execucao_pausa_gps_completo", sql`(${t.latitude} is null) = (${t.longitude} is null)`),
    check("execucao_pausa_latitude_check", sql`${t.latitude} between -90 and 90`),
    check("execucao_pausa_longitude_check", sql`${t.longitude} between -180 and 180`),
    check("execucao_pausa_fim_apos_inicio", sql`${t.fim} is null or ${t.fim} >= ${t.inicio}`),
    index("execucao_pausa_execucao_idx").on(t.execucaoId),
    // No máximo uma pausa aberta por execução.
    uniqueIndex("execucao_pausa_unica_aberta_idx").on(t.execucaoId).where(sql`${t.fim} is null`),
  ],
).enableRLS();

/**
 * O pedido de um participante ao responsável pela execução (encerrar ou suspender por motivo comum): o responsável aceita ou recusa
 * em até 2 minutos; sem resposta, é aprovado sozinho. `instante` é o do clique, e é nele que a ação vale, não no da aprovação. Um
 * pedido aberto por execução.
 */
export const execucaoPedido = pgTable(
  "execucao_pedido",
  {
    /** Nasce no aparelho (idempotência do evento). */
    id: uuid().primaryKey(),
    execucaoId: uuid()
      .notNull()
      .references(() => execucao.id),
    tipo: text({ enum: PEDIDO_TIPOS }).notNull(),
    solicitanteId: uuid()
      .notNull()
      .references(() => usuario.id),
    /** O instante do clique do solicitante: o fim da execução, se o pedido for aprovado. */
    instante: instante().notNull(),
    /** Só no pedido de suspensão: o motivo e o complemento. */
    motivo: text(),
    complemento: text(),
    latitude: numeric({ precision: 9, scale: 6, mode: "number" }),
    longitude: numeric({ precision: 9, scale: 6, mode: "number" }),
    /** Relógio da `api`: o prazo de 2 minutos conta daqui, nunca do relógio do aparelho. */
    criadoEm: instante().notNull(),
    expiraEm: instante().notNull(),
    estado: text({ enum: PEDIDO_ESTADOS }).notNull().default("aberto"),
    /** Quem aprovou ou recusou (só nesses dois estados). */
    decididoPor: uuid().references(() => usuario.id),
    /** Quando deixou de estar aberto (decisão, prazo, cancelamento ou obsolescência). */
    decididoEm: instante(),
    motivoRecusa: text(),
  },
  (t) => [
    check("execucao_pedido_tipo_check", emLista(t.tipo, PEDIDO_TIPOS)),
    check("execucao_pedido_estado_check", emLista(t.estado, PEDIDO_ESTADOS)),
    check("execucao_pedido_gps_completo", sql`(${t.latitude} is null) = (${t.longitude} is null)`),
    check("execucao_pedido_prazo", sql`${t.expiraEm} > ${t.criadoEm}`),
    check("execucao_pedido_decisao", sql`(${t.estado} = 'aberto') = (${t.decididoEm} is null) and (${t.estado} in ('aprovado', 'recusado')) = (${t.decididoPor} is not null)`),
    check("execucao_pedido_suspensao_com_motivo", sql`${t.tipo} <> 'suspender' or ${t.motivo} is not null`),
    // Um pedido aberto por execução: quem pede outra coisa nesse meio-tempo apoia o que já está aberto.
    uniqueIndex("execucao_pedido_aberto_idx").on(t.execucaoId).where(sql`${t.estado} = 'aberto'`),
    index("execucao_pedido_execucao_idx").on(t.execucaoId),
    // O executor de tarefas e a leitura procuram os abertos que já venceram.
    index("execucao_pedido_vencendo_idx").on(t.expiraEm).where(sql`${t.estado} = 'aberto'`),
  ],
).enableRLS();

/** Quem concordou com um pedido aberto (outro participante que quis o mesmo): aparece no relatório. */
export const execucaoPedidoApoio = pgTable(
  "execucao_pedido_apoio",
  {
    pedidoId: uuid()
      .notNull()
      .references(() => execucaoPedido.id),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    apoiadoEm: instante().notNull(),
  },
  (t) => [primaryKey({ name: "execucao_pedido_apoio_pkey", columns: [t.pedidoId, t.usuarioId] })],
).enableRLS();

export const execucaoAssinatura = pgTable(
  "execucao_assinatura",
  {
    execucaoId: uuid()
      .notNull()
      .references(() => execucao.id),
    /** Só o responsável pela execução assina o encerramento (os participantes assinaram a APR, no começo). */
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    /** Cópia da assinatura do perfil. */
    assinaturaPath: text().notNull(),
    assinadaEm: instante().notNull(),
  },
  (t) => [primaryKey({ name: "execucao_assinatura_pkey", columns: [t.execucaoId, t.usuarioId] })],
).enableRLS();

export const evidencia = pgTable(
  "evidencia",
  {
    id: uuid().primaryKey(),
    execucaoId: uuid().references(() => execucao.id),
    /** Evidência do item reprovado. */
    aprId: uuid().references(() => apr.id),
    itemId: uuid().references(() => itemModeloApr.id),
    tipo: text({ enum: EVIDENCIA_TIPOS }).notNull().default("foto"),
    /**
     * Caminho do arquivo no bucket do tipo: `fotos` (foto) ou `documentos` (PDF). O nome da coluna vem de quando a
     * evidência só podia ser foto.
     */
    fotoPath: text().notNull(),
    /** Nome do PDF como foi anexado (`laudo-medicao.pdf`), para exibir; a foto não tem. */
    nomeArquivo: text(),
    capturadaEm: instante().notNull(),
    latitude: numeric({ precision: 9, scale: 6, mode: "number" }),
    longitude: numeric({ precision: 9, scale: 6, mode: "number" }),
  },
  (t) => [
    check("evidencia_tem_dono", sql`${t.execucaoId} is not null or ${t.aprId} is not null`),
    check("evidencia_tipo_check", emLista(t.tipo, EVIDENCIA_TIPOS)),
    check("evidencia_nome_so_no_pdf", sql`${t.nomeArquivo} is null or ${t.tipo} = 'pdf'`),
    check("evidencia_item_da_apr", sql`(${t.aprId} is null) = (${t.itemId} is null)`),
    check("evidencia_gps_completo", sql`(${t.latitude} is null) = (${t.longitude} is null)`),
    check("evidencia_latitude_check", sql`${t.latitude} between -90 and 90`),
    check("evidencia_longitude_check", sql`${t.longitude} between -180 and 180`),
    // A foto de item só vale para um item que a APR respondeu.
    foreignKey({
      name: "evidencia_resposta_fk",
      columns: [t.aprId, t.itemId],
      foreignColumns: [aprResposta.aprId, aprResposta.itemId],
    }),
    index("evidencia_execucao_idx").on(t.execucaoId).where(sql`${t.execucaoId} is not null`),
    index("evidencia_apr_idx").on(t.aprId, t.itemId).where(sql`${t.aprId} is not null`),
  ],
).enableRLS();
