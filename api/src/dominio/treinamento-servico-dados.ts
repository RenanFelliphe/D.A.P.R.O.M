import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { apr, aprResposta, execucao, execucaoPausa, itemModeloApr, material, os, sugestaoMateriais, sugestaoMateriaisItem } from "../db/schema";
import type { Deps } from "../deps";
import { leituraDeDadosLigada } from "./ia-funcoes";
import { ROTULO_DA_PAUSA, ROTULO_DA_SUSPENSAO } from "./motivos-de-parada";

/*
 * Os minigames com dados (`funcionalidades/controle-da-ia.md`): com a leitura de dados da função Criação de jogos autorizada pelo
 * admin, o rascunho do treinamento de um serviço recebe, além do procedimento, um resumo AGREGADO do que acontece de verdade nas OS
 * desse serviço (shared/ia/funcoes.ts, campo `le` de minigames):
 * - os motivos de pausa e de suspensão das execuções, e quantas vezes cada um;
 * - os itens de APR marcados com problema, e quantas vezes;
 * - os materiais que as pessoas pediram para acrescentar à lista do serviço (sugestões aceitas), e quantas vezes.
 * Só contagens e textos fixos do sistema (motivos, itens do modelo de APR, descrição do catálogo): nunca uma pessoa, uma OS, um
 * texto livre (complemento do motivo, observação, descrição da execução) nem um id.
 */

/** Quantas linhas de cada lista vão para a IA. */
const MAX_POR_LISTA = 8;

interface Contagem {
  texto: string;
  vezes: number;
}

const lista = (itens: Contagem[]) => itens.map((i) => `- ${i.texto}: ${i.vezes} ${i.vezes === 1 ? "vez" : "vezes"}`).join("\n");

/** Junta as contagens de textos iguais e ordena do mais ao menos frequente. */
function somarIguais(itens: Contagem[]): Contagem[] {
  const soma = new Map<string, number>();
  for (const i of itens) soma.set(i.texto, (soma.get(i.texto) ?? 0) + i.vezes);
  return [...soma].map(([texto, vezes]) => ({ texto, vezes })).sort((a, b) => b.vezes - a.vezes || a.texto.localeCompare(b.texto, "pt-BR"));
}

/**
 * O bloco "dados reais deste serviço" para o rascunho, ou `null` quando a leitura de dados não está autorizada, o serviço ainda não
 * tem nada registrado ou a leitura falhou: o rascunho nunca depende dele.
 */
export async function blocoDeDadosDoServico(deps: Pick<Deps, "db">, atividadeCodigo: string): Promise<string | null> {
  try {
    if (!(await leituraDeDadosLigada(deps.db, "minigames"))) return null;
    return await montarBlocoDoServico(deps, atividadeCodigo);
  } catch (erro) {
    console.warn("Rascunho de treinamento: não consegui ler os dados do serviço; seguindo sem eles", erro);
    return null;
  }
}

/** O bloco de dados de um serviço, sem conferir a autorização (quem chama confere). `null` quando não há nada. */
export async function montarBlocoDoServico(deps: Pick<Deps, "db">, atividadeCodigo: string): Promise<string | null> {
  const { db } = deps;
  const doServico = eq(os.codigoAtividade, atividadeCodigo);

  const pausas = await db
    .select({ motivo: execucaoPausa.motivo, vezes: sql<number>`count(*)::int` })
    .from(execucaoPausa)
    .innerJoin(execucao, eq(execucao.id, execucaoPausa.execucaoId))
    .innerJoin(os, eq(os.id, execucao.osId))
    .where(and(doServico, isNotNull(execucaoPausa.motivo)))
    .groupBy(execucaoPausa.motivo);
  const suspensoes = await db
    .select({ motivo: execucao.suspensaoMotivo, vezes: sql<number>`count(*)::int` })
    .from(execucao)
    .innerJoin(os, eq(os.id, execucao.osId))
    .where(and(doServico, isNotNull(execucao.suspensaoMotivo)))
    .groupBy(execucao.suspensaoMotivo);
  const motivos = somarIguais([
    ...pausas.map((p) => ({ texto: `Pausa: ${ROTULO_DA_PAUSA[p.motivo!] ?? p.motivo!}`, vezes: p.vezes })),
    ...suspensoes.map((s) => ({ texto: `Suspensão: ${ROTULO_DA_SUSPENSAO[s.motivo!] ?? s.motivo!}`, vezes: s.vezes })),
  ]).slice(0, MAX_POR_LISTA);

  // O texto do item é o do modelo de APR (fixo), nunca a observação que a pessoa escreveu. Agrupa pelo texto: o mesmo item de versões ou modelos diferentes soma junto.
  const itens = await db
    .select({ texto: itemModeloApr.texto, vezes: sql<number>`count(*)::int` })
    .from(aprResposta)
    .innerJoin(apr, eq(apr.id, aprResposta.aprId))
    .innerJoin(os, eq(os.id, apr.osId))
    .innerJoin(itemModeloApr, eq(itemModeloApr.id, aprResposta.itemId))
    .where(and(doServico, eq(aprResposta.resposta, "nao")))
    .groupBy(itemModeloApr.texto)
    .orderBy(desc(sql`count(*)`), itemModeloApr.texto)
    .limit(MAX_POR_LISTA);

  // Só os materiais do catálogo: o item digitado ("Não achei") é texto livre e fica de fora.
  const materiais = await db
    .select({ texto: material.descricao, vezes: sql<number>`count(*)::int` })
    .from(sugestaoMateriaisItem)
    .innerJoin(sugestaoMateriais, eq(sugestaoMateriais.id, sugestaoMateriaisItem.sugestaoId))
    .innerJoin(material, eq(material.id, sugestaoMateriaisItem.materialId))
    .where(and(eq(sugestaoMateriais.atividadeCodigo, atividadeCodigo), eq(sugestaoMateriais.estado, "aceita")))
    .groupBy(material.id, material.descricao)
    .orderBy(desc(sql`count(*)`), material.descricao)
    .limit(MAX_POR_LISTA);

  const secoes = [
    motivos.length > 0 ? `Motivos de pausa e de suspensão registrados nas execuções deste serviço:\n${lista(motivos)}` : null,
    itens.length > 0 ? `Itens de verificação que as equipes marcaram com problema neste serviço:\n${lista(itens)}` : null,
    materiais.length > 0 ? `Materiais que as pessoas pediram para acrescentar à lista deste serviço (e o supervisor aceitou):\n${lista(materiais)}` : null,
  ].filter((s): s is string => s !== null);
  if (secoes.length === 0) return null;

  return [
    "Dados reais deste serviço (resumo do que aconteceu nas OS dele, sem pessoas):",
    ...secoes,
    'Como usar estes dados: só para escolher em quais assuntos do procedimento os jogos insistem (mais fases sobre o que mais dá problema). Eles NÃO são fonte de conteúdo: tudo o que vira pergunta, resposta ou passo continua saindo só do texto do procedimento, com a "origem" copiada dele. Nunca invente nem cite estes números ao técnico, não fale de APR nem de checklist, e se um assunto destes não aparece no texto, ignore-o.',
  ].join("\n\n");
}
