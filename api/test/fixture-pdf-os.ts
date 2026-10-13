/**
 * PDF de OS no layout da "Ordem de Manutenção" impressa pelo SAP (o da OS 4019821 em `base/os-examples`): cabeçalho com o
 * número, a data da ordem e a folha; tabelas de "Rótulo:Valor" em duas colunas; o título; objetos técnicos; plano e item
 * (preventiva) ou nota (corretiva); datas programadas; a tabela de operações e o texto longo; e a folha de execução, com a
 * descrição e as assinaturas. Os PDFs reais são digitalizações (sem texto): este é o que o SAP gera direto, com texto.
 */
import PDFDocument from "pdfkit";

export interface OsDoPdf {
  numero: string;
  /** `dd/mm/aaaa`. */
  dataOrdem: string;
  impressao?: string;
  centroPlanejamento?: string;
  centroPrincipal: string;
  descricaoCentro?: string;
  tipoAtividade: string;
  statusSistema?: string;
  criadoPor?: string;
  titulo: string;
  local: string;
  endereco?: string;
  equipamento?: string;
  plano?: string;
  item?: string;
  nota?: string;
  /** `dd/mm/aaaa`. */
  inicio: string;
  fim?: string;
  prioridade?: string;
  textoLongo?: string[];
}

const M = 34;
const L = 595.28 - 2 * M;

type Doc = InstanceType<typeof PDFDocument>;

/** Linha da tabela com células "Rótulo:Valor" (rótulo em negrito, valor normal colado nele). */
function celulas(doc: Doc, y: number, itens: [string, string, number][], altura = 16) {
  let x = M;
  for (const [rotulo, valor, fracao] of itens) {
    const largura = fracao * L;
    doc.lineWidth(0.6).rect(x, y, largura, altura).stroke();
    doc.font("Helvetica-Bold").fontSize(9).text(`${rotulo}:`, x + 2, y + 4, { continued: true, lineBreak: false });
    doc.font("Helvetica").text(valor, { lineBreak: false });
    x += largura;
  }
  return y + altura;
}

function caixaCentral(doc: Doc, y: number, texto: string, tamanho: number, altura = 20) {
  doc.lineWidth(0.6).rect(M, y, L, altura).stroke();
  doc.font("Helvetica-Bold").fontSize(tamanho).text(texto, M, y + (altura - tamanho) / 2, { width: L, align: "center", lineBreak: false });
  return y + altura;
}

function cabecalho(doc: Doc, os: OsDoPdf, folha: string) {
  doc.lineWidth(0.8).rect(M, M, L, 46).stroke();
  doc.font("Helvetica-Bold").fontSize(20).text("ESgás", M + 20, M + 13, { lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(13).text("Ordem de Manutenção", M + 150, M + 8, { width: 200, align: "center", lineBreak: false });
  doc.fontSize(16).text(os.numero, M + 150, M + 25, { width: 200, align: "center", lineBreak: false });
  doc.font("Helvetica").fontSize(9).text(`Data da Ordem:  ${os.dataOrdem}`, M + 370, M + 10, { lineBreak: false });
  doc.text(`Data de Impr.:  ${os.impressao ?? os.dataOrdem}`, M + 370, M + 28, { lineBreak: false });
  doc.text(`Folha: ${folha}`, M + 480, M + 10, { lineBreak: false });
}

function paginaDaOrdem(doc: Doc, os: OsDoPdf, total: number) {
  cabecalho(doc, os, `1/${total}`);
  let y = M + 56;
  y = celulas(doc, y, [["Cent.Trab", os.centroPlanejamento ?? "1402", 0.5], ["Grup. Plan. PM", "MAN-Manutenção", 0.5]]);
  y = celulas(doc, y, [["Tipo Ativ Manut", os.tipoAtividade, 0.5], ["Empresa", "1410", 0.5]]);
  y = celulas(doc, y, [["Centro de trabalho principal da ordem", os.centroPrincipal, 0.5], ["Descrição do centro de trabalho", os.descricaoCentro ?? "", 0.5]]);
  y = celulas(doc, y, [["Status do usuário", "", 0.5], ["Status do sistema", os.statusSistema ?? "", 0.5]]);
  y = celulas(doc, y, [["Criado por", os.criadoPor ?? "", 0.5], ["Responsável", "", 0.5]]);
  y = caixaCentral(doc, y + 8, os.titulo, 13, 22);
  y = caixaCentral(doc, y + 8, "OBJETOS TÉCNICOS", 10, 18);
  y = celulas(doc, y + 8, [["Local de Instalação", os.local, 1]]);
  if (os.endereco) y = celulas(doc, y, [["Endereço", os.endereco, 1]]);
  y = celulas(doc, y, [["Fabricante", "", 0.34], ["Modelo", "", 0.33], ["No. de serie", "", 0.33]]);
  y = celulas(doc, y + 8, [["Equipamento", os.equipamento ?? "", 0.62], ["Fabricante", "", 0.38]]);
  y = celulas(doc, y, [["Nº peça fabric.", "", 0.34], ["Denomin.Tipo", "", 0.28], ["Nº de serie", "", 0.38]]);
  if (os.plano) {
    y = celulas(doc, y + 8, [["Plano de Manutenção", os.plano, 0.37], ["Item de Manutenção", os.item ?? "", 0.31], ["Periodicidade", "", 0.32]]);
    y = celulas(doc, y, [["Tipo", "PM-Ordem de manutenção", 0.37], ["Dt.Enc.Ult.Ord Plan", "15/11/2025", 0.63]]);
  }
  y = celulas(doc, y + 8, [["Nota", os.nota ?? "", 0.34], ["Criado por", "", 0.33], ["Tipo de Nota", "", 0.33]]);
  y = celulas(doc, y, [["Data de criação", "", 0.34], ["Autor da Nota", "", 0.33], ["Parte Objeto", "", 0.33]]);
  y = caixaCentral(doc, y + 8, "Código de Planejamento da Ordem", 10, 16);
  y = celulas(doc, y, [["Ordem planejada", os.plano ? "X" : "", 0.34], ["Ordem imediata", "", 0.33], ["Ordem não planejada", os.plano ? "" : "X", 0.33]]);
  y = caixaCentral(doc, y + 8, "Planejamento de Datas da Ordem", 10, 16);
  y = celulas(doc, y, [["Data de inicio programada", os.inicio, 0.5], ["Data fim programada", os.fim ?? "", 0.5]]);
  y = celulas(doc, y, [["Hora de Inicio", "00:00:00", 0.5], ["Hora de Fim", "00:00:00", 0.5]]);
  y = celulas(doc, y, [["Denominação da Revisão", "", 0.5], ["Prioridade", os.prioridade ?? "", 0.5]]);
  y = celulas(doc, y + 8, [["Ordem de produção", "", 0.5], ["Tempo parada", "", 0.5]]);
  y = caixaCentral(doc, y + 8, "HOUVE DESVIO?", 9, 16);
  doc.font("Helvetica-Bold").fontSize(9).text("Justificativa do desvio:", M + 2, y + 4, { lineBreak: false });
  y += 30;
  // Tabela de operações.
  const colunas: [string, number][] = [["Oper", 32], ["Centr.Trab", 58], ["Texto breve operação", 130], ["N Pes", 32], ["Durac.", 40], ["Data Ini", 52], ["Hora Ini", 44], ["Data Final", 52], ["Hora Final", 46], ["HH", L - 486]];
  let x = M;
  for (const [nome, largura] of colunas) {
    doc.lineWidth(0.6).rect(x, y, largura, 16).stroke();
    doc.font("Helvetica-Bold").fontSize(8).text(nome, x + 2, y + 4, { width: largura - 4, lineBreak: false });
    x += largura;
  }
  y += 16;
  const operacao = ["0010", os.centroPrincipal, os.titulo, "0", "0.0", os.inicio, "00:00:00", os.fim ?? os.inicio, "00:00:00", "0.0"];
  x = M;
  colunas.forEach(([, largura], i) => {
    doc.rect(x, y, largura, 26).stroke();
    doc.font("Helvetica").fontSize(8).text(operacao[i]!, x + 2, y + 4, { width: largura - 4, height: 22 });
    x += largura;
  });
  y += 34;
  doc.font("Helvetica").fontSize(9);
  for (const linha of os.textoLongo ?? []) {
    doc.text(linha, M + 4, y, { width: L - 8, lineBreak: false });
    y += 12;
  }
}

function paginaDeExecucao(doc: Doc, os: OsDoPdf, total: number) {
  cabecalho(doc, os, `2/${total}`);
  let y = M + 56;
  doc.font("Helvetica-Bold").fontSize(10).text("Descrição da atividade:", M + 2, y, { lineBreak: false });
  y += 16;
  for (let i = 0; i < 20; i++, y += 18) doc.moveTo(M, y).lineTo(M + L, y).stroke();
  doc.font("Helvetica-Bold").fontSize(10).text("Atesto que os serviços acima foram executados satisfatoriamente:", M + 2, y + 6, { lineBreak: false });
  y += 24;
  for (let i = 0; i < 3; i++) {
    doc.font("Helvetica-Bold").fontSize(10).text("Executante:", M + 6 + i * (L / 3), y, { lineBreak: false });
    doc.font("Helvetica").fontSize(9).text("Data:  ____/____/____", M + 6 + i * (L / 3), y + 40, { lineBreak: false });
    doc.font("Helvetica-Bold").text("Hora (Inicio):", M + 6 + i * (L / 3), y + 70, { lineBreak: false });
    doc.text("Hora (Fim):", M + 6 + i * (L / 3), y + 84, { lineBreak: false });
  }
}

/** PDF com as ordens pedidas, duas folhas cada (a da ordem e a de execução), na ordem dada. */
export async function gerarPdfDeOs(ordens: OsDoPdf[]): Promise<Uint8Array> {
  const doc = new PDFDocument({ size: "A4", margin: M, autoFirstPage: false, info: { Title: "Ordens de Manutenção", Producer: "SAP NetWeaver" } });
  const pedacos: Buffer[] = [];
  doc.on("data", (p: Buffer) => pedacos.push(p));
  const pronto = new Promise<void>((ok, falha) => {
    doc.on("end", ok);
    doc.on("error", falha);
  });
  for (const os of ordens) {
    doc.addPage();
    paginaDaOrdem(doc, os, 2);
    doc.addPage();
    paginaDeExecucao(doc, os, 2);
  }
  doc.end();
  await pronto;
  return new Uint8Array(Buffer.concat(pedacos));
}

/** A preventiva 4019821, como no exemplo em papel. */
export const PREVENTIVA_4019821: OsDoPdf = {
  numero: "4019821",
  dataOrdem: "02/12/2025",
  impressao: "29/12/2025",
  centroPlanejamento: "1402",
  centroPrincipal: "PROT_CAT",
  descricaoCentro: "Proteção Catódica",
  tipoAtividade: "Z02-Manutenção Preventiva",
  statusSistema: "LIB  CAPC NOAP SCDM",
  criadoPor: "IP1020251202",
  titulo: "1.2 - Inspeção Funcional de Retificador",
  local: "GUARAPARI CATOD.  RETIFIC/RETIFICADOR - GUARAPARI",
  equipamento: "10002381 - RETIFICADOR - RET-12-001",
  plano: "10573",
  item: "10603",
  inicio: "12/01/2026",
  fim: "12/01/2026",
  prioridade: "Alto",
  textoLongo: [
    "1.2 - Inspeção Funcional de Retificador",
    "Componentes monitorados semanalmente:",
    "Horímetro: registro acumulado de horas de operação.",
    "Tensão de saída (VDC): avaliação da estabilidade operacional.",
  ],
};

/** A corretiva 4023470 (com nota e endereço, sem plano). */
export const CORRETIVA_4023470: OsDoPdf = {
  numero: "4023470",
  dataOrdem: "08/10/2026",
  centroPrincipal: "SERV_ESP",
  descricaoCentro: "Serviços Especiais",
  tipoAtividade: "Z01-Manutenção Corretiva",
  statusSistema: "LIB IMPR CAPC",
  criadoPor: "RFAVARO",
  titulo: "DCV Desobstrução de caixa de valvula",
  local: "VILA VELHA/REDE VILA VELHA",
  endereco: "Rua das Palmeiras, 120, Vila Velha/ES",
  equipamento: "DCV-VV-0042",
  nota: "10006463",
  inicio: "12/10/2026",
  fim: "14/10/2026",
  prioridade: "Muito alto",
  textoLongo: ["Caixa de válvula com acúmulo de água e sedimento.", "Desobstruir, drenar e verificar o estado da válvula."],
};
