/**
 * A página "Validações" do supervisor (`GET /me/validacoes`): tudo o que espera a decisão ou a assinatura dele, numa fila só.
 * Cada item vem de uma fonte que já existia (a OS aguardando a ciência, o treinamento de serviço, a sugestão de materiais, a
 * conferência da execução e os pedidos de ausência); a página só os reúne. O desenho está em `funcionalidades/validacoes.md`.
 */

export const TIPOS_DE_VALIDACAO = ["os_ciencia", "treinamento", "sugestao_material", "conferencia", "ausencia"] as const;
export type TipoDeValidacao = (typeof TIPOS_DE_VALIDACAO)[number];

/**
 * O que a pessoa faz com o item. `decidir` é o de todo item que só pede uma decisão (treinamento, sugestão); os demais dizem o passo:
 * - OS: `assinar` ou `aguardar_conferencia` (a conferência da execução ainda compara os aparelhos, e a ciência espera);
 * - conferência: `decidir`, `fechar`, `ciencia` ou `assinar` (o que falta de quem pergunta; "aguardar" nunca entra);
 * - ausência: `pedida`, `fim_pedido` ou `vencida`.
 */
export type AcaoDeValidacao = "assinar" | "aguardar_conferencia" | "decidir" | "fechar" | "ciencia" | "pedida" | "fim_pedido" | "vencida";

export interface ItemDeValidacao {
  /** `tipo:id`, único na fila. */
  chave: string;
  tipo: TipoDeValidacao;
  acao: AcaoDeValidacao;
  /** O que identifica o item para abrir: a OS, o código do treinamento, a sugestão, a conferência ou a ausência. */
  id: string;
  /** A OS do item (ciência e conferência). */
  os_id: string | null;
  /** O serviço do item (treinamento e sugestão). */
  atividade_codigo: string | null;
  /** A equipe do item (ausência abre na equipe). */
  equipe_id: string | null;
  equipe_nome: string | null;
  titulo: string;
  detalhe: string;
  /** Desde quando espera. */
  desde: string;
  /** Até quando vale agir sem perder algo (a ciência no prazo pontua; a conferência fecha sozinha). Nulo quando não há prazo. */
  prazo_em: string | null;
  urgente: boolean;
}

export interface Validacoes {
  total: number;
  por_tipo: Record<TipoDeValidacao, number>;
  /** Os urgentes primeiro; dentro de cada grupo, os mais antigos. */
  itens: ItemDeValidacao[];
}

export const ROTULO_DO_TIPO: Record<TipoDeValidacao, string> = {
  os_ciencia: "OS para assinar",
  treinamento: "Treinamentos",
  sugestao_material: "Materiais",
  conferencia: "Conferências",
  ausencia: "Ausências",
};

/** O texto do botão de cada passo. */
export function rotuloDaAcaoDeValidacao(item: Pick<ItemDeValidacao, "tipo" | "acao">): string {
  switch (item.acao) {
    case "assinar":
      return item.tipo === "conferencia" ? "Assinar a conferência" : "Ler e assinar";
    case "aguardar_conferencia":
      return "Ver a OS";
    case "decidir":
      return item.tipo === "conferencia" ? "Escolher as versões" : item.tipo === "treinamento" ? "Revisar e decidir" : "Avaliar";
    case "fechar":
      return "Fechar com o que existe";
    case "ciencia":
      return "Dar ciência";
    case "pedida":
      return "Responder o pedido";
    case "fim_pedido":
      return "Responder o pedido de fim";
    case "vencida":
      return "Resolver a ausência";
  }
}

/** Ordena a fila: urgentes antes, e os mais antigos primeiro dentro de cada grupo. */
export function ordenarValidacoes(itens: ItemDeValidacao[]): ItemDeValidacao[] {
  return [...itens].sort((a, b) => Number(b.urgente) - Number(a.urgente) || Date.parse(a.desde) - Date.parse(b.desde) || a.chave.localeCompare(b.chave));
}
