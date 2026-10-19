import { useNetInfo } from "@react-native-community/netinfo";

export type Conexao = "online" | "offline";

/**
 * "Online" ou "Sem conexão": o indicador que saiu da web e ficou para o app. Enquanto o aparelho ainda não respondeu (`null`),
 * vale "online" (a primeira chamada à `api` dirá a verdade).
 */
export function useConexao(): Conexao {
  const estado = useNetInfo();
  return estado.isConnected === false || estado.isInternetReachable === false ? "offline" : "online";
}
