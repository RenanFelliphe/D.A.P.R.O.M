import type { Armazenamento } from "../../servicos/armazenamento";
import { nivelDaConquista, trofeu } from "./imagens-gamificacao";
import { CONQUISTAS_SINCRONIZACAO_OFFLINE } from "./sincronizacao-offline-dados";

/** O troféu da conquista de sincronização offline, pelo id do arquivo no bucket `gamificacao` (mesmo bucket das demais). */
export function imagensDaCargaDeSincronizacaoOffline(): Map<string, Uint8Array> {
  const imagens = new Map<string, Uint8Array>();
  for (const c of CONQUISTAS_SINCRONIZACAO_OFFLINE) imagens.set(c.imagemId, trofeu(nivelDaConquista(c.pontos, false), c.emblema));
  return imagens;
}

/** Grava no bucket `gamificacao` as imagens que ainda faltarem (a subida da `api` chama; idempotente, como `garantirImagensDaGamificacao`). */
export async function garantirImagensDeSincronizacaoOffline(armazenamento: Armazenamento): Promise<number> {
  let gravadas = 0;
  for (const [id, bytes] of imagensDaCargaDeSincronizacaoOffline()) {
    if (await armazenamento.existe("gamificacao", id)) continue;
    await armazenamento.gravar("gamificacao", id, bytes, "image/png");
    gravadas++;
  }
  return gravadas;
}
