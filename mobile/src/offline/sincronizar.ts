import type { RespostaEventos } from "@shared/api/eventos";
import { ErroDaApi, ErroDeRede, mensagemDoErro } from "../api/erros";
import type { Banco } from "./banco";
import { substituirCopia } from "./copia";
import { arquivosPendentes, eventosPendentes, recusarEvento, registrarTentativaDoArquivo, registrarTentativaDoEvento, removerArquivo, removerEvento } from "./fila";
import { osDoEvento } from "./projecao";
import type { ArquivoDaFila, SnapshotDaApi } from "./tipos";

/**
 * O sincronizador: sobe a fila (os arquivos primeiro, depois os eventos, um a um, na ordem em que aconteceram) e baixa a cópia
 * nova da equipe. É a única parte que fala com a `api` por conta da fila; o que ele precisa de fora entra por `Dependencias`, então
 * roda igual no aparelho e nos testes.
 *
 * Regras (Decisão-chave 2: "a sincronização nunca descarta dado de campo"):
 * - o evento confirmado sai da fila; reenviar não tem efeito (a `api` é idempotente pelo `id`);
 * - o evento que a `api` adia (`pendente`: falta um arquivo ou a assinatura de outro aparelho) continua na fila, e os que vêm depois
 *   **da mesma OS** esperam por ele; as outras OS seguem;
 * - o evento recusado de vez sai da fila, mas fica guardado entre os "registros recusados", com o motivo, para o técnico mostrar
 *   ao supervisor; o que espera mais que `PRAZO_DO_PENDENTE_MS` tem o mesmo destino;
 * - falta de sinal, servidor fora do ar ou sessão vencida param tudo e deixam a fila como está.
 */

/** Um evento pendente por mais tempo que isto (a causa nunca sumiu) vai para os recusados, para não travar a fila para sempre. */
export const PRAZO_DO_PENDENTE_MS = 7 * 86_400_000;

export type Conexao = "online" | "offline";

export interface Dependencias {
  banco: Banco;
  /** Quem está logado agora (a fila e a cópia são de uma pessoa); `null` = sem sessão. */
  usuarioId(): string | null;
  /** `POST /eventos` com UM evento. */
  enviarEvento(evento: { id: string; tipo: string; os_id: string | null; payload: Record<string, unknown>; ocorrido_em: string }): Promise<RespostaEventos & { acesso_revogado?: boolean }>;
  /** `PUT /arquivos/{id}`. */
  subirArquivo(arquivo: ArquivoDaFila): Promise<void>;
  /** `POST /sync/pull`. */
  baixarSnapshot(): Promise<SnapshotDaApi>;
  /** Apaga a cópia local de um arquivo já enviado. */
  apagarArquivoLocal(uri: string): void;
  conexao(): Conexao;
  agora(): Date;
  /** A fila ou a cópia mudou: quem mostra o contador e as listas se atualiza. */
  aoMudar(): void;
  /** A `api` revogou o acesso da pessoa (ela foi desativada) ao receber a fila. */
  aoAcessoRevogado?(): void;
}

/** O que aconteceu com um evento na passada. */
export type ResultadoDoEvento =
  | { situacao: "confirmado"; resposta: RespostaEventos }
  | { situacao: "rejeitado" | "pendente"; codigo: string; mensagem: string }
  /** Não saiu (sem sinal, ou um evento anterior da mesma OS está esperando): continua na fila. */
  | { situacao: "na-fila" };

export interface ResultadoDaPassada {
  confirmados: number;
  recusados: number;
  /** Ainda esperando para subir (eventos e arquivos). */
  restantes: number;
  /** Parou por falta de sinal ou porque o servidor não respondeu. */
  semSinal: boolean;
  /** Parou por um erro que a pessoa precisa resolver (sessão vencida, assinatura por cadastrar). */
  erro: string | null;
  porEvento: Map<string, ResultadoDoEvento>;
}

export interface ResultadoDaSincronizacao extends ResultadoDaPassada {
  copiaAtualizada: boolean;
}

/** Erros que não são do evento (a rede, o servidor, a sessão): a fila para e tenta de novo depois. */
const paraATentativa = (e: unknown): boolean => e instanceof ErroDeRede || (e instanceof ErroDaApi && (e.status >= 500 || e.status === 401 || e.status === 403 || e.status === 408 || e.status === 429));

export function criarSincronizador(d: Dependencias) {
  /** A fila de passadas: uma de cada vez. */
  let cauda: Promise<unknown> = Promise.resolve();
  const naVez = <T>(tarefa: () => Promise<T>): Promise<T> => {
    const resultado = cauda.then(tarefa, tarefa);
    cauda = resultado.catch(() => undefined);
    return resultado;
  };
  let emAndamento: Promise<ResultadoDaSincronizacao> | null = null;

  const exigirUsuario = () => {
    const id = d.usuarioId();
    if (!id) throw new ErroDaApi(401, "nao_autenticado", "Sessão inválida ou expirada");
    return id;
  };

  async function subirArquivos(usuarioId: string): Promise<{ parou: "sem-sinal" | "erro" | null; erro: string | null }> {
    for (const arquivo of await arquivosPendentes(d.banco, usuarioId)) {
      try {
        await d.subirArquivo(arquivo);
      } catch (e) {
        await registrarTentativaDoArquivo(d.banco, arquivo.id, mensagemDoErro(e));
        if (paraATentativa(e)) return { parou: e instanceof ErroDeRede || (e instanceof ErroDaApi && e.status >= 500) ? "sem-sinal" : "erro", erro: mensagemDoErro(e) };
        // Recusado de vez (arquivo grande demais, formato): fica na fila com o erro; o evento que o cita esperará (`arquivo_ausente`).
        continue;
      }
      await removerArquivo(d.banco, arquivo.id);
      d.apagarArquivoLocal(arquivo.uri);
    }
    return { parou: null, erro: null };
  }

  /**
   * Uma passada pela fila. `interativo` é o evento que a pessoa acabou de gerar na tela: se a `api` o recusar ou o adiar, ela precisa
   * saber na hora (como no app sempre online), então ele sai da fila em vez de ir para os recusados, e o resultado volta em `porEvento`.
   */
  async function passada(interativo?: string): Promise<ResultadoDaPassada> {
    const usuarioId = exigirUsuario();
    const saida: ResultadoDaPassada = { confirmados: 0, recusados: 0, restantes: 0, semSinal: false, erro: null, porEvento: new Map() };
    const pendentes = await eventosPendentes(d.banco, usuarioId);
    const marcarNaFila = () => pendentes.forEach((e) => !saida.porEvento.has(e.id) && saida.porEvento.set(e.id, { situacao: "na-fila" }));

    if (d.conexao() === "offline") {
      saida.semSinal = true;
      marcarNaFila();
      saida.restantes = pendentes.length + (await arquivosPendentes(d.banco, usuarioId)).length;
      return saida;
    }

    const arquivos = await subirArquivos(usuarioId);
    if (arquivos.parou) {
      saida.semSinal = arquivos.parou === "sem-sinal";
      saida.erro = arquivos.parou === "erro" ? arquivos.erro : null;
      marcarNaFila();
      saida.restantes = pendentes.length + (await arquivosPendentes(d.banco, usuarioId)).length;
      return saida;
    }

    /** As OS com um evento esperando: os eventos seguintes dela não saem nesta passada. */
    const bloqueadas = new Set<string | null>();
    let parou = false;
    for (const evento of pendentes) {
      if (parou || bloqueadas.has(osDoEvento(evento))) {
        saida.porEvento.set(evento.id, { situacao: "na-fila" });
        continue;
      }
      try {
        const resposta = await d.enviarEvento({ id: evento.id, tipo: evento.tipo, os_id: evento.osId, payload: evento.payload, ocorrido_em: evento.ocorridoEm });
        if (resposta.acesso_revogado) d.aoAcessoRevogado?.();
        const recusa = resposta.rejeitados.find((r) => r.id === evento.id);
        const espera = resposta.pendentes.find((r) => r.id === evento.id);
        if (resposta.confirmados.includes(evento.id)) {
          await removerEvento(d.banco, evento.id);
          saida.confirmados++;
          saida.porEvento.set(evento.id, { situacao: "confirmado", resposta });
        } else if (recusa) {
          if (evento.id === interativo) await removerEvento(d.banco, evento.id);
          else await recusarEvento(d.banco, evento, recusa.codigo, recusa.mensagem, d.agora());
          saida.recusados++;
          saida.porEvento.set(evento.id, { situacao: "rejeitado", codigo: recusa.codigo, mensagem: recusa.mensagem });
        } else if (espera) {
          const esperouDemais = d.agora().getTime() - Date.parse(evento.criadoEm) > PRAZO_DO_PENDENTE_MS;
          if (evento.id === interativo) {
            await removerEvento(d.banco, evento.id);
            saida.porEvento.set(evento.id, { situacao: "pendente", codigo: espera.codigo, mensagem: espera.mensagem });
          } else if (esperouDemais) {
            await recusarEvento(d.banco, evento, "esperou_demais", `${espera.mensagem}. O registro esperou mais de 7 dias e não foi aplicado.`, d.agora());
            saida.recusados++;
            saida.porEvento.set(evento.id, { situacao: "rejeitado", codigo: "esperou_demais", mensagem: espera.mensagem });
          } else {
            await registrarTentativaDoEvento(d.banco, evento.id, espera.mensagem);
            bloqueadas.add(osDoEvento(evento));
            saida.porEvento.set(evento.id, { situacao: "pendente", codigo: espera.codigo, mensagem: espera.mensagem });
          }
        } else {
          // A `api` respondeu sem dizer nada deste evento: não dá para saber. Continua na fila.
          parou = true;
          saida.semSinal = true;
          saida.porEvento.set(evento.id, { situacao: "na-fila" });
        }
      } catch (e) {
        if (paraATentativa(e)) {
          parou = true;
          if (e instanceof ErroDeRede || (e instanceof ErroDaApi && e.status >= 500)) saida.semSinal = true;
          else saida.erro = mensagemDoErro(e);
          await registrarTentativaDoEvento(d.banco, evento.id, mensagemDoErro(e));
          saida.porEvento.set(evento.id, { situacao: "na-fila" });
        } else if (e instanceof ErroDaApi) {
          // Recusa do envio inteiro (payload que a `api` não entende): o mesmo destino de um evento rejeitado.
          if (evento.id === interativo) await removerEvento(d.banco, evento.id);
          else await recusarEvento(d.banco, evento, e.codigo, e.message, d.agora());
          saida.recusados++;
          saida.porEvento.set(evento.id, { situacao: "rejeitado", codigo: e.codigo, mensagem: e.message });
        } else throw e;
      }
    }
    saida.restantes = (await eventosPendentes(d.banco, usuarioId)).length + (await arquivosPendentes(d.banco, usuarioId)).length;
    return saida;
  }

  async function baixarCopia(): Promise<void> {
    const usuarioId = exigirUsuario();
    const snapshot = await d.baixarSnapshot();
    // O que ainda espera na fila não pode sumir da cópia: a OS fica como estava.
    const manter = new Set((await eventosPendentes(d.banco, usuarioId)).map(osDoEvento).filter((id): id is string => id !== null));
    await substituirCopia(d.banco, usuarioId, snapshot, manter, d.agora());
  }

  return {
    /** Uma passada pela fila (os arquivos e os eventos), na vez dela. */
    enviarFila(interativo?: string): Promise<ResultadoDaPassada> {
      return naVez(async () => {
        try {
          return await passada(interativo);
        } finally {
          d.aoMudar();
        }
      });
    },

    /**
     * Sobe só este arquivo, na vez dele (a pessoa acabou de tirar a foto). `"na-fila"`: sem sinal, ou o servidor não respondeu; ele
     * continua guardado e sobe com o resto. Uma recusa de vez (arquivo grande demais, formato) tira o arquivo da fila e é lançada,
     * para a tela dizer à pessoa, como no app sempre online.
     */
    enviarArquivo(id: string): Promise<"enviado" | "na-fila"> {
      return naVez(async () => {
        const usuarioId = exigirUsuario();
        const arquivo = (await arquivosPendentes(d.banco, usuarioId)).find((a) => a.id === id);
        if (!arquivo) return "enviado";
        if (d.conexao() === "offline") return "na-fila";
        try {
          await d.subirArquivo(arquivo);
        } catch (e) {
          if (paraATentativa(e)) {
            await registrarTentativaDoArquivo(d.banco, id, mensagemDoErro(e));
            return "na-fila";
          }
          await removerArquivo(d.banco, id);
          d.apagarArquivoLocal(arquivo.uri);
          throw e;
        } finally {
          d.aoMudar();
        }
        await removerArquivo(d.banco, id);
        d.apagarArquivoLocal(arquivo.uri);
        d.aoMudar();
        return "enviado";
      });
    },

    /** Baixa a cópia nova da equipe (sem subir a fila antes). */
    baixarCopia(): Promise<void> {
      return naVez(async () => {
        await baixarCopia();
        d.aoMudar();
      });
    },

    /**
     * O que o "Sincronizar", a abertura do app e a volta do sinal fazem: sobe a fila e, se o servidor respondeu, baixa a cópia nova.
     * Chamadas ao mesmo tempo dividem a mesma sincronização.
     */
    sincronizar(): Promise<ResultadoDaSincronizacao> {
      if (emAndamento) return emAndamento;
      const execucao = naVez(async (): Promise<ResultadoDaSincronizacao> => {
        const envio = await passada();
        let copiaAtualizada = false;
        let { erro, semSinal } = envio;
        if (!envio.semSinal && !envio.erro && d.conexao() === "online") {
          try {
            await baixarCopia();
            copiaAtualizada = true;
          } catch (e) {
            if (e instanceof ErroDeRede || (e instanceof ErroDaApi && e.status >= 500)) semSinal = true;
            else erro = mensagemDoErro(e);
          }
        }
        d.aoMudar();
        return { ...envio, semSinal, erro, copiaAtualizada };
      });
      const limpar = () => {
        if (emAndamento === execucao) emAndamento = null;
      };
      emAndamento = execucao;
      execucao.then(limpar, limpar);
      return execucao;
    },
  };
}

export type Sincronizador = ReturnType<typeof criarSincronizador>;
