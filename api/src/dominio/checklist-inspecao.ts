import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/conexao";
import { CHECKLIST_MAX_PERGUNTAS, CHECKLIST_MAX_TEXTO, planoPreventiva, planoPreventivaPergunta } from "../db/schema";
import { invalido } from "../http/erros";
import { uuid } from "../http/validacao";

/*
 * Checklist de inspeção das preventivas (`inspecao-preventivas.md`): as perguntas ficam no plano (`plano_preventiva_pergunta`)
 * e o técnico as marca no encerramento de cada OS do plano. Aqui ficam a leitura, a gravação do checklist e a busca do
 * checklist de uma OS pela chave plano + item; a conferência das respostas é do encerramento (`eventos-execucao.ts`).
 */

export interface Pergunta {
  id: string;
  texto: string;
}

/** Uma resposta do checklist, como fica em `execucao.dados_inspecao.itens`: o texto da pergunta é cópia do momento do encerramento. */
export interface ItemRespondido {
  pergunta: string;
  /** `null`: a pergunta não foi respondida (o aparelho não a conhecia, ou o encerramento veio da fila offline sem ela). */
  marcado: boolean | null;
  observacao: string | null;
}

/** O formato de `execucao.dados_inspecao` das preventivas com checklist. */
export interface DadosDeInspecao {
  itens: ItemRespondido[];
}

export const MAX_OBSERVACAO_DO_ITEM = 500;

/** O checklist como a edição do plano o recebe: a lista inteira, na ordem. Quem tem `id` é uma pergunta que já existia. */
export const esquemaChecklist = z
  .array(
    z.object({
      id: uuid.optional(),
      texto: z.string().trim().min(1, "A pergunta não pode ficar vazia").max(CHECKLIST_MAX_TEXTO, `No máximo ${CHECKLIST_MAX_TEXTO} caracteres por pergunta`),
    }),
  )
  .max(CHECKLIST_MAX_PERGUNTAS, `No máximo ${CHECKLIST_MAX_PERGUNTAS} perguntas por plano`);
export type ChecklistEditado = z.infer<typeof esquemaChecklist>;

/** As perguntas dos planos, na ordem de cada um. Plano sem checklist não aparece no mapa. */
export async function perguntasDosPlanos(db: Db, planoIds: string[]): Promise<Map<string, Pergunta[]>> {
  const mapa = new Map<string, Pergunta[]>();
  if (planoIds.length === 0) return mapa;
  const linhas = await db
    .select({ planoId: planoPreventivaPergunta.planoId, id: planoPreventivaPergunta.id, texto: planoPreventivaPergunta.texto })
    .from(planoPreventivaPergunta)
    .where(inArray(planoPreventivaPergunta.planoId, planoIds))
    .orderBy(asc(planoPreventivaPergunta.posicao), asc(planoPreventivaPergunta.criadaEm), asc(planoPreventivaPergunta.id));
  for (const { planoId, ...pergunta } of linhas) mapa.set(planoId, [...(mapa.get(planoId) ?? []), pergunta]);
  return mapa;
}

/**
 * Grava o checklist do plano: a lista recebida passa a ser a lista inteira, na ordem em que veio. A pergunta com `id` é
 * atualizada (texto e posição), a sem `id` é criada e a que ficou de fora é removida. Um `id` que não é do plano é recusado.
 * Quem chama passa a própria transação.
 */
export async function salvarChecklist(tx: Db, planoId: string, itens: ChecklistEditado): Promise<void> {
  const atuais = new Set((await perguntasDosPlanos(tx, [planoId])).get(planoId)?.map((p) => p.id) ?? []);
  const repetido = new Set<string>();
  for (const item of itens) {
    if (!item.id) continue;
    if (!atuais.has(item.id) || repetido.has(item.id)) throw invalido("pergunta_invalida", "Uma pergunta do checklist não pertence a este plano. Recarregue a tela e tente de novo.");
    repetido.add(item.id);
  }
  const mantidas = [...repetido];
  await tx.delete(planoPreventivaPergunta).where(and(eq(planoPreventivaPergunta.planoId, planoId), mantidas.length > 0 ? notInArray(planoPreventivaPergunta.id, mantidas) : undefined));
  for (const [posicao, item] of itens.entries()) {
    if (item.id) await tx.update(planoPreventivaPergunta).set({ texto: item.texto, posicao }).where(eq(planoPreventivaPergunta.id, item.id));
    else await tx.insert(planoPreventivaPergunta).values({ planoId, texto: item.texto, posicao });
  }
}

/** Plano e item de uma OS como chave de comparação (aparados; o item vazio é o plano sem item). */
const chave = (plano: string, item: string | null | undefined) => `${plano.trim()}\u0000${item?.trim() ?? ""}`;

interface OsComPlano {
  id: string;
  tipo: string;
  planoManutencao: string | null;
  itemManutencao: string | null;
}

/**
 * O checklist de cada OS preventiva: o do plano que tem o mesmo plano e item dela (a OS que só traz o plano usa o do plano
 * sem item). A OS sem checklist (corretiva, sem plano ou com plano sem perguntas) não aparece no mapa.
 */
export async function checklistsDasOs(db: Db, ordens: OsComPlano[]): Promise<Map<string, Pergunta[]>> {
  const resultado = new Map<string, Pergunta[]>();
  const preventivas = ordens.filter((o) => o.tipo === "preventiva" && o.planoManutencao?.trim());
  if (preventivas.length === 0) return resultado;
  const codigos = [...new Set(preventivas.map((o) => o.planoManutencao!.trim()))];
  const planos = await db
    .select({ id: planoPreventiva.id, plano: planoPreventiva.planoManutencao, item: planoPreventiva.itemManutencao })
    .from(planoPreventiva)
    .where(inArray(planoPreventiva.planoManutencao, codigos));
  const planoPorChave = new Map(planos.map((p) => [chave(p.plano, p.item), p.id]));
  const perguntas = await perguntasDosPlanos(db, planos.map((p) => p.id));
  for (const o of preventivas) {
    const lista = perguntas.get(planoPorChave.get(chave(o.planoManutencao!, o.itemManutencao)) ?? "");
    if (lista && lista.length > 0) resultado.set(o.id, lista);
  }
  return resultado;
}
