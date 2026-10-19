import { sql } from "drizzle-orm";
import { boolean, check, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";
import { atividade } from "./modelos-apr";
import { usuario } from "./usuarios";

/**
 * Treinamentos de serviço (seção 3 do `vitoria.md`): o jogo por serviço do catálogo. Usa o prefixo `treinamento_servico` em
 * tudo para não colidir com o Campo de treino (tutorial fictício já existente, as colunas `treinamento_*` de `usuario` e
 * `api/test/treinamento.test.ts`), que é uma funcionalidade diferente e não é tocado aqui.
 *
 * Nesta fase (sem IA), `texto_origem` e `rodadas_ia` ficam sempre nulos/zero e `gerado_com_ia` sempre falso: são o encaixe
 * para a Fase 2 do plano (rascunho por IA), que não entra agora.
 */

export const TREINAMENTO_SERVICO_VERSAO_ESTADOS = ["rascunho", "publicada", "substituida"] as const;
export type TreinamentoServicoVersaoEstado = (typeof TREINAMENTO_SERVICO_VERSAO_ESTADOS)[number];

/** Um treinamento por serviço do catálogo (a `atividade`); o conteúdo versionado fica em `treinamento_servico_versao`. */
export const treinamentoServico = pgTable("treinamento_servico", {
  id: uuid().primaryKey().defaultRandom(),
  atividadeCodigo: text()
    .notNull()
    .unique()
    .references(() => atividade.codigo),
  criadoEm: instante().notNull().defaultNow(),
  criadoPor: uuid().references(() => usuario.id),
}).enableRLS();

/**
 * Uma versão do conteúdo: a explicação (Parte 1, até 12 passos) e as fases do jogo (Parte 2, até 10), ambas em jsonb e
 * validadas pela `api` (`treinamento-servico-esquema.ts`), no espírito de `modelo_apr` (rascunho → publicada → substituída),
 * mas sem tabelas filhas porque o conteúdo não precisa ser consultado por SQL. No máximo um rascunho e uma publicada por
 * treinamento (os índices parciais abaixo); publicar não muda a linha: cria-se uma versão nova quando o admin edita de novo.
 */
export const treinamentoServicoVersao = pgTable(
  "treinamento_servico_versao",
  {
    id: uuid().primaryKey().defaultRandom(),
    treinamentoId: uuid()
      .notNull()
      .references(() => treinamentoServico.id),
    versao: integer().notNull(),
    estado: text({ enum: TREINAMENTO_SERVICO_VERSAO_ESTADOS }).notNull().default("rascunho"),
    /** Array de 1 a 12 `{ordem, texto, expressao, imagem_path}` (Zod). */
    explicacao: jsonb().notNull().default(sql`'[]'::jsonb`),
    /** Array de fases, sem máximo no produto (ao menos 3 para publicar), união discriminada por `tipo` (Zod); é o gabarito, nunca enviado ao cliente antes da resposta. */
    fases: jsonb().notNull().default(sql`'[]'::jsonb`),
    /** Imagem do cenário mostrada na abertura, no bucket `treinamentos`. */
    cenarioPath: text(),
    /** Sempre nulo nesta fase (sem IA); ponto de encaixe da Fase 2 do plano. */
    textoOrigem: text(),
    geradoComIa: boolean().notNull().default(false),
    rodadasIa: integer().notNull().default(0),
    publicadaEm: instante(),
    publicadaPor: uuid().references(() => usuario.id),
    /** Assinatura de quem publicou, no bucket `assinaturas` (mesmo padrão de `usuario.assinatura_path`). */
    assinaturaPath: text(),
    /** O termo aceito na publicação, com o código e a descrição do serviço já substituídos (fica gravado como ficou). */
    termo: text(),
  },
  (t) => [
    unique("treinamento_servico_versao_treinamento_id_versao_key").on(t.treinamentoId, t.versao),
    check("treinamento_servico_versao_versao_check", sql`${t.versao} > 0`),
    check("treinamento_servico_versao_estado_check", emLista(t.estado, TREINAMENTO_SERVICO_VERSAO_ESTADOS)),
    check("treinamento_servico_versao_rodadas_ia_check", sql`${t.rodadasIa} >= 0`),
    check("treinamento_servico_versao_publicacao_completa", sql`(${t.publicadaEm} is null) = (${t.publicadaPor} is null) and (${t.publicadaEm} is null) = (${t.assinaturaPath} is null)`),
    check("treinamento_servico_versao_estado_publicacao", sql`(${t.estado} = 'rascunho') = (${t.publicadaEm} is null)`),
    uniqueIndex("treinamento_servico_versao_rascunho_idx").on(t.treinamentoId).where(sql`${t.estado} = 'rascunho'`),
    uniqueIndex("treinamento_servico_versao_publicada_idx").on(t.treinamentoId).where(sql`${t.estado} = 'publicada'`),
    index("treinamento_servico_versao_treinamento_idx").on(t.treinamentoId),
  ],
).enableRLS();

/**
 * Uma tentativa do jogo: `apresentacao` guarda o embaralhamento gerado uma única vez na abertura (a ordem das opções, dos
 * pares e das etapas, e o sorteio dos itens errados do Selecione com os materiais do serviço), sem nenhum dado de gabarito. `pre_visualizacao`
 * marca quando o admin está testando o rascunho (nunca pontua). O índice parcial único (pontuada) garante no próprio banco
 * que só a primeira conclusão de cada treinamento pontua.
 */
export const treinamentoServicoTentativa = pgTable(
  "treinamento_servico_tentativa",
  {
    id: uuid().primaryKey().defaultRandom(),
    treinamentoId: uuid()
      .notNull()
      .references(() => treinamentoServico.id),
    versaoId: uuid()
      .notNull()
      .references(() => treinamentoServicoVersao.id),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    /**
     * `defaultNow()` (o relógio do banco), não `deps.agora()`: é o que dá a cada tentativa um instante só seu, estritamente
     * crescente mesmo quando `deps.agora()` está parado (o relógio de teste), o que "a primeira tentativa já aberta" (a
     * conquista Nota máxima) precisa para ordenar com segurança. Por isso não há `check` comparando com `concluida_em`,
     * que usa `deps.agora()`: as duas datas vêm de relógios diferentes de propósito.
     */
    iniciadaEm: instante().notNull().defaultNow(),
    concluidaEm: instante(),
    apresentacao: jsonb().notNull(),
    preVisualizacao: boolean().notNull().default(false),
    pontuada: boolean().notNull().default(false),
    /** Fases certas (todos os acertos possíveis), até o total de fases da versão. A gamificação conta no máximo 10. */
    fasesCertas: integer().notNull().default(0),
    /**
     * O cronômetro de cada fase (seção 12 do `treinamentos-de-servico.md`): os milissegundos acumulados por fase, a fase em que
     * a pessoa está agora (e desde quando) e o instante do último evento. Ao sair de uma fase o tempo dela fica guardado; ao
     * voltar, continua de onde parou. Tudo pelo relógio do servidor (`deps.agora()`).
     */
    tempos: jsonb().notNull().default(sql`'{}'::jsonb`),
    /** A resposta em andamento de cada fase ainda não confirmada, para corrigir os acertos parciais ao finalizar. */
    progresso: jsonb().notNull().default(sql`'{}'::jsonb`),
    /** A nota do treinamento nesta tentativa (soma das fases × fases × 10); nula até concluir. */
    nota: integer(),
  },
  (t) => [
    check("treinamento_servico_tentativa_fases_certas_check", sql`${t.fasesCertas} >= 0`),
    check("treinamento_servico_tentativa_nota_check", sql`${t.nota} is null or ${t.nota} >= 0`),
    check("treinamento_servico_tentativa_pontuada_concluida", sql`not ${t.pontuada} or ${t.concluidaEm} is not null`),
    // Pré-visualização nunca pontua (é o admin testando o rascunho, que não joga).
    check("treinamento_servico_tentativa_previa_sem_pontos", sql`not ${t.preVisualizacao} or not ${t.pontuada}`),
    uniqueIndex("treinamento_servico_tentativa_pontuada_idx").on(t.usuarioId, t.treinamentoId).where(sql`${t.pontuada}`),
    index("treinamento_servico_tentativa_usuario_idx").on(t.usuarioId, t.treinamentoId),
  ],
).enableRLS();

/**
 * A resposta de uma fase. PK composta (`tentativa_id`, `fase`): a segunda chamada à mesma fase não substitui a primeira
 * (`on conflict do nothing`), porque vale a primeira resposta (Decisão da seção 3.8 do `vitoria.md`). Com a nota (seção 12
 * do `treinamentos-de-servico.md`), guarda também os acertos, o tempo e os pontos da fase; `confirmada` é falsa na fase que
 * a pessoa não confirmou e que foi corrigida, ao finalizar, pelo que tinha feito nela.
 */
export const treinamentoServicoResposta = pgTable(
  "treinamento_servico_resposta",
  {
    tentativaId: uuid()
      .notNull()
      .references(() => treinamentoServicoTentativa.id),
    /** Posição da fase no array `fases` da versão (0-based). */
    fase: integer().notNull(),
    resposta: jsonb().notNull(),
    certa: boolean().notNull(),
    respondidaEm: instante().notNull().defaultNow(),
    /** Os acertos e as respostas certas possíveis da fase (a base: 10 × acertos ÷ possíveis). */
    acertos: integer().notNull().default(0),
    possiveis: integer().notNull().default(1),
    /** O tempo gasto na fase, somadas as vezes que a pessoa esteve nela. */
    tempoMs: integer().notNull().default(0),
    /** Os pontos da fase: a base vezes o multiplicador do tempo (de 0 a 10). */
    pontos: doublePrecision().notNull().default(0),
    confirmada: boolean().notNull().default(true),
  },
  (t) => [
    primaryKey({ name: "treinamento_servico_resposta_pkey", columns: [t.tentativaId, t.fase] }),
    check("treinamento_servico_resposta_fase_check", sql`${t.fase} >= 0`),
    check("treinamento_servico_resposta_acertos_check", sql`${t.acertos} between 0 and ${t.possiveis}`),
    check("treinamento_servico_resposta_pontos_check", sql`${t.pontos} between 0 and 10`),
  ],
).enableRLS();

/** "Reportar problema": um aviso de texto livre do técnico sobre uma fase (ou o treinamento todo, com `fase` nula) para o admin tratar. */
export const treinamentoServicoReporte = pgTable(
  "treinamento_servico_reporte",
  {
    id: uuid().primaryKey().defaultRandom(),
    versaoId: uuid()
      .notNull()
      .references(() => treinamentoServicoVersao.id),
    fase: integer(),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    texto: text().notNull(),
    criadoEm: instante().notNull().defaultNow(),
    tratadoEm: instante(),
    tratadoPor: uuid().references(() => usuario.id),
  },
  (t) => [
    check("treinamento_servico_reporte_fase_check", sql`${t.fase} is null or ${t.fase} >= 0`),
    check("treinamento_servico_reporte_texto_preenchido", sql`btrim(${t.texto}) <> ''`),
    check("treinamento_servico_reporte_tratamento", sql`(${t.tratadoEm} is null) = (${t.tratadoPor} is null)`),
    index("treinamento_servico_reporte_versao_idx").on(t.versaoId),
    index("treinamento_servico_reporte_pendentes_idx").on(t.versaoId).where(sql`${t.tratadoEm} is null`),
  ],
).enableRLS();
