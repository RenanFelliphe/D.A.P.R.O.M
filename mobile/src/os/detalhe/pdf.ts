import { Directory, File, Paths } from "expo-file-system";
import { startActivityAsync } from "expo-intent-launcher";
import { cliente } from "@/api/api";

const VISUALIZAR = "android.intent.action.VIEW";
const PERMISSAO_DE_LEITURA = 1; // Intent.FLAG_GRANT_READ_URI_PERMISSION

/**
 * Baixa o PDF da OS encerrada (`GET /os/{id}/pdf`, que pede o token, por isso não vai direto ao leitor) para a pasta de cache e o
 * abre no leitor de PDF do aparelho. Lança um `Error` com a mensagem pronta para a tela.
 */
export async function abrirPdfDaOs(osId: string): Promise<void> {
  let arquivo: File;
  try {
    const pasta = new Directory(Paths.cache, "pdfs");
    if (!pasta.exists) pasta.create();
    const destino = new File(pasta, `os-${osId}.pdf`);
    if (destino.exists) destino.delete();
    arquivo = await File.downloadFileAsync(cliente.endereco(`/os/${osId}/pdf`), destino, { headers: await cliente.autorizacao() });
  } catch {
    throw new Error("Não foi possível baixar o PDF. Confira a conexão e tente de novo.");
  }
  try {
    await startActivityAsync(VISUALIZAR, { data: arquivo.contentUri, flags: PERMISSAO_DE_LEITURA, type: "application/pdf" });
  } catch {
    throw new Error("Não há um leitor de PDF neste aparelho. Instale um (por exemplo, o Google Drive) e tente de novo.");
  }
}
