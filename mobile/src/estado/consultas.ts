import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";
import { AppState } from "react-native";
import { ErroDaApi } from "@/api/erros";
import { URL_DA_API } from "@/config";
import { ErroSemCopia } from "@/offline/leitura";

/**
 * O estado do servidor: cache, recarga e "puxar para atualizar" sem código próprio. Erro da `api` (4xx) não se repete (a resposta
 * não mudaria); a falta de rede repete duas vezes. As consultas de campo (OS, APR, execução) leem da cópia local no SQLite quando não
 * há sinal (`lerDeOndeDer`).
 */
export const clienteDeConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // As consultas de campo caem para a cópia local quando não há sinal: elas precisam rodar mesmo "sem conexão" (o padrão as pausaria).
      networkMode: "always",
      retry: (tentativas, erro) => !(erro instanceof ErroDaApi) && !(erro instanceof ErroSemCopia) && tentativas < 2,
    },
  },
});

/**
 * Liga o TanStack Query ao aparelho: recarrega ao voltar para o app e pausa as consultas sem conexão. Devolve a função que desliga.
 *
 * "Tem internet" aqui é "a `api` responde": o NetInfo confere a conexão pedindo `GET /saude` da própria `api` (e não o endereço do Google,
 * que a rede da empresa pode bloquear e fazer o app se achar sem sinal com a `api` ao alcance).
 */
export function ligarGerentesDoAparelho(): () => void {
  if (URL_DA_API) {
    NetInfo.configure({
      reachabilityUrl: `${URL_DA_API}/saude`,
      reachabilityMethod: "GET",
      reachabilityTest: async (resposta) => resposta.status === 200,
      reachabilityLongTimeout: 60_000,
      reachabilityShortTimeout: 5_000,
      reachabilityRequestTimeout: 10_000,
    });
  }
  onlineManager.setEventListener((definirOnline) => NetInfo.addEventListener((estado) => definirOnline(estado.isConnected !== false && estado.isInternetReachable !== false)));
  const assinatura = AppState.addEventListener("change", (estado) => focusManager.setFocused(estado === "active"));
  return () => assinatura.remove();
}
