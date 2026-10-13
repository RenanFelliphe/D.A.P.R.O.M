/**
 * Catálogo de serviço, como a `api` devolve (`/catalogo/materiais` e `/catalogo/servicos`). Cada serviço é uma
 * atividade do plano de manutenção (a mesma que liga a OS ao modelo de APR) com os materiais, ferramentas e EPIs que ele
 * usa. Só o admin edita; todos leem, e o técnico vê a lista no detalhe da OS. Chaves em snake_case.
 */

import type { Paginacao } from "./tipos";

export type CategoriaMaterial = "material" | "ferramenta" | "epi";

export const CATEGORIAS: CategoriaMaterial[] = ["material", "ferramenta", "epi"];

export const rotuloDaCategoria: Record<CategoriaMaterial, string> = {
  material: "Material",
  ferramenta: "Ferramenta",
  epi: "EPI",
};

/** Título do grupo de itens de uma categoria, no detalhe da OS e no catálogo. */
export const tituloDaCategoria: Record<CategoriaMaterial, string> = {
  material: "Materiais",
  ferramenta: "Ferramentas e instrumentos",
  epi: "EPIs",
};

/** Unidades mais comuns, sugeridas no campo (`datalist` `unidades-material`); qualquer outra pode ser digitada. */
export const UNIDADES_SUGERIDAS = ["un", "par", "m", "kg", "L", "cx", "rolo", "folha", "kit"];

/** Um item do catálogo de materiais. */
export interface Material {
  id: string;
  /** Código do material no SAP, quando existe. */
  codigo: string | null;
  descricao: string;
  unidade: string;
  categoria: CategoriaMaterial;
  /** Desativado: não entra em mais nenhum serviço, mas continua nos que já o listam. */
  ativo: boolean;
  criado_em: string;
  /** Em quantos serviços aparece. */
  servicos_total: number;
}

export interface ListaDeMateriais extends Paginacao {
  materiais: Material[];
}

/** Um item da lista de um serviço. */
export interface MaterialDoServico {
  material_id: string;
  codigo: string | null;
  descricao: string;
  unidade: string;
  categoria: CategoriaMaterial;
  ativo: boolean;
  /** Quantidade prevista por execução, na unidade do material; nula = conforme a necessidade. */
  quantidade: number | null;
  observacao: string | null;
  ordem: number;
}

/** Um serviço do catálogo: a atividade e a lista do que ela usa. */
export interface ServicoDoCatalogo {
  codigo: string;
  descricao: string;
  modelo_apr_codigo: string | null;
  provisorio: boolean;
  materiais: MaterialDoServico[];
}

export interface ListaDeServicos extends Paginacao {
  servicos: ServicoDoCatalogo[];
}

/** O serviço que vem no detalhe da OS (`servico` do `GET /os/{id}`); nulo quando a OS não tem atividade. */
export interface ServicoDaOs {
  codigo: string;
  descricao: string;
  materiais: MaterialDoServico[];
}

const fmtQuantidade = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

/** "2 par", "3,6 L" ou "conforme a necessidade". */
export const quantidadeDoItem = (i: Pick<MaterialDoServico, "quantidade" | "unidade">) =>
  i.quantidade === null ? "conforme a necessidade" : `${fmtQuantidade.format(i.quantidade)} ${i.unidade}`;

/** Os itens da lista agrupados por categoria, na ordem material → ferramenta → EPI e, dentro de cada uma, na ordem da lista. */
export function porCategoria<T extends { categoria: CategoriaMaterial }>(itens: T[]): { categoria: CategoriaMaterial; itens: T[] }[] {
  return CATEGORIAS.map((categoria) => ({ categoria, itens: itens.filter((i) => i.categoria === categoria) })).filter((g) => g.itens.length > 0);
}

/** `GET/PUT /catalogo/servicos/{codigo}`: o código do plano pode ter pontos, barras e espaços (`8.7.2/8.7.3`), então vai codificado. */
export const caminhoDoServico = (codigo: string) => `/catalogo/servicos/${encodeURIComponent(codigo)}`;
