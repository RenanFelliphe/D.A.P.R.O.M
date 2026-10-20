import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";
import { execucao } from "./execucao";
import { usuario } from "./usuarios";

/**
 * Onde a conferência está: espera todos sincronizarem, espera o responsável (ou o supervisor) escolher as versões, espera as ciências e
 * assinaturas, e os dois fins (todos assinaram, ou foi fechada com o que existia).
 */
export const CONFERENCIA_ESTADOS = ["aguardando_sincronizacao", "aguardando_responsavel", "aguardando_assinaturas", "concluida", "fechada_sem_todos"] as const;
/** `resumo`: só uma versão, ou todas batem; pede ciência. `com_divergencia`: sobraram diferenças; o responsável escolhe e a equipe assina. */
export const CONFERENCIA_TIPOS = ["resumo", "com_divergencia"] as const;
export const CONFERENCIA_ASSINATURA_TIPOS = ["ciencia", "assinatura"] as const;

/**
 * A conferência de uma execução registrada sem sinal em aparelhos diferentes (execução compartilhada, etapa 3): depois que todos
 * sincronizam, o servidor compara o que cada aparelho registrou. Sem divergência, é um resumo com ciência; com divergência, o
 * responsável escolhe a versão certa e os demais assinam. Uma por execução. O `snapshot` guarda as versões e as diferenças, congelado
 * na montagem, e o que valia antes de a escolha ser aplicada (auditoria).
 */
export const conferenciaExecucao = pgTable(
  "conferencia_execucao",
  {
    id: uuid().primaryKey().defaultRandom(),
    execucaoId: uuid()
      .notNull()
      .references(() => execucao.id),
    estado: text({ enum: CONFERENCIA_ESTADOS }).notNull().default("aguardando_sincronizacao"),
    /** Nulo até a montagem (depois que todos sincronizaram, ou que o prazo liberou o fechamento). */
    tipo: text({ enum: CONFERENCIA_TIPOS }),
    /** Relógio da `api`: quando a execução terminou com algum registro sem sinal. Os prazos contam daqui. */
    criadaEm: instante().notNull(),
    /** `criada_em` + 72 h: o responsável ou o supervisor passa a poder "fechar com o que existe". */
    liberaFecharEm: instante().notNull(),
    /** `criada_em` + 7 dias: a conferência fecha sozinha. */
    limiteEm: instante().notNull(),
    /** Quando os avisos de 24 h e de 48 h saíram (um de cada, para quem ainda falta). */
    avisada24hEm: instante(),
    avisada48hEm: instante(),
    montadaEm: instante(),
    /** As versões por autor e os campos comparados (`shared/api/conferencia-execucao.ts`), congelados na montagem. */
    snapshot: jsonb(),
    /** Quem era o responsável da execução na montagem: é ele quem decide horários e pausas. */
    responsavelId: uuid().references(() => usuario.id),
    /** Quem completou as escolhas; nulo quando o prazo de 7 dias as tomou pelo padrão sugerido. */
    decididaPor: uuid().references(() => usuario.id),
    decididaEm: instante(),
    /** Quando a escolha foi gravada nas tabelas da execução. */
    aplicadaEm: instante(),
    /** `{ sincronizar: [usuario_id], assinar: [usuario_id] }`: quem faltou quando a conferência andou ou fechou sem eles. */
    faltaram: jsonb(),
    fechadaEm: instante(),
    /** Quem fechou com o que existia; nulo quando foi o prazo de 7 dias. */
    fechadaPor: uuid().references(() => usuario.id),
  },
  (t) => [
    check("conferencia_estado_check", emLista(t.estado, CONFERENCIA_ESTADOS)),
    check("conferencia_tipo_check", emLista(t.tipo, CONFERENCIA_TIPOS)),
    check("conferencia_tipo_montada", sql`${t.estado} = 'aguardando_sincronizacao' or ${t.tipo} is not null`),
    check("conferencia_prazos", sql`${t.liberaFecharEm} > ${t.criadaEm} and ${t.limiteEm} > ${t.liberaFecharEm}`),
    check("conferencia_fim_completo", sql`(${t.estado} in ('concluida', 'fechada_sem_todos')) = (${t.fechadaEm} is not null)`),
    uniqueIndex("conferencia_execucao_unica_idx").on(t.execucaoId),
    // A tarefa de hora em hora procura as que ainda andam.
    index("conferencia_abertas_idx").on(t.limiteEm).where(sql`${t.estado} in ('aguardando_sincronizacao', 'aguardando_responsavel', 'aguardando_assinaturas')`),
  ],
).enableRLS();

/**
 * A escolha de cada campo divergente: `campo` é `inicio`, `fim`, `resultado` ou `pausa:<n>`; `escolha` é o autor cuja versão vale, ou
 * `descartar` (a pausa que só um aparelho registrou e a equipe não confirmou). Horários e pausas são do responsável; o resultado, do supervisor.
 */
export const conferenciaDecisao = pgTable(
  "conferencia_decisao",
  {
    conferenciaId: uuid()
      .notNull()
      .references(() => conferenciaExecucao.id),
    campo: text().notNull(),
    escolha: text().notNull(),
    decididaPor: uuid().references(() => usuario.id),
    decididaEm: instante().notNull(),
  },
  (t) => [primaryKey({ name: "conferencia_decisao_pkey", columns: [t.conferenciaId, t.campo] })],
).enableRLS();

/**
 * A ciência (no resumo: um toque, sem assinatura) ou a assinatura (na conferência com divergência: a do perfil) de quem participou da
 * execução. A ressalva é um texto livre: não trava nada, vai ao supervisor com aviso e ao relatório da execução.
 */
export const conferenciaAssinatura = pgTable(
  "conferencia_assinatura",
  {
    conferenciaId: uuid()
      .notNull()
      .references(() => conferenciaExecucao.id),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    tipo: text({ enum: CONFERENCIA_ASSINATURA_TIPOS }).notNull(),
    /** Cópia da assinatura do perfil; só na `assinatura`. */
    assinaturaPath: text(),
    ressalva: text(),
    assinadaEm: instante().notNull(),
  },
  (t) => [
    primaryKey({ name: "conferencia_assinatura_pkey", columns: [t.conferenciaId, t.usuarioId] }),
    check("conferencia_assinatura_tipo_check", emLista(t.tipo, CONFERENCIA_ASSINATURA_TIPOS)),
    check("conferencia_assinatura_com_imagem", sql`(${t.tipo} = 'assinatura') = (${t.assinaturaPath} is not null)`),
  ],
).enableRLS();
