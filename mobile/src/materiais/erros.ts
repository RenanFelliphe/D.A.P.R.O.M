import { MIN_CARACTERES_DO_MOTIVO } from "@shared/api/sugestao-materiais";
import { ErroDaApi, mensagemDoErro } from "@/api/erros";

/** O que dizer quando a pessoa tenta sugerir ou contestar sem sinal: a sugestão não entra na fila do aparelho. */
export const MENSAGEM_SEM_SINAL = "Sem conexão: tente quando o sinal voltar";

/**
 * O texto de cada erro de negócio da sugestão de materiais (`sugestao-de-materiais.md`, seção 9). Os que a `api` já escreve bem
 * (o material desativado, o item sem material) usam a mensagem dela, que traz o nome do item; o resto cai no tratamento geral.
 */
export function mensagemDaSugestao(e: unknown): string {
  if (e instanceof ErroDaApi) {
    switch (e.codigo) {
      case "sem_mudanca":
        return "A lista que você montou é igual à lista atual do serviço. Mude algum item, quantidade ou observação.";
      case "sugestao_pendente":
        return "Você já tem uma sugestão ou contestação deste serviço aguardando avaliação. Retire-a em “Sugestões de materiais” antes de enviar outra.";
      case "motivo_obrigatorio":
        return `Explique a contestação em pelo menos ${MIN_CARACTERES_DO_MOTIVO} caracteres.`;
      case "lista_obrigatoria":
        return "Informe a lista de materiais que passa a valer.";
      case "material_repetido":
        return "O mesmo material aparece mais de uma vez na lista.";
      case "material_inexistente":
        return "Um dos materiais não existe mais no catálogo. Tire-o da lista.";
      case "item_invalido":
        return "Cada item precisa ser do catálogo ou ter descrição e unidade.";
      case "resposta_obrigatoria":
        return `Explique a recusa em pelo menos ${MIN_CARACTERES_DO_MOTIVO} caracteres.`;
      case "sugestao_ja_avaliada":
        return "Esta sugestão já foi avaliada ou retirada. Puxe a tela para baixo para atualizar.";
      case "material_inativo":
      case "item_sem_material":
        return e.message;
    }
  }
  return mensagemDoErro(e);
}

/**
 * Roda a chamada e, se ela falhar, lança um `Error` com o texto de `mensagemDaSugestao`: o formulário (`useFormulario`) mostra
 * a mensagem do erro que recebe, e assim ela já sai com a redação desta funcionalidade.
 */
export async function traduzindoErros<T>(chamada: () => Promise<T>): Promise<T> {
  try {
    return await chamada();
  } catch (e) {
    throw new Error(mensagemDaSugestao(e));
  }
}
