import { IAIndisponivel, type PedacoDeTexto, type PedidoDeTexto, type ProvedorIA } from "./tipos";

/**
 * Só para testes automatizados: uma fila de respostas programáveis, uma flag para simular `IAIndisponivel` e o
 * registro de todas as chamadas recebidas, para o teste conferir o que foi montado no prompt.
 */
export class ProvedorIAEmMemoria implements ProvedorIA {
  respostas: string[] = [];
  falhar = false;
  /** Falha da próxima chamada (cota, servidor lotado…), para conferir a mensagem de cada origem; vale uma vez. */
  proximaFalha: IAIndisponivel | null = null;
  chamadas: PedidoDeTexto[] = [];

  disponivel(): boolean {
    return !this.falhar;
  }

  async conversar(pedido: PedidoDeTexto): Promise<string> {
    this.chamadas.push(pedido);
    if (this.falhar) throw new IAIndisponivel("IA em memória: falha simulada");
    const falha = this.proximaFalha;
    this.proximaFalha = null;
    if (falha) throw falha;
    const resposta = this.respostas.shift();
    if (resposta === undefined) throw new IAIndisponivel("IA em memória: nenhuma resposta programada");
    return resposta;
  }

  /** Entrega a resposta em pedaços de 40 caracteres, que cortam linhas e objetos JSON ao meio, como o streaming de verdade. */
  async *conversarEmStreaming(pedido: PedidoDeTexto): AsyncIterable<PedacoDeTexto> {
    const resposta = await this.conversar(pedido);
    for (let i = 0; i < resposta.length; i += 40) yield { texto: resposta.slice(i, i + 40) };
    if (resposta.length === 0) yield { texto: "" };
  }
}
