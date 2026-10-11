/** Dados da tela "Fila e sincronização" (SYNC_RECS e totais do protótipo). */

export interface RegistroFila {
  titulo: string;
  detalhe: string;
}

export const registrosFila: RegistroFila[] = [
  { titulo: "APR aprovada · OS 4031187", detalhe: "09:24 · #A-2210" },
  { titulo: "Execução iniciada · 4031187", detalhe: "09:31 · 2 pessoas" },
  { titulo: "Pausa · 4031187", detalhe: "10:15 a 10:27" },
  { titulo: "OS encerrada · 4031187", detalhe: "11:18 · 3 fotos · 2 assinaturas" },
  { titulo: "APR aprovada · OS 4031190", detalhe: "11:22 · #A-2211" },
  { titulo: "Execução iniciada · 4031190", detalhe: "11:26" },
];

export const totalArquivos = 5;
