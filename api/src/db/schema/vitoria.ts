import { sql } from "drizzle-orm";
import { bigint, check, date, index, integer, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";
import { PERFIS, usuario } from "./usuarios";

/**
 * A Vitória, o assistente de ajuda (`docs/ia-e-vitoria.md`, seção 4). A conversa em si nunca é guardada no servidor (seção
 * 4.3): só o uso do dia, para os 3 limites de custo (seção 4.9), e as perguntas que ela não soube responder (4.12).
 */

/**
 * Uso diário por conta, para o limite por conta/dia; o limite global do dia é a soma de `mensagens` de todas as
 * linhas de um mesmo `dia` (não há uma linha separada para o total: somar é mais simples que manter os dois
 * sincronizados). Só conta mensagens que de fato chamaram a IA (a resposta sem IA é de graça e não soma aqui).
 */
export const vitoriaUso = pgTable(
  "vitoria_uso",
  {
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    dia: date({ mode: "string" }).notNull(),
    mensagens: integer().notNull().default(0),
  },
  (t) => [
    primaryKey({ name: "vitoria_uso_pkey", columns: [t.usuarioId, t.dia] }),
    check("vitoria_uso_mensagens_check", sql`${t.mensagens} >= 0`),
    index("vitoria_uso_dia_idx").on(t.dia),
  ],
).enableRLS();

/**
 * Pergunta que a Vitória não soube responder (manual sem cobertura, ação com chave desconhecida, ou o próprio modelo
 * disse "não sei"). Sem `usuario_id` por desenho (seção 2.7): a lista serve para melhorar o manual, não para saber
 * quem perguntou.
 */
export const vitoriaPerguntaSemResposta = pgTable(
  "vitoria_pergunta_sem_resposta",
  {
    id: uuid().primaryKey().defaultRandom(),
    pergunta: text().notNull(),
    /** A "tela atual" que o cliente informou (chave usada pelas sugestões fixas; nunca a URL inteira). */
    tela: text().notNull(),
    perfil: text({ enum: PERFIS }).notNull(),
    criadaEm: instante().notNull().defaultNow(),
    tratadaEm: instante(),
    tratadaPor: uuid().references(() => usuario.id),
  },
  (t) => [
    check("vitoria_pergunta_sem_resposta_pergunta_preenchida", sql`btrim(${t.pergunta}) <> ''`),
    check("vitoria_pergunta_sem_resposta_perfil_check", emLista(t.perfil, PERFIS)),
    check("vitoria_pergunta_sem_resposta_tratamento", sql`(${t.tratadaEm} is null) = (${t.tratadaPor} is null)`),
    index("vitoria_pergunta_sem_resposta_pendentes_idx").on(t.criadaEm).where(sql`${t.tratadaEm} is null`),
  ],
).enableRLS();

/**
 * Os números do perfil da Vitória (`docs/ia-e-vitoria.md`, seção 4.14), somados por dia. Só contadores: nenhum texto de conversa e
 * nenhuma pessoa, para continuar valendo que a conversa não é guardada (seção 2.2).
 * - `respondidas`: respostas com conteúdo, pela IA ou pelo manual, e as sugestões fixas tocadas na web;
 * - `naoSei`: as vezes em que ela disse que não sabia (pela IA, pelo manual ou por um destino inventado);
 * - `comAcao`: respostas que ofereceram "Me leve lá" ou "Mostrar na tela";
 * - `idasATela`: toques nesses botões, avisados pela web;
 * - `respostasComIa` e `tempoIaMs`: quantas respostas vieram da IA e a soma do tempo que ela levou, para a média.
 */
export const vitoriaEstatistica = pgTable(
  "vitoria_estatistica",
  {
    dia: date({ mode: "string" }).primaryKey(),
    respondidas: integer().notNull().default(0),
    naoSei: integer().notNull().default(0),
    comAcao: integer().notNull().default(0),
    idasATela: integer().notNull().default(0),
    respostasComIa: integer().notNull().default(0),
    tempoIaMs: bigint({ mode: "number" }).notNull().default(0),
  },
  (t) => [
    check(
      "vitoria_estatistica_nao_negativos",
      sql`${t.respondidas} >= 0 and ${t.naoSei} >= 0 and ${t.comAcao} >= 0 and ${t.idasATela} >= 0 and ${t.respostasComIa} >= 0 and ${t.tempoIaMs} >= 0`,
    ),
  ],
).enableRLS();
