import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { LIMITE_DO_PDF_EM_BYTES } from "@shared/api/evidencias";
import { novoUuid } from "@shared/api/uuid";
import type { ArquivoLocal } from "@/api/eventos";

/** A questão 16: o lado maior da foto vai a ~1600 px e a qualidade a 70% (~300 KB), para subir rápido mesmo com sinal fraco. */
export const LADO_MAIOR_DA_FOTO = 1600;
export const QUALIDADE_DA_FOTO = 0.7;

export type OrigemDaFoto = "camera" | "galeria";

/** Uma foto já comprimida e guardada no aparelho, esperando para subir. O `id` é o do arquivo na `api`: reenviar o mesmo id não duplica. */
export interface FotoPronta extends ArquivoLocal {
  id: string;
  capturadaEm: string;
}

/** Um PDF escolhido, copiado para o armazenamento do app e conferido (tipo e tamanho), esperando para subir. */
export interface PdfPronto extends ArquivoLocal {
  id: string;
  capturadaEm: string;
}

/** O nome do arquivo guardado no aparelho: o que a pessoa escolheu, ou um nome padrão. */
export const nomeDoPdf = (nome: string | null | undefined) => (nome && nome.trim() ? nome.trim() : "documento.pdf");

/** O arquivo parece um PDF? Pelo tipo declarado ou, se o seletor não o declarou, pela extensão. */
export const pareceUmPdf = (nome: string, tipoMime?: string | null) => tipoMime === "application/pdf" || (!tipoMime && /\.pdf$/i.test(nome));

async function comprimir(uri: string): Promise<string> {
  // `maxWidth`/`maxHeight` fazem o Android decodificar a imagem já reduzida: uma foto de 100 MP não estoura a memória.
  const contexto = ImageManipulator.manipulate(uri, { maxWidth: LADO_MAIOR_DA_FOTO, maxHeight: LADO_MAIOR_DA_FOTO });
  const imagem = await contexto.renderAsync();
  const resultado = await imagem.saveAsync({ compress: QUALIDADE_DA_FOTO, format: SaveFormat.JPEG });
  return resultado.uri;
}

/**
 * Abre a câmera (ou a galeria), comprime a foto e a devolve pronta para subir; `null` se a pessoa cancelou. Lança um `Error` com a
 * mensagem pronta para a tela (sem permissão da câmera, falha ao abrir).
 */
export async function escolherFoto(origem: OrigemDaFoto): Promise<FotoPronta | null> {
  let original: string;
  try {
    if (origem === "camera") {
      const permissao = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissao.granted) throw new Error("Sem permissão para usar a câmera. Libere a câmera nas configurações do aparelho ou escolha uma foto da galeria.");
    }
    const opcoes: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, exif: false, allowsEditing: false };
    const resultado = origem === "camera" ? await ImagePicker.launchCameraAsync(opcoes) : await ImagePicker.launchImageLibraryAsync({ ...opcoes, allowsMultipleSelection: false });
    const arquivo = resultado.canceled ? undefined : resultado.assets[0];
    if (!arquivo) return null;
    original = arquivo.uri;
  } catch (e) {
    throw e instanceof Error && e.message.startsWith("Sem permissão") ? e : new Error("Não foi possível abrir a câmera. Tente de novo.");
  }
  let uri: string;
  try {
    uri = await comprimir(original);
  } catch {
    throw new Error("Não foi possível preparar a foto. Tire outra.");
  }
  // A foto da câmera fica no cache do seletor; a comprimida é a única que o app guarda.
  if (origem === "camera") apagarArquivoLocal(original);
  const id = novoUuid();
  return { id, uri, nome: `foto-${id.slice(0, 8)}.jpg`, tipoMime: "image/jpeg", capturadaEm: new Date().toISOString() };
}

/**
 * Abre o seletor de documentos e devolve o PDF escolhido; `null` se a pessoa cancelou. Lança um `Error` com a mensagem pronta para a
 * tela quando o arquivo não é um PDF ou passa de 10 MB (o limite da `api`).
 */
export async function escolherPdf(): Promise<PdfPronto | null> {
  let resultado: DocumentPicker.DocumentPickerResult;
  try {
    resultado = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true, multiple: false });
  } catch {
    throw new Error("Não foi possível abrir os documentos. Tente de novo.");
  }
  const arquivo = resultado.canceled ? undefined : resultado.assets[0];
  if (!arquivo) return null;
  const nome = nomeDoPdf(arquivo.name);
  if (!pareceUmPdf(nome, arquivo.mimeType)) {
    apagarArquivoLocal(arquivo.uri);
    throw new Error("Escolha um arquivo PDF.");
  }
  if ((arquivo.size ?? 0) > LIMITE_DO_PDF_EM_BYTES) {
    apagarArquivoLocal(arquivo.uri);
    throw new Error("O PDF passa de 10 MB. Envie um arquivo menor.");
  }
  return { id: novoUuid(), uri: arquivo.uri, nome, tipoMime: "application/pdf", capturadaEm: new Date().toISOString() };
}

/** Apaga um arquivo do armazenamento do app (a foto já enviada). Nunca lança: apagar é limpeza, não regra. */
export function apagarArquivoLocal(uri: string | undefined | null) {
  if (!uri || !uri.startsWith("file:")) return;
  try {
    const arquivo = new File(uri);
    if (arquivo.exists) arquivo.delete();
  } catch {
    /* já não existe ou não pode ser apagado: o sistema limpa o cache sozinho */
  }
}

export const apagarArquivosLocais = (uris: (string | undefined | null)[]) => uris.forEach(apagarArquivoLocal);
