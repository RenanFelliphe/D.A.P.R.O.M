/**
 * Gera um PDF "escaneado" de exemplo (só imagem, como o que sai do scanner) com duas OS fictícias já "executadas no papel", para
 * experimentar a Digitalização de OS antigas (Importação, "Já foi concluída no papel"). As folhas são as mesmas do
 * `pnpm pdf:exemplo`, desenhadas como imagem, com o escrito à mão simulado numa fonte manuscrita (caneta azul): o início e o
 * fim reais e o número de pessoas na linha da operação, a descrição da atividade e uma rubrica.
 *
 *   pnpm pdf:digitalizado                 -> grava ./folhas-digitalizadas-exemplo.pdf
 *   pnpm pdf:digitalizado -- saida.pdf    -> grava no caminho dado
 *
 * Os PDFs de `base/os-examples` têm nomes e matrículas reais e não devem ir a um fornecedor de IA: este é o arquivo de teste
 * para a leitura com IA (só dados fictícios). A fonte manuscrita é a do sistema (Segoe Script ou Ink Free no Windows); sem ela, o
 * texto sai numa fonte comum e a IA lê do mesmo jeito.
 */
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { montarPdfDasFolhas } from "../src/servicos/pdf-folhas";
import { abrirFolhas } from "../src/servicos/pdf-imagem";
import { CORRETIVA_4023470, gerarPdfDeOs, PREVENTIVA_4019821, type OsDoPdf } from "../test/fixture-pdf-os";

const destino = resolve(process.argv.slice(2).find((a) => a !== "--") ?? "folhas-digitalizadas-exemplo.pdf");

/** O que a equipe "escreveu" em cada OS. `data` no formato curto do papel (dd/mm/aa). */
interface Escrito {
  pessoas: number;
  data: string;
  inicio: string;
  fim: string;
  texto: string[];
}

const OS: { ordem: OsDoPdf; escrito: Escrito }[] = [
  {
    ordem: { ...PREVENTIVA_4019821, numero: "4032101", dataOrdem: "05/10/2026", impressao: "12/10/2026", inicio: "13/10/2026", fim: "13/10/2026" },
    escrito: { pessoas: 2, data: "13/10/26", inicio: "08:40", fim: "10:05", texto: ["Inspecao feita normalmente.", "Tensao de saida estavel, sem anomalias."] },
  },
  {
    ordem: { ...CORRETIVA_4023470, numero: "4032102", dataOrdem: "08/10/2026", impressao: "12/10/2026", inicio: "14/10/2026", fim: "14/10/2026" },
    escrito: { pessoas: 3, data: "14/10/26", inicio: "13:15", fim: "15:50", texto: ["Valvula desobstruida e drenada.", "Caixa limpa, tampa recolocada."] },
  },
];

/** Geometria da folha do SAP gerada pelo fixture (pontos, de cima para baixo): as colunas da tabela de operações e a folha de execução. */
const M = 34;
const LARGURA_PT = 595.28;
const COLUNAS = [32, 58, 130, 32, 40, 52, 44, 52, 46];
const colunaX = (i: number) => M + COLUNAS.slice(0, i).reduce((t, l) => t + l, 0);
const FONTE = '"Segoe Script", "Ink Free", "Bradley Hand", "Comic Sans MS", cursive';
const CANETA = "#1d3fa8";

/** Onde a linha da operação (0010) termina na folha da ordem: lida do próprio PDF (o texto dela está lá). */
async function yDaOperacao(pdf: Uint8Array, folha: number): Promise<number> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const tarefa = getDocument({ data: new Uint8Array(pdf), verbosity: 0 });
  const doc = await tarefa.promise;
  const pagina = await doc.getPage(folha);
  const conteudo = await pagina.getTextContent();
  const item = conteudo.items.find((i) => "str" in i && i.str === "0010");
  const altura = pagina.view[3]!;
  await tarefa.destroy();
  if (!item || !("transform" in item)) throw new Error("a linha da operação não foi achada no PDF de exemplo");
  // `transform[5]` é o y do PDF (de baixo para cima): a linha da operação tem 26 pt de altura e a escrita fica logo abaixo dela.
  return altura - (item.transform as number[])[5]! + 26;
}

const pdfOriginal = await gerarPdfDeOs(OS.map((o) => o.ordem));
const folhas = await abrirFolhas(pdfOriginal);
const jpegs: Uint8Array[] = [];
try {
  for (let n = 1; n <= folhas.total; n++) {
    const folha = await folhas.renderizar(n);
    const imagem = await loadImage(Buffer.from(folha.jpeg));
    const canvas = createCanvas(imagem.width, imagem.height);
    const c = canvas.getContext("2d");
    c.drawImage(imagem, 0, 0);
    const pt = imagem.width / LARGURA_PT;
    const { escrito } = OS[Math.floor((n - 1) / 2)]!;
    c.fillStyle = CANETA;
    c.strokeStyle = CANETA;
    c.lineWidth = 3;
    c.textBaseline = "alphabetic";

    if (n % 2 === 1) {
      // Folha da ordem: a linha de baixo da operação (pessoas, data e hora de início, data e hora de fim).
      const y = (await yDaOperacao(pdfOriginal, n)) * pt;
      c.font = `${Math.round(7 * pt)}px ${FONTE}`;
      const celulas: [number, string][] = [[3, String(escrito.pessoas)], [5, escrito.data], [6, escrito.inicio], [7, escrito.data], [8, escrito.fim]];
      for (const [coluna, texto] of celulas) c.fillText(texto, (colunaX(coluna) + 2) * pt, y + 16 * pt);
    } else {
      // Folha de execução: a descrição nas primeiras linhas e uma rubrica no primeiro "Executante".
      c.font = `${Math.round(11 * pt)}px ${FONTE}`;
      escrito.texto.forEach((linha, i) => c.fillText(linha, (M + 6) * pt, (M + 56 + 16 + 14 + i * 18) * pt));
      const x0 = (M + 20) * pt;
      const y0 = (M + 56 + 16 + 20 * 18 + 24 + 28) * pt;
      c.beginPath();
      c.moveTo(x0, y0);
      for (let i = 1; i <= 8; i++) c.lineTo(x0 + i * 7 * pt, y0 + (i % 2 === 0 ? -8 : 7) * pt);
      c.stroke();
    }
    jpegs.push(canvas.toBuffer("image/jpeg", 80));
  }
} finally {
  await folhas.fechar();
}

await writeFile(destino, await montarPdfDasFolhas(jpegs, "Folhas digitalizadas (exemplo fictício)"));
console.log(`PDF digitalizado de exemplo gravado em ${destino} (${OS.length} OS fictícias: ${OS.map((o) => o.ordem.numero).join(", ")}).`);
