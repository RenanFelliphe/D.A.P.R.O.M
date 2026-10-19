/**
 * Gera um PDF "escaneado" de exemplo (só imagem, como o que sai do scanner) com duas OS fictícias já "executadas no papel", para
 * experimentar a Digitalização de OS antigas (Importação, "Já foi concluída no papel"). As folhas são as mesmas do
 * `pnpm pdf:exemplo`, desenhadas como imagem, com o escrito à mão simulado numa fonte manuscrita (caneta azul): o início e o
 * fim reais e o número de pessoas na linha da operação, a descrição da atividade e uma rubrica. A primeira OS vem com a folha da
 * APR em papel (modelo APR 04, perguntas de verificação): o título impresso, a data, o serviço e duas pessoas escritos à mão, e o
 * "✓" na coluna SIM de cada pergunta (uma delas marcada em NÃO).
 *
 *   pnpm pdf:digitalizado                 -> grava ./folhas-digitalizadas-exemplo.pdf
 *   pnpm pdf:digitalizado -- saida.pdf    -> grava no caminho dado
 *
 * Os PDFs de `base/os-examples` têm nomes e matrículas reais e não devem ir a um fornecedor de IA: este é o arquivo de teste
 * para a leitura com IA (só dados fictícios). A fonte manuscrita é a do sistema (Segoe Script ou Ink Free no Windows); sem ela, o
 * texto sai numa fonte comum e a IA lê do mesmo jeito.
 */
import { readFile, writeFile } from "node:fs/promises";
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

/** A folha da APR em papel (A4, 200 dpi): o formulário impresso do modelo APR 04 e o que a equipe escreveu à mão. */
async function folhaDaApr(numeroDaOs: string): Promise<Uint8Array> {
  const modelos = JSON.parse(await readFile(resolve(import.meta.dirname, "../src/db/seed/modelos-apr.json"), "utf8")).modelos as { codigo: string; titulo: string; itens: { secao: string; ordem: number; texto: string }[] }[];
  const modelo = modelos.find((m) => m.codigo === "APR 04");
  if (!modelo) throw new Error("o modelo APR 04 não está na carga inicial");
  const perguntas = modelo.itens.filter((i) => i.secao === "verificacao").slice(0, 14);
  const px = 1654 / LARGURA_PT;
  const canvas = createCanvas(1654, Math.round(841.89 * px));
  const c = canvas.getContext("2d");
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.textBaseline = "alphabetic";
  c.fillStyle = "#111111";
  c.strokeStyle = "#111111";
  c.lineWidth = 2;
  const impresso = (texto: string, x: number, y: number, tamanho: number, negrito = false) => {
    c.font = `${negrito ? "bold " : ""}${Math.round(tamanho * px)}px Arial, Helvetica, sans-serif`;
    c.fillText(texto, x * px, y * px);
  };
  impresso(`ANÁLISE PRELIMINAR DE RISCO — ${modelo.codigo}`, M, 52, 13, true);
  impresso(modelo.titulo, M, 70, 10, true);
  impresso("Versão 01", M, 86, 9);
  // Cabeçalho: número da OS, data e hora, serviço.
  impresso("OS nº:", M, 118, 9, true);
  impresso("Data:", M + 150, 118, 9, true);
  impresso("Hora:", M + 270, 118, 9, true);
  impresso("Serviço:", M, 140, 9, true);
  for (const y of [122, 144]) {
    c.beginPath();
    c.moveTo(M * px, y * px);
    c.lineTo((595.28 - M) * px, y * px);
    c.stroke();
  }
  // Tabela de pessoas.
  impresso("Supervisor da Atividade", M, 172, 9, true);
  impresso("Nome", M, 190, 8, true);
  impresso("Matrícula", M + 300, 190, 8, true);
  for (const y of [196, 220, 244]) {
    c.beginPath();
    c.moveTo(M * px, y * px);
    c.lineTo((595.28 - M) * px, y * px);
    c.stroke();
  }
  impresso("Executante", M, 262, 9, true);
  // As perguntas, com as colunas SIM, NÃO e N/A.
  const colunas = [430, 475, 520];
  impresso("Verificação", M, 292, 9, true);
  ["SIM", "NÃO", "N/A"].forEach((r, i) => impresso(r, colunas[i]!, 292, 8, true));
  perguntas.forEach((p, i) => {
    const y = 316 + i * 34;
    impresso(`${p.ordem}. ${p.texto.length > 74 ? `${p.texto.slice(0, 71)}...` : p.texto}`, M, y, 7.5);
    c.beginPath();
    c.moveTo(M * px, (y + 8) * px);
    c.lineTo((595.28 - M) * px, (y + 8) * px);
    c.stroke();
  });
  // O que foi escrito à mão: o cabeçalho, as pessoas e a marca de cada pergunta (a 3ª em NÃO, para a conferência avisar).
  c.fillStyle = CANETA;
  c.strokeStyle = CANETA;
  c.lineWidth = 3;
  const mao = (texto: string, x: number, y: number, tamanho: number) => {
    c.font = `${Math.round(tamanho * px)}px ${FONTE}`;
    c.fillText(texto, x * px, y * px);
  };
  mao(numeroDaOs, M + 40, 118, 10);
  mao("13/10/26", M + 185, 118, 10);
  mao("08:40", M + 305, 118, 10);
  mao("Inspecao da estacao de regulagem", M + 50, 140, 10);
  mao("Carlos Souza", M + 4, 214, 10);
  mao("7001", M + 305, 214, 10);
  mao("Marina Lopes", M + 4, 238, 10);
  mao("7002", M + 305, 238, 10);
  perguntas.forEach((_, i) => {
    const coluna = i === 2 ? 1 : 0;
    const x = (colunas[coluna]! + 6) * px;
    const y = (316 + i * 34 - 2) * px;
    c.beginPath();
    c.moveTo(x, y - 6 * px);
    c.lineTo(x + 4 * px, y);
    c.lineTo(x + 12 * px, y - 14 * px);
    c.stroke();
  });
  return canvas.toBuffer("image/jpeg", 80);
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
    // A APR em papel vem logo depois da folha de execução da primeira OS, sem o cabeçalho da OS (como o formulário grampeado).
    if (n === 2) jpegs.push(await folhaDaApr(OS[0]!.ordem.numero));
  }
} finally {
  await folhas.fechar();
}

await writeFile(destino, await montarPdfDasFolhas(jpegs, "Folhas digitalizadas (exemplo fictício)"));
console.log(`PDF digitalizado de exemplo gravado em ${destino} (${OS.length} OS fictícias: ${OS.map((o) => o.ordem.numero).join(", ")}; a primeira com a folha da APR em papel, APR 04).`);
