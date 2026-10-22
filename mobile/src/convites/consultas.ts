import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { ConviteFeito, ConviteRecebido } from "@shared/api/apr-convite";
import { cliente } from "@/api/api";
import { useConexao } from "@/estado/conexao";
import { useSessao } from "@/sessao/SessaoProvider";

/** O convite vale por minutos: quem convida e quem é convidado perguntam com a tela aberta (o push avisa quem está com o app fechado). */
const RELER_A_CADA_MS = 5_000;
const PERGUNTAR_A_CADA_MS = 10_000;

/**
 * Os convites para a APR que a pessoa recebeu (`GET /me/apr-convites`): os que esperam a resposta dela e os que ela aceitou e ainda não
 * viraram APR. Só com sinal (o convite é do servidor); sem sinal a lista fica vazia e a APR segue pelo presencial de sempre. Mora sob
 * `["me"]`, então qualquer evento de campo a atualiza.
 */
export function useConvitesRecebidos() {
  const { fase, destino, eu } = useSessao();
  const online = useConexao() === "online";
  return useQuery({
    queryKey: ["me", "apr-convites"],
    enabled: fase === "ativa" && destino === "abas" && online && eu?.usuario.perfil === "tecnico",
    refetchInterval: PERGUNTAR_A_CADA_MS,
    retry: false,
    queryFn: async () => (await cliente.chamar<{ convites: ConviteRecebido[] }>("/me/apr-convites")).convites,
  });
}

/** Os convites que o responsável fez hoje nesta OS (`GET /os/{id}/apr-convites`), o último de cada pessoa, relidos a cada poucos segundos. */
export function useConvitesDaOs(osId: string, ativo: boolean) {
  const online = useConexao() === "online";
  return useQuery({
    queryKey: ["os", osId, "apr-convites"],
    enabled: ativo && online,
    refetchInterval: RELER_A_CADA_MS,
    retry: false,
    queryFn: async () => (await cliente.chamar<{ convites: ConviteFeito[] }>(`/os/${osId}/apr-convites`)).convites,
  });
}

/** As ações sobre os convites; depois de cada uma, o que as telas mostravam está velho (os convites e os avisos). */
export function useAcoesDeConvite(osId?: string) {
  const consultas = useQueryClient();
  const atualizar = useCallback(
    () => Promise.all([consultas.invalidateQueries({ queryKey: ["me", "apr-convites"] }), consultas.invalidateQueries({ queryKey: ["avisos"] }), ...(osId ? [consultas.invalidateQueries({ queryKey: ["os", osId, "apr-convites"] })] : [])]),
    [consultas, osId],
  );
  return {
    convidar: async (usuarios: string[]) => {
      await cliente.chamar(`/os/${osId}/apr-convites`, { metodo: "POST", corpo: { usuarios } });
      await atualizar();
    },
    desfazer: async (id: string) => {
      await cliente.chamar(`/apr-convites/${id}`, { metodo: "DELETE" });
      await atualizar();
    },
    aceitar: async (id: string) => {
      await cliente.chamar(`/apr-convites/${id}/aceitar`, { metodo: "POST", corpo: {} });
      await atualizar();
    },
    recusar: async (id: string, motivo: string) => {
      await cliente.chamar(`/apr-convites/${id}/recusar`, { metodo: "POST", corpo: { motivo } });
      await atualizar();
    },
  };
}
