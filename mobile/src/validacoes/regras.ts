/**
 * As contas da página Validações no app (sem React Native, para testar): para onde cada item leva e o que o filtro mostra. O app abre
 * na própria tela o que ele sabe decidir (a conferência, a sugestão de materiais, o detalhe da OS que ainda espera a conferência) e
 * leva à web o que só lá existe (a assinatura final da OS, o treinamento de um serviço, a resposta às ausências da equipe).
 */

import type { NomeDeIcone } from "@/ui/Icone";
import { TIPOS_DE_VALIDACAO, type ItemDeValidacao, type TipoDeValidacao, type Validacoes } from "@shared/api/validacoes";

export type DestinoDaValidacao = { onde: "app"; rota: string } | { onde: "web"; caminho: string };

export const iconeDoTipo: Record<TipoDeValidacao, NomeDeIcone> = {
  os_ciencia: "document-text-outline",
  treinamento: "school-outline",
  sugestao_material: "list-outline",
  conferencia: "checkmark-done-outline",
  ausencia: "calendar-outline",
};

/**
 * Para onde o item leva. Os caminhos da web são os de `web/src/lib/validacoes.ts` (`enderecoDaValidacao`); a ciência da OS é assinada
 * no detalhe dela na web, e a OS que ainda espera a conferência abre no app, onde a conferência está.
 */
export function destinoDaValidacao(item: ItemDeValidacao): DestinoDaValidacao {
  switch (item.tipo) {
    case "os_ciencia":
      return item.acao === "aguardar_conferencia" ? { onde: "app", rota: `/os/${item.id}` } : { onde: "web", caminho: `/app/os/${item.id}` };
    case "treinamento":
      return { onde: "web", caminho: `/app/catalogo/servicos/${encodeURIComponent(item.atividade_codigo ?? "")}/treinamento/validar` };
    case "sugestao_material":
      return { onde: "app", rota: `/materiais/${item.id}` };
    case "conferencia":
      return { onde: "app", rota: `/os/${item.os_id ?? ""}/conferencia?c=${item.id}` };
    case "ausencia":
      return { onde: "web", caminho: `/app/equipes/${item.equipe_id ?? ""}#ausencias` };
  }
}

/** Os itens do filtro (`null` = tudo). */
export function itensDoFiltro(fila: Pick<Validacoes, "itens">, filtro: TipoDeValidacao | null): ItemDeValidacao[] {
  return filtro ? fila.itens.filter((i) => i.tipo === filtro) : fila.itens;
}

/** Os tipos que ganham botão no filtro: os que têm item e, se a pessoa já filtrou por um que esvaziou, esse também (para poder sair dele). */
export function tiposDoFiltro(fila: Pick<Validacoes, "por_tipo">, filtro: TipoDeValidacao | null): TipoDeValidacao[] {
  return TIPOS_DE_VALIDACAO.filter((t) => fila.por_tipo[t] > 0 || t === filtro);
}

/** O que a faixa do topo diz sobre a fila. */
export function resumoDaFila(total: number): string {
  return total === 0 ? "Nada esperando" : total === 1 ? "1 esperando você" : `${total} esperando você`;
}
