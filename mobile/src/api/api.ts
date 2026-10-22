import { URL_DA_API } from "@/config";
import { cabecalhosDaAssinaturaJuridica } from "@/assinatura/juridica";
import { armazemSeguro } from "./armazem-seguro";
import { criarClienteApi } from "./cliente";
import { criarEnvio } from "./eventos";

const ouvintes = new Set<() => void>();

let modoLocal = false;

/** A pessoa entrou sem sinal, pela senha guardada no aparelho, e ainda não há sessão no servidor (ver `SessaoProvider`). */
export const modoLocalAtivo = (): boolean => modoLocal;
export function definirModoLocal(ativo: boolean): void {
  modoLocal = ativo;
}

/** Avisa quando a renovação da sessão foi recusada (os tokens já foram apagados): a `SessaoProvider` volta para a entrada. */
export function aoSessaoEncerrada(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** O cliente da `api` do app: um só, com os tokens no `expo-secure-store`. */
export const cliente = criarClienteApi({
  urlBase: URL_DA_API,
  armazem: armazemSeguro,
  aoSessaoEncerrada: () => ouvintes.forEach((o) => o()),
  modoLocal: modoLocalAtivo,
  // O ato assinado com validade jurídica leva o código da assinatura (`assinatura/juridica.ts`); fora dele, nada é acrescentado.
  cabecalhosDeEscrita: cabecalhosDaAssinaturaJuridica,
});

/**
 * Os envios **sem fila**: a escrita de campo do app não os usa direto, usa o `enviarEvento` e o `enviarArquivo` de `@/offline/app`, que gravam
 * na fila do aparelho antes de enviar. Só o sincronizador (que sobe a fila) e a assinatura do perfil (que não é de campo) chamam este.
 */
export const { enviarArquivo: subirArquivoSemFila } = criarEnvio(cliente);

/** A `api` revogou o acesso da pessoa: apaga os tokens e avisa a casca, que volta para a entrada. A fila do aparelho fica. */
export async function revogarSessaoLocal(): Promise<void> {
  await armazemSeguro.apagar();
  ouvintes.forEach((o) => o());
}
