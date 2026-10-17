import { IAIndisponivel, type PedacoDeTexto, type PedidoDeTexto, type ProvedorIA } from "./tipos";

/**
 * Implementação permanente de produção enquanto não há `ANTHROPIC_API_KEY` configurada (ver `config.ts`). Nunca é um
 * placeholder de teste: é o estado real do sistema até a licença ser comprada. `disponivel()` é sempre `false`; quem
 * chama deve checar isso antes de conversar — os métodos abaixo só lançam como rede de segurança.
 */
export class ProvedorIAIndisponivel implements ProvedorIA {
  disponivel(): boolean {
    return false;
  }

  async conversar(_pedido: PedidoDeTexto): Promise<string> {
    throw new IAIndisponivel("IA desligada: nenhuma chave da Anthropic configurada");
  }

  conversarEmStreaming(_pedido: PedidoDeTexto): AsyncIterable<PedacoDeTexto> {
    throw new IAIndisponivel("IA desligada: nenhuma chave da Anthropic configurada");
  }
}
