import { useQuery } from "@tanstack/react-query";
import type { AssinaturaJuridicaDaOs } from "@shared/api/assinatura-juridica";
import { useConexao } from "@/estado/conexao";
import { useSessao } from "@/sessao/SessaoProvider";
import { listarAssinaturasDaOs, listarAssinaturasPendentes } from "./api-juridica";

/** O provedor de assinatura com validade jurídica está ligado (`GET /me`)? */
export function useAssinaturaJuridicaLigada(): boolean {
  const { eu } = useSessao();
  return Boolean(eu?.assinatura_juridica?.ligada);
}

/**
 * Os atos feitos sem sinal que esperam a assinatura com validade jurídica. Só consulta com o provedor ligado e com sinal (sem sinal não
 * há como assinar); a chave começa por `me`, então o que invalida "me" depois de um ato a refaz. É aviso de apoio: se falha, não aparece.
 */
export function useAssinaturasPendentes() {
  const ligada = useAssinaturaJuridicaLigada();
  const online = useConexao() === "online";
  return useQuery({
    queryKey: ["me", "assinaturas-pendentes"],
    enabled: ligada && online,
    retry: false,
    queryFn: listarAssinaturasPendentes,
  });
}

/**
 * As assinaturas com validade jurídica de uma OS. Leitura online: sem sinal, ou se a `api` recusar (a lista é de quem supervisiona a
 * equipe e do administrador), a lista vem vazia e o bloco simplesmente não aparece.
 */
export function useAssinaturasDaOs(osId: string) {
  const online = useConexao() === "online";
  return useQuery({
    queryKey: ["os", osId, "assinaturas-juridicas"],
    enabled: online,
    retry: false,
    queryFn: async (): Promise<AssinaturaJuridicaDaOs[]> => {
      try {
        return await listarAssinaturasDaOs(osId);
      } catch {
        return [];
      }
    },
  });
}
