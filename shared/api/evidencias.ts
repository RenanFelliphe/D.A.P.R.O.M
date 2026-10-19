/**
 * As evidências (fotos e PDFs) de um evento de execução, no formato do payload (`execucao_interrompida` e `encerramento_assinado`).
 * Cada arquivo já subiu por `PUT /arquivos/{id}`; o evento só o referencia por `arquivo_id`. A `previa` é o endereço local da imagem
 * (um `blob:` na web, um `file://` no app), só para mostrar.
 */

/** Foto já enviada, pronta para virar uma evidência do evento. */
export interface FotoDaExecucao {
  /** Id da evidência (nasce no cliente). */
  id: string;
  arquivoId: string;
  previa: string;
  capturadaEm: string;
  latitude?: number;
  longitude?: number;
}

/** Evidência no formato do payload dos eventos de execução. */
export const comoEvidencia = (f: FotoDaExecucao) => ({
  id: f.id,
  arquivo_id: f.arquivoId,
  capturada_em: f.capturadaEm,
  ...(f.latitude !== undefined && f.longitude !== undefined ? { latitude: f.latitude, longitude: f.longitude } : {}),
});

/** PDF já enviado (`PUT /arquivos/{id}` com `tipo=pdf`), pronto para virar uma evidência do evento: um laudo, um relatório. */
export interface PdfDaExecucao {
  /** Id da evidência (nasce no cliente). */
  id: string;
  arquivoId: string;
  nome: string;
  capturadaEm: string;
}

/** PDF no formato do payload dos eventos de execução. */
export const pdfComoEvidencia = (d: PdfDaExecucao) => ({ id: d.id, arquivo_id: d.arquivoId, tipo: "pdf" as const, nome: d.nome, capturada_em: d.capturadaEm });

/** Limites da `api` por execução: até 10 fotos e 5 PDFs; cada PDF até 10 MB. */
export const MAX_FOTOS_DA_EXECUCAO = 10;
export const MAX_PDFS_DA_EXECUCAO = 5;
export const LIMITE_DO_PDF_EM_BYTES = 10 * 1024 * 1024;
