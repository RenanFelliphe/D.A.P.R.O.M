import { ErroDeEvento, montarEnvioDoEvento, type EventoDeCampo, type RespostaEventos } from "@shared/api/eventos";
import { novoUuid } from "@shared/api/uuid";
import type { ArquivoLocal, TipoDeArquivo } from "../api/eventos";
import type { Banco } from "./banco";
import { guardarArquivo, guardarEvento, removerArquivo } from "./fila";
import type { Conexao, Sincronizador } from "./sincronizar";

/**
 * As duas escritas de campo do app, agora **com a fila**: o evento (e o arquivo) é gravado no banco do aparelho antes de qualquer envio,
 * e só sai da fila quando a `api` o confirma. Com sinal, o envio é em seguida e a tela se comporta como sempre (a resposta traz o
 * resultado e os pontos, e a recusa vira mensagem); sem sinal, o registro fica guardado e a tela segue em frente, lendo da cópia local.
 */

/** O resultado de uma escrita: a resposta da `api` quando o envio aconteceu, ou `naFila` quando o registro ficou guardado. */
export type ResultadoDoEnvio = RespostaEventos & { id: string; naFila: boolean };

/** O que a tela recebe quando o evento ficou na fila: nada foi confirmado ainda, e nenhum resultado do servidor existe. */
export const respostaDaFila = (id: string): ResultadoDoEnvio => ({ id, naFila: true, confirmados: [], alertas: [], aprs: [], os: [], rejeitados: [], pendentes: [], pontos_ganhos: 0, ganhos: [] });

export interface DependenciasDoEnvio {
  banco: Banco;
  sincronizador: Pick<Sincronizador, "enviarFila" | "enviarArquivo">;
  usuarioId(): string | null;
  conexao(): Conexao;
  agora(): Date;
  /** Sobe `PUT /arquivos/{id}` na hora, para o arquivo que não passa pela fila (a assinatura do perfil). */
  subirAgora(arquivo: ArquivoLocal, tipo: TipoDeArquivo, id: string): Promise<string>;
  /** Copia o arquivo para onde o sistema não o apaga como o cache (a pasta de documentos do app); devolve o endereço novo. */
  guardarCopiaDoArquivo(arquivo: ArquivoLocal, id: string): Promise<ArquivoLocal>;
  apagarArquivoLocal(uri: string): void;
  aoMudar(): void;
}

export function criarEnvioComFila(d: DependenciasDoEnvio) {
  const exigirUsuario = () => {
    const id = d.usuarioId();
    if (!id) throw new Error("Entre no app para continuar.");
    return id;
  };

  return {
    /**
     * Grava o evento na fila e tenta enviá-lo (junto com o que já esperava, em ordem). Lança `ErroDeEvento` se a `api` o recusou ou
     * o adiou, e então ele **não** fica na fila (a pessoa está na tela e corrige). Sem sinal, ou com o servidor fora do ar, devolve
     * `naFila: true`: o registro está guardado e sobe sozinho.
     */
    async enviarEvento(evento: EventoDeCampo): Promise<ResultadoDoEnvio> {
      const usuarioId = exigirUsuario();
      const { id, corpo } = montarEnvioDoEvento(evento, d.agora);
      const e = corpo.eventos[0]!;
      await guardarEvento(d.banco, { id, usuarioId, tipo: e.tipo, osId: e.os_id, payload: e.payload, ocorridoEm: e.ocorrido_em, criadoEm: d.agora().toISOString() });
      d.aoMudar();

      const passada = await d.sincronizador.enviarFila(id);
      const resultado = passada.porEvento.get(id);
      if (resultado?.situacao === "confirmado") return { ...resultado.resposta, id, naFila: false };
      if (resultado?.situacao === "rejeitado" || resultado?.situacao === "pendente") throw new ErroDeEvento(resultado.situacao, resultado.codigo, resultado.mensagem);
      // Sem sinal, servidor fora do ar, sessão vencida ou um registro anterior da mesma OS esperando: fica guardado.
      return respostaDaFila(id);
    },

    /**
     * Guarda o arquivo (foto ou PDF) na fila e o sobe em seguida; devolve o id, que o evento cita (`arquivo_id`). Sem sinal o arquivo
     * fica guardado e sobe antes dos eventos, quando o sinal voltar. A assinatura do perfil não passa pela fila (ela não é de campo).
     */
    async enviarArquivo(arquivo: ArquivoLocal, tipo: TipoDeArquivo, id: string = novoUuid()): Promise<string> {
      if (tipo === "assinatura") return d.subirAgora(arquivo, tipo, id);
      const usuarioId = exigirUsuario();
      const guardado = await d.guardarCopiaDoArquivo(arquivo, id);
      await guardarArquivo(d.banco, { id, usuarioId, tipo, uri: guardado.uri, nome: guardado.nome, tipoMime: guardado.tipoMime, criadoEm: d.agora().toISOString() });
      d.aoMudar();
      await d.sincronizador.enviarArquivo(id);
      return id;
    },

    /** Tira o arquivo da fila (a pessoa removeu a foto antes de ela subir). */
    async descartarArquivo(id: string, uri?: string): Promise<void> {
      await removerArquivo(d.banco, id);
      if (uri) d.apagarArquivoLocal(uri);
      d.aoMudar();
    },
  };
}

export type EnvioComFila = ReturnType<typeof criarEnvioComFila>;
