import { useQuery } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { CONTATOS_PUBLICOS, type ContatoDeEmergencia, type ContatosDeEmergencia } from "@shared/api/emergencia";
import { cliente } from "@/api/api";
import { useSessao } from "@/sessao/SessaoProvider";

const CHAVE_DO_CACHE = "synqos_contatos_emergencia";

/** Os contatos que valem sem nenhuma resposta da `api`: só os números públicos (o PAE da empresa vem do admin). */
export const SO_OS_PUBLICOS: ContatosDeEmergencia = { pae: [], publicos: CONTATOS_PUBLICOS };

async function lerDoCache(): Promise<ContatosDeEmergencia | null> {
  try {
    const texto = await SecureStore.getItemAsync(CHAVE_DO_CACHE);
    if (!texto) return null;
    const lido = JSON.parse(texto) as { pae?: ContatoDeEmergencia[] };
    return { pae: Array.isArray(lido.pae) ? lido.pae : [], publicos: CONTATOS_PUBLICOS };
  } catch {
    return null;
  }
}

async function guardarNoCache(pae: ContatoDeEmergencia[]): Promise<void> {
  await SecureStore.setItemAsync(CHAVE_DO_CACHE, JSON.stringify({ pae })).catch(() => undefined);
}

/**
 * Os contatos do botão de emergência: o PAE que o admin cadastrou e os números públicos (`GET /emergencia/contatos`). A última resposta fica
 * guardada no aparelho, porque a hora de precisar deles é a hora em que o sinal pode faltar: sem resposta da `api`, vale o que ficou guardado
 * e, na falta disso, os números públicos. Nunca falha.
 */
export function useContatosDeEmergencia() {
  const { fase } = useSessao();
  return useQuery({
    queryKey: ["emergencia", "contatos"],
    enabled: fase === "ativa",
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<ContatosDeEmergencia> => {
      try {
        const resposta = await cliente.chamar<ContatosDeEmergencia>("/emergencia/contatos");
        await guardarNoCache(resposta.pae);
        return { pae: resposta.pae, publicos: CONTATOS_PUBLICOS };
      } catch {
        return (await lerDoCache()) ?? SO_OS_PUBLICOS;
      }
    },
  });
}
