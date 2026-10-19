import { File, Paths } from "expo-file-system";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { textoDosPontosGanhos, type RespostaComPontos } from "@shared/api/gamificacao";
import { novoUuid } from "@shared/api/uuid";
import { cliente, subirArquivoSemFila } from "@/api/api";
import { apagarArquivoLocal } from "@/campo/arquivos";
import { mostrarAviso } from "@/ui/AvisoRapido";

/**
 * Grava o PNG da assinatura num arquivo do aparelho, sobe por `PUT /arquivos/{id}` e a torna a assinatura do perfil
 * (`PUT /me/assinatura`). A primeira assinatura pontua o técnico (uma vez por conta). O arquivo local é apagado no fim.
 */
export async function salvarAssinaturaDoPerfil(pngEmBase64: string): Promise<RespostaComPontos> {
  const nome = `assinatura-${novoUuid().slice(0, 8)}.png`;
  const arquivo = new File(Paths.cache, nome);
  try {
    arquivo.create({ overwrite: true });
    await arquivo.write(pngEmBase64, { encoding: "base64" });
    const arquivoId = await subirArquivoSemFila({ uri: arquivo.uri, nome, tipoMime: "image/png" }, "assinatura");
    return await cliente.chamar<RespostaComPontos>("/me/assinatura", { metodo: "PUT", corpo: { arquivo_id: arquivoId } });
  } finally {
    apagarArquivoLocal(arquivo.uri);
  }
}

/** Salva a assinatura e atualiza o que depende dela (`GET /me`, que decide o destino e mostra a imagem); avisa o "+N pontos". */
export function useSalvarAssinatura() {
  const consultas = useQueryClient();
  return useCallback(
    async (pngEmBase64: string) => {
      const resposta = await salvarAssinaturaDoPerfil(pngEmBase64);
      // A lista de colegas da APR também traz a assinatura de cada um (`equipe`).
      await Promise.all([consultas.invalidateQueries({ queryKey: ["eu"] }), consultas.invalidateQueries({ queryKey: ["equipe"] })]);
      const pontos = textoDosPontosGanhos(resposta);
      if (pontos) mostrarAviso(pontos);
    },
    [consultas],
  );
}
