import { useQuery } from "@tanstack/react-query";
import type { AtoDaAusencia, Ausencia } from "@shared/api/ausencia";
import { cliente } from "@/api/api";
import { ErroDaApi } from "@/api/erros";

/**
 * As ausências da própria pessoa (`GET /ausencias?usuario_id=`). No Campo de treino a rota não existe (`404`): a tela some sem erro,
 * como a seção do perfil na web.
 */
export function useMinhasAusencias(usuarioId: string) {
  return useQuery({
    queryKey: ["ausencias", usuarioId],
    queryFn: async () => {
      try {
        return (await cliente.chamar<{ ausencias: Ausencia[] }>("/ausencias", { consulta: { usuario_id: usuarioId, tamanho: 50 } })).ausencias;
      } catch (e) {
        if (e instanceof ErroDaApi && e.status === 404) return null;
        throw e;
      }
    },
  });
}

/** A linha do tempo de uma ausência (`GET /ausencias/{id}`), buscada só quando a pessoa a abre. */
export function useAtosDaAusencia(id: string, abrir: boolean) {
  return useQuery({
    queryKey: ["ausencias", "atos", id],
    enabled: abrir,
    queryFn: async () => (await cliente.chamar<{ ausencia: { atos: AtoDaAusencia[] } }>(`/ausencias/${id}`)).ausencia.atos,
  });
}
