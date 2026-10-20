import { IAIndisponivel, type PedacoDeTexto, type PedidoDeTexto, type ProvedorIA } from "./tipos";

/**
 * Implementação permanente de produção enquanto não há chave do provedor de IA escolhido configurada (`ANTHROPIC_API_KEY`
 * ou `GEMINI_API_KEY`, ver `config.ts`). Nunca é um placeholder de teste: é o estado real do sistema até a chave existir.
 * `disponivel()` é sempre `false`; quem
 * chama deve checar isso antes de conversar — os métodos abaixo só lançam como rede de segurança.
 */
export class ProvedorIAIndisponivel implements ProvedorIA {
  disponivel(): boolean {
    return false;
  }

  async conversar(_pedido: PedidoDeTexto): Promise<string> {
    throw new IAIndisponivel("IA desligada: nenhuma chave de IA configurada", { motivo: "chave" });
  }

  conversarEmStreaming(_pedido: PedidoDeTexto): AsyncIterable<PedacoDeTexto> {
    throw new IAIndisponivel("IA desligada: nenhuma chave de IA configurada", { motivo: "chave" });
  }
}
