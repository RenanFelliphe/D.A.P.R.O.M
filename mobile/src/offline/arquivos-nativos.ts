import { Directory, File, Paths } from "expo-file-system";
import type { ArquivoLocal } from "../api/eventos";

/**
 * Os arquivos da fila ficam na pasta de documentos do app, não no cache: o Android pode esvaziar o cache com o app fechado, e uma foto
 * tirada sem sinal tem que estar lá quando o sinal voltar.
 */
const pasta = () => new Directory(Paths.document, "fila-arquivos");

/** Copia o arquivo para a pasta da fila e devolve o endereço novo. */
export async function guardarCopiaDoArquivo(arquivo: ArquivoLocal, id: string): Promise<ArquivoLocal> {
  const destino = pasta();
  destino.create({ idempotent: true, intermediates: true });
  const copia = new File(destino, `${id}-${arquivo.nome}`);
  if (copia.uri === arquivo.uri) return arquivo;
  if (copia.exists) copia.delete();
  await new File(arquivo.uri).copy(copia, { overwrite: true });
  return { ...arquivo, uri: copia.uri };
}

/** Apaga a cópia da fila depois do envio. Nunca lança: apagar é limpeza, não regra. */
export function apagarCopiaDaFila(uri: string): void {
  if (!uri.startsWith("file:")) return;
  try {
    const arquivo = new File(uri);
    if (arquivo.exists) arquivo.delete();
  } catch {
    /* já não existe */
  }
}
