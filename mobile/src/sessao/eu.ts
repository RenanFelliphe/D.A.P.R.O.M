import type { RespostaMe } from "@shared/api/tipos";
import { ErroDeConexaoNecessaria, ErroDeRede } from "../api/erros";
import type { EuGuardado } from "../offline/identidade";
import { dentroDaJanela, JANELA_SEM_SINAL_DIAS } from "./janela";

/**
 * Quem está logado (`GET /me`), com a regra do app sem sinal: com sinal, pergunta ao servidor (e guarda a resposta no aparelho); sem
 * sinal, ou se o servidor não responde, usa a última resposta guardada **se tiver menos de 7 dias**; senão, "Conecte-se para entrar".
 * O erro da `api` (conta desativada, sessão vencida) nunca cai para a cópia: é o servidor dizendo que a pessoa não entra.
 */

/** Com uma cópia à mão, o `GET /me` desiste cedo (a cópia serve); sem ela, vale o tempo normal. */
export const TEMPO_DO_ME_COM_COPIA_MS = 8_000;

export interface DependenciasDoEu {
  /** Entrou sem sinal, com a senha guardada: não há sessão no servidor para perguntar. */
  modoLocal(): boolean;
  /** A conexão do aparelho. */
  semConexao(): boolean;
  buscar(opcoes: { tempoLimiteMs?: number }): Promise<RespostaMe>;
  lerGuardado(): Promise<EuGuardado | null>;
  /** Guarda o que o servidor respondeu e renova a janela de 7 dias da conta. */
  guardar(eu: RespostaMe): Promise<void>;
  agora(): Date;
}

export interface ResultadoDoEu {
  eu: RespostaMe;
  /** Veio da cópia do aparelho, não do servidor (sem sinal). */
  doAparelho: boolean;
}

export const mensagemSemCopia = "Sem conexão com o servidor. Este aparelho ainda não tem os dados da sua conta: conecte-se para abrir o app.";
export const mensagemCopiaVencida = `Sem conexão com o servidor. Faz mais de ${JANELA_SEM_SINAL_DIAS} dias que o aparelho não confirma a sua conta: conecte-se para abrir o app.`;

export function criarCarregadorDoEu(d: DependenciasDoEu): () => Promise<ResultadoDoEu> {
  const doAparelho = async (guardado: EuGuardado | null): Promise<ResultadoDoEu> => {
    if (!guardado) throw new ErroDeConexaoNecessaria(mensagemSemCopia);
    if (!dentroDaJanela(guardado.confirmadoEm, d.agora())) throw new ErroDeConexaoNecessaria(mensagemCopiaVencida);
    return { eu: guardado.eu, doAparelho: true };
  };

  return async () => {
    const guardado = await d.lerGuardado().catch(() => null);
    if (d.modoLocal() || d.semConexao()) return doAparelho(guardado);
    try {
      const eu = await d.buscar({ tempoLimiteMs: guardado ? TEMPO_DO_ME_COM_COPIA_MS : undefined });
      // Guardar não pode derrubar a abertura do app: o que o aparelho não conseguir gravar só faz falta no próximo "sem sinal".
      await d.guardar(eu).catch(() => undefined);
      return { eu, doAparelho: false };
    } catch (e) {
      if (e instanceof ErroDeRede) return doAparelho(guardado);
      throw e;
    }
  };
}
