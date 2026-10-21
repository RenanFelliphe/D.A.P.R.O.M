import type { FuncaoDeIA } from "../../../../shared/ia/funcoes";
import { IAIndisponivel, type PedacoDeTexto, type PedidoDeTexto, type ProvedorIA } from "./tipos";

/**
 * O controle da IA no módulo de IA: antes de cada chamada confere se a função do pedido (`pedido.modelo`) está ligada e, se não
 * estiver, lança `IAIndisponivel` com o motivo `desligada`, sem falar com o fornecedor. É o que garante que desligar uma função na
 * página da Vitória vale para qualquer tela, tarefa ou script que a use, e não só para as telas que lembraram de perguntar.
 * `disponivel()` continua sendo só "há chave": quem decide se oferece a função usa `iaDisponivel` (`dominio/ia-funcoes.ts`).
 */
export class ProvedorIAControlado implements ProvedorIA {
  constructor(
    private readonly interno: ProvedorIA,
    private readonly ligada: (funcao: FuncaoDeIA) => Promise<boolean>,
  ) {}

  disponivel(): boolean {
    return this.interno.disponivel();
  }

  private async exigir(funcao: FuncaoDeIA): Promise<void> {
    if (!(await this.ligada(funcao))) throw new IAIndisponivel(`A função de IA "${funcao}" está desligada`, { motivo: "desligada" });
  }

  async conversar(pedido: PedidoDeTexto): Promise<string> {
    await this.exigir(pedido.modelo);
    return this.interno.conversar(pedido);
  }

  async *conversarEmStreaming(pedido: PedidoDeTexto): AsyncIterable<PedacoDeTexto> {
    await this.exigir(pedido.modelo);
    yield* this.interno.conversarEmStreaming(pedido);
  }
}
