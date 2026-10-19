/**
 * As pendências do rascunho de treinamento feito pela IA (`funcionalidades/vitoria.md`, seção 3.6), lidas pelos dois
 * lados por caminho relativo, como o manifesto da Vitória: a `api` recusa publicar com pendência aberta, e a web mostra
 * e atualiza as pendências enquanto o admin edita, sem esperar o servidor.
 *
 * Cada passo e cada fase que a IA montou leva `ia`: o trecho do texto de onde saiu (`origem`), as pendências que as
 * conferências acharam na hora da geração e a `impressao` do conteúdo como a IA o entregou. Uma pendência fica aberta
 * até o admin editar o item (a impressão deixa de bater) ou confirmá-lo (`conferido`).
 */

import { fnv1a } from "./jogos";

export interface PendenciaDoItem {
  codigo: string;
  mensagem: string;
}

/** O que acompanha um passo ou uma fase montada pela IA. Itens criados à mão não têm `ia`. */
export interface MetaIA {
  /** O trecho do texto do procedimento de onde o item saiu, como a IA o citou. */
  origem: string;
  /** `impressaoDoItem` do item como a IA o entregou; editar o item muda a impressão. */
  impressao: string;
  pendencias: PendenciaDoItem[];
  /** O admin conferiu o item como está e confirmou. */
  conferido: boolean;
}

export interface PendenciaAberta extends PendenciaDoItem {
  parte: "passo" | "fase";
  /** Posição do item na lista (0-based). */
  indice: number;
}

/** Campos que não mudam o conteúdo: a meta da IA e a posição do passo (reordenar não é editar). */
const IGNORADOS = new Set(["ia", "ordem"]);

/** JSON com as chaves em ordem e sem os campos vazios (`null`/`undefined`), para a mesma coisa ter sempre o mesmo texto. */
function canonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(",")}]`;
  if (valor && typeof valor === "object") {
    const pares = Object.entries(valor as Record<string, unknown>)
      .filter(([chave, v]) => !IGNORADOS.has(chave) && v !== null && v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([chave, v]) => `${JSON.stringify(chave)}:${canonico(v)}`);
    return `{${pares.join(",")}}`;
  }
  return JSON.stringify(valor ?? null);
}

/** FNV-1a de 32 bits do conteúdo canônico do item: não é segurança, só "mudou ou não mudou desde que a IA entregou". */
export function impressaoDoItem(item: object): string {
  return fnv1a(canonico(item));
}

/** O item ainda está como a IA o entregou (não foi editado nem confirmado)? Só então as pendências dele valem. */
export function itemSemRevisao(item: { ia?: MetaIA | null }): boolean {
  return Boolean(item.ia && !item.ia.conferido && item.ia.impressao === impressaoDoItem(item));
}

/** As pendências que ainda impedem publicar, na ordem da tela: os passos e depois as fases. */
export function pendenciasAbertas(conteudo: { explicacao: { ia?: MetaIA | null }[]; fases: { ia?: MetaIA | null }[] }): PendenciaAberta[] {
  const abertas: PendenciaAberta[] = [];
  const juntar = (parte: PendenciaAberta["parte"], itens: { ia?: MetaIA | null }[]) =>
    itens.forEach((item, indice) => {
      if (!itemSemRevisao(item)) return;
      for (const p of item.ia!.pendencias) abertas.push({ parte, indice, codigo: p.codigo, mensagem: p.mensagem });
    });
  juntar("passo", conteudo.explicacao);
  juntar("fase", conteudo.fases);
  return abertas;
}
