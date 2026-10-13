import { evidencia, type EvidenciaTipo } from "../db/schema";
import type { Bucket } from "../servicos/armazenamento";

/**
 * Evidências: a foto (bucket `fotos`) e o documento em PDF (bucket `documentos`), ligados a um item reprovado da APR ou
 * a uma execução. Os dois ficam na mesma tabela; as respostas da `api` os devolvem separados, em `fotos` e `documentos`.
 */

/** Onde o arquivo da evidência fica: a foto no bucket `fotos`, o PDF no `documentos`. */
export const bucketDaEvidencia = (tipo: EvidenciaTipo): Bucket => (tipo === "pdf" ? "documentos" : "fotos");

/**
 * O arquivo que a evidência de um item reprovado exige além da observação: `foto` ou `pdf`, conforme o item do modelo;
 * `null` quando basta o texto. Fotos e PDFs a mais são sempre aceitos.
 */
export const arquivoExigido = (evidenciaDoItem: string): EvidenciaTipo | null => (evidenciaDoItem === "foto" || evidenciaDoItem === "pdf" ? evidenciaDoItem : null);

/** Colunas de `evidencia` que as leituras usam (`select({...colunasDeEvidencia, ...})`). */
export const colunasDeEvidencia = {
  id: evidencia.id,
  tipo: evidencia.tipo,
  fotoPath: evidencia.fotoPath,
  nomeArquivo: evidencia.nomeArquivo,
  capturadaEm: evidencia.capturadaEm,
  latitude: evidencia.latitude,
  longitude: evidencia.longitude,
};

type LinhaDeEvidencia = { id: string; tipo: EvidenciaTipo; fotoPath: string; nomeArquivo: string | null; capturadaEm: Date; latitude: number | null; longitude: number | null };

/**
 * As fotos (com a posição) e os documentos em PDF (com o nome do arquivo), na ordem em que vieram. `arquivo_path` do
 * documento é o id para `GET /arquivos/{id}/url`, como o `foto_path` da foto.
 */
export function separarEvidencias(linhas: LinhaDeEvidencia[]) {
  return {
    fotos: linhas.filter((e) => e.tipo === "foto").map(({ id, fotoPath, capturadaEm, latitude, longitude }) => ({ id, fotoPath, capturadaEm, latitude, longitude })),
    documentos: linhas.filter((e) => e.tipo === "pdf").map(({ id, fotoPath, nomeArquivo, capturadaEm }) => ({ id, arquivoPath: fotoPath, nome: nomeArquivo, capturadaEm })),
  };
}
