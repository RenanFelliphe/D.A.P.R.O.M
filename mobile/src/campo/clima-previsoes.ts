import type { PrevisaoDoTempo, JanelaDoClima } from "@shared/api/clima";
import type { Posicao } from "@shared/api/localizacao";
import type { Consulta } from "../offline/banco";
import { gravarMeta, lerMeta } from "../offline/copia";
import type { Conexao } from "../offline/sincronizar";

/**
 * A previsão do tempo no aparelho (`docs/operacao-de-campo.md`, seção 4.7). Online, vem da `api` (`GET /clima`) e a última resposta de cada
 * janela fica guardada no banco local; sem sinal, vale a guardada, desde que seja de hoje e ainda tenha horas pela frente. Sem nenhuma, não
 * há previsão: as telas simplesmente não a mostram. O app NUNCA bloqueia nem trava por falta de previsão.
 */

const FUSO = "America/Sao_Paulo";
const formatoDia = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO });
const formatoHora = new Intl.DateTimeFormat("en-GB", { timeZone: FUSO, hour: "2-digit", hour12: false });

const diaDe = (d: Date) => formatoDia.format(d);
const horaDe = (d: Date) => Number(formatoHora.format(d)) % 24;

/** A chave, no banco local, da última previsão de cada janela. */
export const chaveDaPrevisao = (janela: JanelaDoClima) => `clima:${janela}`;

/** Guarda a última previsão de uma janela (só a que tem horas: a "indisponível" não vale guardar). */
export async function guardarPrevisao(c: Consulta, previsao: PrevisaoDoTempo): Promise<void> {
  if (!previsao.disponivel || previsao.horas.length === 0) return;
  await gravarMeta(c, chaveDaPrevisao(previsao.janela), JSON.stringify(previsao));
}

/**
 * A previsão guardada de uma janela, se ainda serve: foi consultada hoje (dia de São Paulo) e a última hora dela ainda não passou. Uma de
 * ontem ou já toda no passado não serve (o tempo mudou): devolve `null`.
 */
export async function lerPrevisaoGuardada(c: Consulta, janela: JanelaDoClima, agora: Date): Promise<PrevisaoDoTempo | null> {
  const bruto = await lerMeta(c, chaveDaPrevisao(janela));
  if (!bruto) return null;
  let previsao: PrevisaoDoTempo;
  try {
    previsao = JSON.parse(bruto) as PrevisaoDoTempo;
  } catch {
    return null;
  }
  if (!previsao.disponivel || !Array.isArray(previsao.horas) || previsao.horas.length === 0) return null;
  const consultada = new Date(previsao.consultada_em);
  if (Number.isNaN(consultada.getTime()) || diaDe(consultada) !== diaDe(agora)) return null;
  const ultimaHora = Number(previsao.horas[previsao.horas.length - 1]!.hora.slice(11, 13));
  return ultimaHora >= horaDe(agora) ? previsao : null;
}

export interface PedidoDePrevisao {
  janela: JanelaDoClima;
  /** A posição do aparelho; sem ela, a `api` usa a cidade padrão que o admin escolheu. */
  posicao?: Posicao | null;
}

export interface DependenciasDasPrevisoes {
  banco: Consulta;
  /** `GET /clima` na `api`. */
  buscar: (consulta: Record<string, string | number>) => Promise<PrevisaoDoTempo>;
  conexao: () => Conexao;
  agora: () => Date;
}

/** `GET /clima` com a posição (se houver) na consulta, como a `api` espera. */
export const consultaDoClima = (p: PedidoDePrevisao): Record<string, string | number> => ({
  janela: p.janela,
  ...(p.posicao ? { latitude: p.posicao.latitude, longitude: p.posicao.longitude } : {}),
});

/**
 * Online: pergunta à `api` e guarda a resposta. Sem sinal, ou se a `api` falhar ou disser que está sem previsão, vale a guardada de hoje.
 * Devolve `null` quando não há previsão nenhuma (nunca lança).
 */
export function criarPrevisoes(dep: DependenciasDasPrevisoes) {
  async function obter(pedido: PedidoDePrevisao): Promise<PrevisaoDoTempo | null> {
    let remota: PrevisaoDoTempo | null = null;
    if (dep.conexao() !== "offline") {
      try {
        remota = await dep.buscar(consultaDoClima(pedido));
        if (remota.disponivel) {
          await guardarPrevisao(dep.banco, remota).catch(() => undefined);
          return remota;
        }
      } catch {
        remota = null;
      }
    }
    const guardada = await lerPrevisaoGuardada(dep.banco, pedido.janela, dep.agora()).catch(() => null);
    return guardada ?? (remota?.disponivel ? remota : null);
  }
  return { obter };
}
