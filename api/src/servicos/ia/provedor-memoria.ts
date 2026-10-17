import { IAIndisponivel, type PedacoDeTexto, type PedidoDeTexto, type ProvedorIA } from "./tipos";

/**
 * Só para testes automatizados: uma fila de respostas programáveis, uma flag para simular `IAIndisponivel` e o
 * registro de todas as chamadas recebidas, para o teste conferir o que foi montado no prompt.
 */
export class ProvedorIAEmMemoria implements ProvedorIA {
  respostas: string[] = [];
  falhar = false;
  chamadas: PedidoDeTexto[] = [];

  disponivel(): boolean {
    return !this.falhar;
  }

  async conversar(pedido: PedidoDeTexto): Promise<string> {
    this.chamadas.push(pedido);
    if (this.falhar) throw new IAIndisponivel("IA em memória: falha simulada");
    const resposta = this.respostas.shift();
    if (resposta === undefined) throw new IAIndisponivel("IA em memória: nenhuma resposta programada");
    return resposta;
  }

  async *conversarEmStreaming(pedido: PedidoDeTexto): AsyncIterable<PedacoDeTexto> {
    const resposta = await this.conversar(pedido);
    yield { texto: resposta };
  }
}
