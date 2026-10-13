/**
 * PDF de uma página gerado em código (sem biblioteca), com um título e algumas linhas de texto: serve de documento
 * anexado como evidência (laudo, relatório) nos dados de demonstração e nos testes. O texto vai em Helvetica com a
 * codificação WinAnsi, então acentos do português saem certos.
 */
export function documentoDemo(titulo: string, linhas: string[] = []): Uint8Array<ArrayBuffer> {
  const escapar = (s: string) => s.replace(/[\\()]/g, "\\$&");
  const texto = [titulo, "", ...linhas, "", "Documento fictício gerado para demonstração do D.A.P.R.O.M."]
    .map((linha, i) => `BT /F1 ${i === 0 ? 15 : 11} Tf 56 ${780 - i * 18} Td (${escapar(linha)}) Tj ET`)
    .join("\n");

  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(texto, "latin1")} >>\nstream\n${texto}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];

  let corpo = "%PDF-1.4\n";
  const posicoes: number[] = [];
  objetos.forEach((o, i) => {
    posicoes.push(Buffer.byteLength(corpo, "latin1"));
    corpo += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(corpo, "latin1");
  corpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${posicoes.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("")}`;
  corpo += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(corpo, "latin1"));
}
