import { useQuery } from "@tanstack/react-query";
import type { Validacoes } from "@shared/api/validacoes";
import { cliente } from "@/api/api";
import { ErroDaApi } from "@/api/erros";
import { useSessao } from "@/sessao/SessaoProvider";

/** A fila e o selo do perfil se atualizam sozinhos a cada minuto, como o sino (não há push). */
const ATUALIZAR_A_CADA_MS = 60_000;

/**
 * A fila do supervisor (`GET /me/validacoes`). Mora sob `["me"]`, então qualquer evento de campo a invalida. Só quem supervisiona
 * pergunta (`ativo`); `403` (a pessoa deixou de supervisionar) vira fila ausente, sem erro. Sem sinal a consulta falha e a tela diz.
 */
export function useValidacoes(ativo: boolean) {
  const { fase, destino } = useSessao();
  return useQuery({
    queryKey: ["me", "validacoes"],
    enabled: ativo && fase === "ativa" && destino === "abas",
    refetchInterval: ATUALIZAR_A_CADA_MS,
    queryFn: async () => {
      try {
        return await cliente.chamar<Validacoes>("/me/validacoes");
      } catch (e) {
        if (e instanceof ErroDaApi && e.status === 403) return null;
        throw e;
      }
    },
  });
}
