/**
 * Checklist de inspeção das preventivas (`docs/operacao-de-campo.md`, seção 9): as perguntas ficam no plano de manutenção, ao lado do
 * intervalo, e o técnico as marca no encerramento de cada OS do plano. A execução guarda uma cópia de cada pergunta com a
 * resposta, então mudar o checklist depois não altera o que já foi respondido.
 */

/** Uma pergunta do checklist do plano, como a `api` a devolve (`checklist` do plano, `checklist_inspecao` da OS). */
export interface PerguntaDoChecklist {
  id: string;
  texto: string;
}

/** Uma resposta guardada em `execucao.dados_inspecao.itens`. `marcado: null` é a pergunta que ficou sem resposta (fila offline). */
export interface ItemDaInspecao {
  pergunta: string;
  marcado: boolean | null;
  observacao: string | null;
}

export const MAX_PERGUNTAS_DO_CHECKLIST = 50;
export const MAX_TEXTO_DA_PERGUNTA = 300;
export const MAX_OBSERVACAO_DO_ITEM = 500;

/** A resposta que o técnico dá a uma pergunta no encerramento. */
export interface RespostaDoItem {
  marcado: boolean;
  observacao: string;
}

/** Os itens de `dados_inspecao`, ou `null` quando o dado não tem esse formato (a inspeção sem estrutura, de antes do checklist). */
export function itensDaInspecao(dados: unknown): ItemDaInspecao[] | null {
  const itens = (dados as { itens?: unknown } | null)?.itens;
  if (!Array.isArray(itens)) return null;
  return itens.filter((i): i is ItemDaInspecao => Boolean(i) && typeof i === "object" && typeof (i as ItemDaInspecao).pergunta === "string");
}

/** A pergunta não marcada pede observação; sem ela o encerramento não é liberado. */
export const faltaObservacao = (r: RespostaDoItem | undefined) => !r?.marcado && !r?.observacao.trim();

/** O `dados_inspecao` do evento `execucao_encerrada`: uma resposta por pergunta, pelo id (o servidor copia o texto). */
export function dadosDaInspecao(perguntas: PerguntaDoChecklist[], respostas: Record<string, RespostaDoItem>) {
  return {
    itens: perguntas.map((p) => ({ pergunta_id: p.id, marcado: respostas[p.id]?.marcado ?? false, observacao: respostas[p.id]?.observacao.trim() || null })),
  };
}
