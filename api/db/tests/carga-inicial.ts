/**
 * Teste da carga inicial: aplica as migrações num Postgres embutido (PGlite), carrega os 8 modelos de APR e a tabela de
 * atividades, e confere o que a especificação exige de um modelo publicado. Rodar com `pnpm db:test`.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { join } from "node:path";
import { carregarDadosIniciais } from "../../src/db/seed/carregar";

const cliente = new PGlite();
// Em runtime o Drizzle também precisa do `casing`, igual ao drizzle.config.ts (a conexão da api deve fazer o mesmo).
const db = drizzle(cliente, { casing: "snake_case" });
await migrate(db, { migrationsFolder: join(import.meta.dirname, "..", "migrations") });

let falhas = 0;
function confere(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "ok" : "XX"}  ${nome}${detalhe ? " · " + detalhe : ""}`);
}
const consulta = async <T = Record<string, unknown>>(sql: string) => (await cliente.query<T>(sql)).rows;

const primeira = await carregarDadosIniciais(db);
confere("carrega os 8 modelos", primeira.modelosCarregados.length === 8, primeira.modelosCarregados.join(", "));
confere("carrega as atividades", primeira.atividadesInseridas > 100, `${primeira.atividadesInseridas}`);

const modelos = await consulta<{ codigo: string; versao: number; data_documento: string; publicado_em: string | null; pae: any }>(
  "select codigo, versao, data_documento::text, publicado_em, pae from modelo_apr order by codigo",
);
confere("todos os modelos entram publicados", modelos.every((m) => m.publicado_em !== null));
confere("versão e data do documento", modelos.find((m) => m.codigo === "APR 01")?.versao === 4 && modelos.find((m) => m.codigo === "APR 01")?.data_documento === "2026-07-24");
confere("PAE guardado com as linhas de contatos", modelos.every((m) => Array.isArray(m.pae?.linhas) && m.pae.linhas.length > 5));

// Regras de publicação da especificação (Modelo de APR): ao menos um item eliminatório e todo item de verificação com
// resposta bloqueante.
const semEliminatorio = await consulta(
  "select m.codigo from modelo_apr m where not exists (select 1 from item_modelo_apr i where i.modelo_apr_id = m.id and i.tipo = 'eliminatorio')",
);
confere("todo modelo tem item eliminatório", semEliminatorio.length === 0, JSON.stringify(semEliminatorio));
const verificacaoSemResposta = await consulta(
  "select modelo_apr_id from item_modelo_apr where secao = 'verificacao' and resposta_bloqueante is null",
);
confere("todo item de verificação tem resposta bloqueante", verificacaoSemResposta.length === 0);

// Hierarquia Classificação → Risco → Medida.
const medidaDeOutroModelo = await consulta(
  "select i.id from item_modelo_apr i join risco_modelo_apr r on r.id = i.risco_id where r.modelo_apr_id <> i.modelo_apr_id",
);
confere("medida só aponta para risco do próprio modelo", medidaDeOutroModelo.length === 0);
const riscoSemMedida = await consulta(
  "select r.id from risco_modelo_apr r where not exists (select 1 from item_modelo_apr i where i.risco_id = r.id)",
);
confere("todo risco tem medidas", riscoSemMedida.length === 0);

// "NA": colunas das APR 04 e 05 (todos os itens) e o item de espaço confinado da APR 06 (questão 61).
const na = await consulta<{ codigo: string; n: number }>(
  "select m.codigo, count(*)::int n from item_modelo_apr i join modelo_apr m on m.id = i.modelo_apr_id where i.permite_na group by 1 order by 1",
);
confere("permite_na só nas APR 04, 05 e 06", na.map((x) => x.codigo).join(",") === "APR 04,APR 05,APR 06", JSON.stringify(na));
const explosividade = await consulta<{ permite_na: boolean }>("select permite_na from item_modelo_apr where texto ilike '%teste de explosividade%'");
confere("item de explosividade da APR 06 aceita NA", explosividade.length === 1 && explosividade[0]!.permite_na);

// Critério de bloqueio provisório (a Segurança redefine no editor).
const iluminacao = await consulta<{ tipo: string; resposta_bloqueante: string }>("select tipo, resposta_bloqueante from item_modelo_apr where texto ilike '%iluminação auxiliar%'");
confere("iluminação auxiliar é só alerta", iluminacao.length > 0 && iluminacao.every((i) => i.tipo === "alerta" && i.resposta_bloqueante === "sim"));
const impedimento = await consulta<{ tipo: string; resposta_bloqueante: string }>("select tipo, resposta_bloqueante from item_modelo_apr where texto ilike 'Existe algum impedimento%'");
confere("impedimento bloqueia no Sim", impedimento.length === 8 && impedimento.every((i) => i.tipo === "eliminatorio" && i.resposta_bloqueante === "sim"), `${impedimento.length} modelos`);
const medidasNaoAlerta = await consulta("select id from item_modelo_apr where secao = 'medida_preventiva' and (tipo <> 'alerta' or resposta_bloqueante is not null)");
confere("medidas preventivas não bloqueiam nem avisam por padrão", medidasNaoAlerta.length === 0);
const texto = await consulta<{ n: number }>("select count(*)::int n from item_modelo_apr where evidencia = 'texto'");
confere("evidência em texto só nas condições psicológicas", texto[0]!.n === 8);

// Atividades: todas provisórias (a atividade não escolhe o modelo da APR).
const atividadesDef = await consulta<{ n: number }>("select count(*)::int n from atividade where not provisorio");
confere("todas as atividades entram como provisórias", atividadesDef[0]!.n === 0);

// Orientação: uma por modelo da carga, com descrição, exemplos e palavras-chave.
const orientacoes = await consulta<{ codigo: string; descricao: string; exemplos: string[]; palavras_chave: string[] }>("select codigo, descricao, exemplos, palavras_chave from orientacao_modelo_apr order by codigo");
confere(
  "orientação dos 8 modelos da carga",
  orientacoes.map((o) => o.codigo).join(",") === "APR 01,APR 02,APR 03,APR 04,APR 05,APR 06,APR 07,APR 09",
  orientacoes.map((o) => o.codigo).join(","),
);
confere("toda orientação tem descrição, exemplos e palavras-chave", orientacoes.every((o) => o.descricao.length > 20 && o.exemplos.length >= 4 && o.palavras_chave.length >= 5));

// Reexecutar não duplica nem desfaz o que o admin editou.
await cliente.query("update atividade set descricao = 'Drenagem (revisada)', provisorio = false where codigo = '8.7.1'");
await cliente.query("update orientacao_modelo_apr set descricao = 'Editada pelo admin' where codigo = 'APR 03'");
const segunda = await carregarDadosIniciais(db);
confere(
  "segunda carga não insere nada",
  segunda.modelosCarregados.length === 0 && segunda.modelosJaExistentes.length === 8 && segunda.atividadesInseridas === 0 && segunda.orientacoesInseridas === 0,
);
const editada = await consulta<{ descricao: string; provisorio: boolean }>("select descricao, provisorio from atividade where codigo = '8.7.1'");
confere("segunda carga preserva a edição da atividade", editada[0]?.descricao === "Drenagem (revisada)" && editada[0]?.provisorio === false);
const orientacaoEditada = await consulta<{ descricao: string }>("select descricao from orientacao_modelo_apr where codigo = 'APR 03'");
confere("segunda carga preserva a edição da orientação", orientacaoEditada[0]?.descricao === "Editada pelo admin");

await cliente.close();
if (falhas > 0) {
  console.log(`\n${falhas} falha(s)`);
  process.exit(1);
}
console.log("\ncarga inicial ok");
