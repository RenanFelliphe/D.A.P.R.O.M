import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { FUNCOES_DE_IA } from "../../../../shared/ia/funcoes";
import { emLista, instante } from "./comum";
import { os } from "./sap";
import { usuario } from "./usuarios";

/**
 * O controle da IA (`funcionalidades/controle-da-ia.md`): uma linha por função de IA, só depois que o admin mexe nela (sem linha
 * vale o padrão de `LIGADA_AO_INSTALAR`). O bloqueio é do módulo de IA: nenhuma chamada sai com a função desligada.
 */
export const iaFuncao = pgTable(
  "ia_funcao",
  {
    funcao: text({ enum: FUNCOES_DE_IA }).primaryKey(),
    ligada: boolean().notNull().default(false),
    /**
     * A leitura de dados reais está autorizada. Nas funções que só funcionam com dados (recomendação e digitalização) é sempre igual
     * a `ligada`; nas outras (chatbot e minigames) é uma segunda chave, que só se liga com a função ligada.
     */
    comDados: boolean().notNull().default(false),
    /** A versão do texto de "o que ela lê" (`versaoDoTexto` em `shared/ia/funcoes.ts`) que o admin assinou; só com `comDados`. */
    versaoDoTexto: integer(),
    autorizadoPor: uuid().references(() => usuario.id),
    autorizadoEm: instante(),
    /** A assinatura do perfil que o admin usou ao autorizar (cópia: refazer a do perfil não muda esta). */
    assinaturaPath: text(),
    atualizadoEm: instante().notNull().defaultNow(),
    atualizadoPor: uuid().references(() => usuario.id),
  },
  (t) => [
    check("ia_funcao_funcao_check", emLista(t.funcao, FUNCOES_DE_IA)),
    check("ia_funcao_dados_exigem_funcao_ligada", sql`not ${t.comDados} or ${t.ligada}`),
    check(
      "ia_funcao_autorizacao",
      sql`${t.comDados} = (${t.versaoDoTexto} is not null and ${t.autorizadoPor} is not null and ${t.autorizadoEm} is not null and ${t.assinaturaPath} is not null)`,
    ),
  ],
).enableRLS();

/** O que ficou guardado da análise de uma OS (a coluna `encontradas` de `os_recomendacao_apr`): o que cada modelo achou no texto. */
export interface AchadosDoModelo {
  codigo: string;
  palavras: string[];
}

/**
 * O modelo de APR recomendado para cada OS, calculado quando ela passa a existir no sistema (qualquer que tenha sido a entrada) e
 * de novo quando o texto da OS ou os modelos mudam. Fica numa tabela à parte para a linha de `os` (que vai inteira no snapshot do
 * aplicativo) não crescer. Primeiro sai a leitura por palavras-chave (instantânea, sem IA); a IA, quando ligada, corrige depois.
 */
export const osRecomendacaoApr = pgTable(
  "os_recomendacao_apr",
  {
    osId: uuid()
      .primaryKey()
      .references(() => os.id, { onDelete: "cascade" }),
    /** O código do modelo recomendado (ex.: `APR 03`); nulo quando nenhum combinou, ou quando houve empate. */
    codigo: text(),
    /** `palavras` (leitura por palavras-chave) ou `ia` (a Vitória leu a OS). */
    fonte: text({ enum: ["palavras", "ia"] }).notNull(),
    /** Só na `ia`: a frase curta com o porquê, que a tela mostra no lugar das palavras achadas. */
    motivo: text(),
    /** Por modelo, as palavras-chave que a leitura achou na OS (sempre calculadas, mesmo quando a IA decide). */
    encontradas: jsonb().$type<AchadosDoModelo[]>().notNull().default([]),
    /** Hash do texto da OS e da versão dos modelos usados: mudou, a análise está velha e é refeita. */
    chave: text().notNull(),
    analisadaEm: instante().notNull().defaultNow(),
    /** Quantas vezes a IA falhou para esta OS, e quando tentar de novo; zera quando a IA responde. */
    tentativasIa: integer().notNull().default(0),
    proximaIaEm: instante(),
  },
  (t) => [
    check("os_recomendacao_apr_fonte_check", emLista(t.fonte, ["palavras", "ia"])),
    check("os_recomendacao_apr_tentativas_check", sql`${t.tentativasIa} >= 0`),
    index("os_recomendacao_apr_ia_pendente_idx").on(t.proximaIaEm).where(sql`${t.fonte} = 'palavras'`),
  ],
).enableRLS();
