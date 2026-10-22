import { sql } from "drizzle-orm";
import { boolean, check, index, jsonb, numeric, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { NIVEIS_DE_RISCO, type CausaDeRisco, type HoraDoClima } from "../../../../shared/api/clima";
import { apr } from "./apr";
import { emLista, instante } from "./comum";
import { execucao } from "./execucao";
import { usuario } from "./usuarios";

export const CLIMA_MOMENTOS = ["apr", "encerramento"] as const;
export const CLIMA_ORIGENS = ["aparelho", "padrao"] as const;

/**
 * O clima na hora da APR e do encerramento da execução (`docs/operacao-de-campo.md`, seção 4.7): a cópia do que a pessoa viu, porque a
 * previsão muda ao longo do dia e o relatório do supervisor precisa mostrar o que valia na hora. Uma linha por APR (a previsão da
 * pergunta de clima, com a confirmação do aviso) e uma por execução (as condições no encerramento). Só informativo: nada é bloqueado
 * por ela, e a APR e a execução valem sem a linha (provedor fora do ar, aparelho sem sinal).
 */
export const climaRegistro = pgTable(
  "clima_registro",
  {
    id: uuid().primaryKey().defaultRandom(),
    momento: text({ enum: CLIMA_MOMENTOS }).notNull(),
    aprId: uuid().references(() => apr.id),
    execucaoId: uuid().references(() => execucao.id),
    nivel: text({ enum: NIVEIS_DE_RISCO }).notNull(),
    titulo: text().notNull(),
    orientacao: text().notNull(),
    causas: jsonb().$type<CausaDeRisco[]>().notNull().default(sql`'[]'::jsonb`),
    horas: jsonb().$type<HoraDoClima[]>().notNull().default(sql`'[]'::jsonb`),
    localNome: text().notNull(),
    localOrigem: text({ enum: CLIMA_ORIGENS }).notNull(),
    latitude: numeric({ precision: 9, scale: 6, mode: "number" }).notNull(),
    longitude: numeric({ precision: 9, scale: 6, mode: "number" }).notNull(),
    /** Quando a previsão foi consultada (no aparelho; pode ser bem antes de a APR ser concluída, se foi offline). */
    consultadaEm: instante().notNull(),
    /** Só na APR: respondeu "favorável" com a previsão apontando risco e confirmou o aviso. */
    confirmouApesarDoAviso: boolean(),
    criadoPor: uuid()
      .notNull()
      .references(() => usuario.id),
    criadoEm: instante().notNull().defaultNow(),
  },
  (t) => [
    check("clima_registro_momento_check", emLista(t.momento, CLIMA_MOMENTOS)),
    check("clima_registro_nivel_check", emLista(t.nivel, NIVEIS_DE_RISCO)),
    check("clima_registro_origem_check", emLista(t.localOrigem, CLIMA_ORIGENS)),
    check("clima_registro_dono", sql`(${t.momento} = 'apr' and ${t.aprId} is not null and ${t.execucaoId} is null) or (${t.momento} = 'encerramento' and ${t.execucaoId} is not null and ${t.aprId} is null)`),
    check("clima_registro_confirmacao_so_na_apr", sql`${t.confirmouApesarDoAviso} is null or ${t.momento} = 'apr'`),
    check("clima_registro_latitude_check", sql`${t.latitude} between -90 and 90`),
    check("clima_registro_longitude_check", sql`${t.longitude} between -180 and 180`),
    uniqueIndex("clima_registro_apr_idx").on(t.aprId).where(sql`${t.aprId} is not null`),
    uniqueIndex("clima_registro_execucao_idx").on(t.execucaoId).where(sql`${t.execucaoId} is not null`),
    index("clima_registro_nivel_idx").on(t.nivel).where(sql`${t.nivel} <> 'sem_risco'`),
  ],
).enableRLS();

/** Os valores que o admin edita em `/app/configuracoes` (ver `dominio/configuracoes.ts`); sem linha, vale o do ambiente ou o padrão. */
export const CONFIGURACOES_CHAVES = [
  "cidade_padrao",
  "sap_leitura_intervalo_min",
  "rh_leitura_hora",
  "email_resumo_hora",
  "vitoria_limite_por_conversa",
  "vitoria_limite_por_conta_dia",
  "vitoria_limite_global_dia",
  "vitoria_max_tokens_resposta",
  "treinamento_ia_limite_treinamentos",
  "treinamento_ia_limite_rodadas",
  "treinamento_ia_max_tokens",
] as const;
export type ConfiguracaoChave = (typeof CONFIGURACOES_CHAVES)[number];

/** Uma linha por valor configurado no sistema; só existe depois que o admin muda o valor (e some ao "voltar ao padrão"). */
export const configuracao = pgTable(
  "configuracao",
  {
    chave: text({ enum: CONFIGURACOES_CHAVES }).primaryKey(),
    valor: jsonb().notNull(),
    atualizadoEm: instante().notNull().defaultNow(),
    atualizadoPor: uuid().references(() => usuario.id),
  },
  (t) => [check("configuracao_chave_check", emLista(t.chave, CONFIGURACOES_CHAVES))],
).enableRLS();
