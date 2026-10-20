import type { CategoriaMaterial, Material, MaterialDoServico } from "@/lib/catalogo";
import { novoUuid } from "@/lib/uuid";
import type { ItemDaSugestao, ItemEnviado, TipoDeSugestao } from "../../../shared/api/sugestao-materiais";

/** Movido para `shared/api/sugestao-materiais.ts`: o app (`mobile`) usa o mesmo código (tipos e o cálculo da diferença entre listas). */
export * from "../../../shared/api/sugestao-materiais";

/**
 * Um item da lista que a pessoa está montando: o material do catálogo (`material_id`) ou o item digitado ("Não achei", sem
 * `material_id`). A quantidade fica como texto, para aceitar "3,6" enquanto digita.
 */
export interface ItemEmEdicao {
  /** Identifica o item na tela (a lista pode ter dois itens digitados iguais por um instante). */
  chave: string;
  material_id: string | null;
  codigo: string | null;
  descricao: string;
  unidade: string;
  categoria: CategoriaMaterial;
  quantidade: string;
  observacao: string;
  /** Material desativado que já estava na lista: continua valendo, mas não entra em listas novas. */
  ativo: boolean;
}

/** "3,6" → 3.6; vazio → nulo (conforme a necessidade); o que não é número positivo → `NaN`. */
export function lerQuantidade(texto: string): number | null {
  const limpo = texto.trim().replace(",", ".");
  if (limpo === "") return null;
  const n = Number(limpo);
  return Number.isFinite(n) && n > 0 ? n : Number.NaN;
}

export const quantidadeEmTexto = (q: number | null) => (q === null ? "" : String(q).replace(".", ","));

export const itemDoServico = (m: MaterialDoServico): ItemEmEdicao => ({
  chave: novoUuid(),
  material_id: m.material_id,
  codigo: m.codigo,
  descricao: m.descricao,
  unidade: m.unidade,
  categoria: m.categoria,
  quantidade: quantidadeEmTexto(m.quantidade),
  observacao: m.observacao ?? "",
  ativo: m.ativo,
});

export const itemDaSugestao = (i: ItemDaSugestao): ItemEmEdicao => ({
  chave: novoUuid(),
  material_id: i.material_id,
  codigo: i.codigo,
  descricao: i.descricao,
  unidade: i.unidade,
  categoria: i.categoria,
  quantidade: quantidadeEmTexto(i.quantidade),
  observacao: i.observacao ?? "",
  ativo: true,
});

export const itemDoCatalogo = (m: Material): ItemEmEdicao => ({
  chave: novoUuid(),
  material_id: m.id,
  codigo: m.codigo,
  descricao: m.descricao,
  unidade: m.unidade,
  categoria: m.categoria,
  quantidade: "",
  observacao: "",
  ativo: m.ativo,
});

export const itemDigitado = (d: { descricao: string; unidade: string; categoria: CategoriaMaterial }): ItemEmEdicao => ({
  chave: novoUuid(),
  material_id: null,
  codigo: null,
  descricao: d.descricao.trim(),
  unidade: d.unidade.trim(),
  categoria: d.categoria,
  quantidade: "",
  observacao: "",
  ativo: true,
});

/** O item como a `api` o recebe. `criarMaterial`: quem avalia pode cadastrar o item digitado ao aceitar. */
export function itemParaEnvio(i: ItemEmEdicao, criarMaterial = false): ItemEnviado {
  const base = { quantidade: lerQuantidade(i.quantidade), observacao: i.observacao.trim() || null };
  if (i.material_id) return { material_id: i.material_id, ...base };
  return { descricao: i.descricao, unidade: i.unidade, categoria: i.categoria, ...base, ...(criarMaterial ? { criar_material: true } : {}) };
}

/** O item na forma que `diferencaDeListas` compara. */
export const itemParaComparar = (i: ItemEmEdicao) => ({
  material_id: i.material_id,
  descricao: i.descricao,
  unidade: i.unidade,
  quantidade: lerQuantidade(i.quantidade) ?? null,
  observacao: i.observacao.trim() || null,
});

/** O título e a explicação de cada fluxo, iguais na página e na janela do cartão do serviço. */
export const APRESENTACAO_DA_SUGESTAO: Record<TipoDeSugestao, { titulo: string; texto: string }> = {
  sugestao: {
    titulo: "Sugerir uma lista de materiais",
    texto: "Quem faz o serviço no campo sabe o que ele pede. Monte a lista que você acha certa; o supervisor da equipe que mais faz este serviço avalia.",
  },
  contestacao: {
    titulo: "Contestar a lista recomendada",
    texto: "Se a lista recomendada está errada, diga por quê. O supervisor da equipe que mais faz este serviço avalia, e você pode já sugerir a lista certa.",
  },
};
