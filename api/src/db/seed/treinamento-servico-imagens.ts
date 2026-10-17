import type { Armazenamento } from "../../servicos/armazenamento";
import { nivelDaConquista, trofeu } from "./imagens-gamificacao";
import { CONQUISTAS_TREINAMENTO_SERVICO } from "./treinamento-servico-dados";

/** Os troféus das 3 conquistas dos treinamentos de serviço, pelo id do arquivo no bucket `gamificacao` (mesmo bucket das demais). */
export function imagensDaCargaDeTreinamentoServico(): Map<string, Uint8Array> {
  const imagens = new Map<string, Uint8Array>();
  for (const c of CONQUISTAS_TREINAMENTO_SERVICO) imagens.set(c.imagemId, trofeu(nivelDaConquista(c.pontos, false), c.emblema));
  return imagens;
}

/** Grava no bucket `gamificacao` as imagens que ainda faltarem (a subida da `api` chama; idempotente, como `garantirImagensDaGamificacao`). */
export async function garantirImagensDeTreinamentoServico(armazenamento: Armazenamento): Promise<number> {
  const imagens = imagensDaCargaDeTreinamentoServico();
  let gravadas = 0;
  for (const [id, bytes] of imagens) {
    if (await armazenamento.existe("gamificacao", id)) continue;
    await armazenamento.gravar("gamificacao", id, bytes, "image/png");
    gravadas++;
  }
  return gravadas;
}
