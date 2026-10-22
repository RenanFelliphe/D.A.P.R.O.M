import type { PrevisaoDoTempo } from "@shared/api/clima";
import { cliente } from "../api/api";
import { conexaoDoAparelho } from "../offline/app";
import { bancoDoAparelho } from "../offline/banco-nativo";
import { posicaoDaFoto } from "./localizacao";
import { criarPrevisoes, type PedidoDePrevisao } from "./clima-previsoes";

const previsoes = criarPrevisoes({
  banco: bancoDoAparelho,
  buscar: (consulta) => cliente.chamar<PrevisaoDoTempo>("/clima", { consulta }),
  conexao: conexaoDoAparelho,
  agora: () => new Date(),
});

/**
 * A previsão do tempo de uma janela (`expediente` na lista de OS, `proximas_horas` na APR e no encerramento): da `api` quando há sinal, da
 * última guardada de hoje quando não há, `null` quando não há nenhuma. A posição vem do aparelho só se a permissão já foi dada (aqui não
 * se abre pedido de permissão); sem ela, a `api` usa a cidade padrão. Nunca lança.
 */
export async function obterPrevisao(pedido: Pick<PedidoDePrevisao, "janela">): Promise<PrevisaoDoTempo | null> {
  const posicao = await posicaoDaFoto().catch(() => null);
  return previsoes.obter({ janela: pedido.janela, posicao });
}
