/**
 * Sugestão e contestação da lista de materiais de um serviço, como a `api` devolve (`/sugestoes-materiais`). Qualquer pessoa
 * que não seja administradora sugere uma lista nova ou corrigida, ou contesta a lista recomendada (com o motivo); quem avalia é
 * o supervisor da equipe que mais faz o serviço (`docs/operacao-de-campo.md`, seções 10.2 a 10.5). Chaves em snake_case.
 */

import type { CategoriaMaterial, MaterialDoServico } from "./catalogo";
import type { Paginacao } from "./tipos";

export const TIPOS_DE_SUGESTAO = ["sugestao", "contestacao"] as const;
export type TipoDeSugestao = (typeof TIPOS_DE_SUGESTAO)[number];

export const ESTADOS_DE_SUGESTAO = ["pendente", "aceita", "recusada", "cancelada"] as const;
export type EstadoDeSugestao = (typeof ESTADOS_DE_SUGESTAO)[number];

export const rotuloDoTipoDeSugestao: Record<TipoDeSugestao, string> = {
  sugestao: "Sugestão de lista",
  contestacao: "Contestação da lista",
};

export const rotuloDoEstadoDeSugestao: Record<EstadoDeSugestao, string> = {
  pendente: "Aguardando avaliação",
  aceita: "Aceita",
  recusada: "Recusada",
  cancelada: "Retirada",
};

/** Mais itens que isto não cabem numa lista de serviço (o mesmo limite do catálogo). */
export const MAX_ITENS_DA_SUGESTAO = 100;
/** Motivo da contestação e da recusa: o mínimo para a justificativa dizer alguma coisa. */
export const MIN_CARACTERES_DO_MOTIVO = 10;
export const MAX_CARACTERES_DO_MOTIVO = 1000;

/** Um item da lista proposta: do catálogo (`material_id`) ou digitado ("Não achei", `material_id` nulo e `descricao_livre`). */
export interface ItemDaSugestao {
  ordem: number;
  material_id: string | null;
  /** Do catálogo (preenchidos quando `material_id` existe) ou digitados pela pessoa. */
  codigo: string | null;
  descricao: string;
  unidade: string;
  categoria: CategoriaMaterial;
  quantidade: number | null;
  observacao: string | null;
}

export interface EquipeDoServico {
  equipe_id: string;
  nome: string;
  /** OS do serviço que a equipe tem (sem as canceladas e as devolvidas ao SAP). */
  os_total: number;
  /** Pontos gerais da equipe: o desempate. */
  pontos: number;
  supervisor_nome: string | null;
  /** A que mais faz o serviço (no empate, a de mais pontos): avalia as sugestões e as contestações. */
  responsavel: boolean;
}

export interface SugestaoResumo {
  id: string;
  atividade_codigo: string;
  atividade_descricao: string;
  tipo: TipoDeSugestao;
  estado: EstadoDeSugestao;
  autor_id: string;
  autor_nome: string;
  equipe_responsavel_id: string | null;
  equipe_responsavel_nome: string | null;
  motivo: string | null;
  tem_lista: boolean;
  itens_total: number;
  criada_em: string;
  avaliada_em: string | null;
  /** O que o autor pode fazer / o que a pessoa pode fazer com ela (calculado para quem pede). */
  posso_avaliar: boolean;
  posso_retirar: boolean;
}

export interface Sugestao extends SugestaoResumo {
  itens: ItemDaSugestao[];
  /** A lista do serviço quando a sugestão foi enviada (a base da diferença). */
  lista_base: ItemDaLista[];
  /** A lista do serviço agora. Se difere de `lista_base`, a sugestão está desatualizada. */
  lista_atual: MaterialDoServico[];
  desatualizada: boolean;
  avaliada_por_nome: string | null;
  resposta: string | null;
  /** O avaliador mudou a lista antes de aceitar. */
  ajustada: boolean;
}

/** A lista como foi gravada na base da sugestão: só o que identifica o item e o que o serviço leva dele. */
export interface ItemDaLista {
  material_id: string;
  descricao: string;
  unidade: string;
  quantidade: number | null;
  observacao: string | null;
}

export interface ListaDeSugestoes extends Paginacao {
  sugestoes: SugestaoResumo[];
}

/** Um item que o autor (ou o avaliador, ao aceitar) manda: do catálogo, ou digitado. */
export interface ItemEnviado {
  material_id?: string | null;
  /** Item "Não achei": digitado, a ser ligado a um material do catálogo (ou cadastrado) por quem avalia. */
  descricao?: string;
  unidade?: string;
  categoria?: CategoriaMaterial;
  quantidade?: number | null;
  observacao?: string | null;
}

// ---- A diferença entre duas listas ----------------------------------------------------------------------------------

export interface MudancaDeItem {
  tipo: "adicionado" | "removido" | "alterado" | "igual";
  /** A chave do item (`material_id`, ou a descrição digitada em minúsculas). */
  chave: string;
  descricao: string;
  unidade: string;
  antes: { quantidade: number | null; observacao: string | null } | null;
  depois: { quantidade: number | null; observacao: string | null } | null;
}

interface ItemComparavel {
  material_id?: string | null;
  descricao: string;
  unidade: string;
  quantidade: number | null;
  observacao: string | null;
}

const chaveDoItem = (i: ItemComparavel) => i.material_id ?? `livre:${i.descricao.trim().toLowerCase()}|${i.unidade.trim().toLowerCase()}`;

/**
 * O que a lista proposta muda na lista de base: itens adicionados, removidos e com quantidade ou observação alteradas, mais os
 * que ficam iguais (para a tela mostrar a lista inteira). A ordem é a da proposta, com os removidos no fim.
 */
export function diferencaDeListas(base: ItemComparavel[], proposta: ItemComparavel[]): MudancaDeItem[] {
  const antes = new Map(base.map((i) => [chaveDoItem(i), i]));
  const saida: MudancaDeItem[] = [];
  const vistos = new Set<string>();
  for (const i of proposta) {
    const chave = chaveDoItem(i);
    vistos.add(chave);
    const velho = antes.get(chave);
    const depois = { quantidade: i.quantidade, observacao: i.observacao ?? null };
    if (!velho) saida.push({ tipo: "adicionado", chave, descricao: i.descricao, unidade: i.unidade, antes: null, depois });
    else {
      const anterior = { quantidade: velho.quantidade, observacao: velho.observacao ?? null };
      const igual = anterior.quantidade === depois.quantidade && anterior.observacao === depois.observacao;
      saida.push({ tipo: igual ? "igual" : "alterado", chave, descricao: i.descricao, unidade: i.unidade, antes: anterior, depois });
    }
  }
  for (const i of base) {
    const chave = chaveDoItem(i);
    if (!vistos.has(chave)) saida.push({ tipo: "removido", chave, descricao: i.descricao, unidade: i.unidade, antes: { quantidade: i.quantidade, observacao: i.observacao ?? null }, depois: null });
  }
  return saida;
}

/** Quantas mudanças de verdade há (sem os itens iguais). */
export const totalDeMudancas = (mudancas: MudancaDeItem[]) => mudancas.filter((m) => m.tipo !== "igual").length;

/** "2 par", "1,5 L" ou "conforme a necessidade". */
export function textoDaQuantidade(quantidade: number | null, unidade: string): string {
  return quantidade === null ? "conforme a necessidade" : `${String(quantidade).replace(".", ",")} ${unidade}`;
}

/** Uma frase curta da mudança, para o aviso: "+ Luva (2 par); − Fita veda-rosca; ~ Detector (1 un → 2 un)". */
export function resumoDasMudancas(mudancas: MudancaDeItem[], limite = 4): string {
  const reais = mudancas.filter((m) => m.tipo !== "igual");
  const partes = reais.slice(0, limite).map((m) => {
    if (m.tipo === "adicionado") return `+ ${m.descricao}`;
    if (m.tipo === "removido") return `− ${m.descricao}`;
    return `~ ${m.descricao} (${textoDaQuantidade(m.antes!.quantidade, m.unidade)} → ${textoDaQuantidade(m.depois!.quantidade, m.unidade)})`;
  });
  const resto = reais.length - partes.length;
  return resto > 0 ? `${partes.join("; ")}; e mais ${resto}` : partes.join("; ");
}
