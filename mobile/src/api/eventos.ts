import { interpretarRespostaDoEvento, montarEnvioDoEvento, type EventoDeCampo, type RespostaEventos } from "@shared/api/eventos";
import { novoUuid } from "@shared/api/uuid";
import type { ClienteApi } from "./cliente";

/** Um arquivo no aparelho (a foto da câmera, o PDF escolhido, o desenho da assinatura salvo em arquivo). */
export interface ArquivoLocal {
  uri: string;
  nome: string;
  tipoMime: string;
}

export type TipoDeArquivo = "foto" | "assinatura" | "pdf";

/**
 * As duas escritas de campo do app. **Toda escrita de campo passa por `enviarEvento`**: é o ponto único que, no modo offline,
 * passa a gravar o evento na fila local antes de enviá-lo (a `api` já trata o evento da fila pela diferença de hora).
 */
export function criarEnvio(cliente: ClienteApi) {
  return {
    /**
     * Envia UM evento de campo (`POST /eventos`) e devolve a resposta (`aprs`, `os`, `alertas`, `pontos_ganhos`). Lança `ErroDeEvento`
     * se a `api` o recusou ou o deixou pendente, com a mensagem pronta. Fotos e assinaturas sobem antes, por `enviarArquivo`.
     */
    async enviarEvento(evento: EventoDeCampo): Promise<RespostaEventos & { id: string }> {
      const { id, corpo } = montarEnvioDoEvento(evento);
      return interpretarRespostaDoEvento(await cliente.chamar<RespostaEventos>("/eventos", { corpo }), id);
    },

    /**
     * Envia um arquivo (`PUT /arquivos/{id}`, multipart) com um id gerado no aparelho e devolve o id, que o evento referencia
     * (`arquivo_id`). Reenviar o mesmo id e conteúdo não tem efeito. A foto já deve estar comprimida (etapa 10).
     */
    async enviarArquivo(arquivo: ArquivoLocal, tipo: TipoDeArquivo, id: string = novoUuid()): Promise<string> {
      const formulario = new FormData();
      // No React Native o arquivo entra no multipart como `{uri, name, type}`: o `fetch` lê o conteúdo direto do disco.
      formulario.append("arquivo", { uri: arquivo.uri, name: arquivo.nome, type: arquivo.tipoMime } as unknown as Blob);
      formulario.append("tipo", tipo);
      await cliente.chamar(`/arquivos/${id}`, { metodo: "PUT", formulario });
      return id;
    },
  };
}
