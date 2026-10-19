import { useQuery } from "@tanstack/react-query";
import type { Colega, EscolhaDoModelo, ModeloCompleto } from "@shared/api/apr";
import { cliente } from "@/api/api";
import { leitura, lerDeOndeDer } from "@/offline/app";

/** Um colega da equipe da OS com a ausência, que tira a pessoa da escolha dos participantes. */
export type ColegaDaEquipe = Colega & { ausencia?: unknown };

/** A equipe da OS (`GET /usuarios?equipe_id=`): os participantes possíveis da APR. */
export function useColegasDaEquipe(equipeId: string | undefined) {
  return useQuery({
    queryKey: ["equipe", equipeId, "usuarios"],
    enabled: Boolean(equipeId),
    queryFn: () =>
      lerDeOndeDer(
        async () => (await cliente.chamar<{ usuarios: ColegaDaEquipe[] }>("/usuarios", { consulta: { equipe_id: equipeId, tamanho: 200 } })).usuarios,
        () => leitura.colegas(equipeId!),
      ),
  });
}

/** Os modelos de APR publicados, com a orientação e o recomendado pela leitura da OS (`GET /os/{id}/modelos-apr`). */
export function useEscolhaDoModelo(osId: string) {
  return useQuery({
    queryKey: ["os", osId, "modelos-apr"],
    queryFn: () =>
      lerDeOndeDer(
        () => cliente.chamar<EscolhaDoModelo>(`/os/${osId}/modelos-apr`),
        () => leitura.escolhaDoModelo(osId),
      ),
  });
}

/** A versão publicada mais recente do modelo, sem o que é eliminatório: o técnico não sabe o que bloqueia. */
export const carregarModeloPublicado = (codigo: string) =>
  lerDeOndeDer(
    () => cliente.chamar<ModeloCompleto>(`/modelos-apr/${encodeURIComponent(codigo)}/versoes/publicada`),
    () => leitura.modeloPublicado(codigo),
  );
