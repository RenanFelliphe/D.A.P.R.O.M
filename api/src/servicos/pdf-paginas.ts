import { chaveImagem, type DadosPdf } from "./pdf-dados";
import { dataBr, dataIsoBr, horaBr } from "./pdf-formato";
import { COR, LIMITE_Y, MARGEM, desenharImagem, escrever, faixa, linhaDeCelulas, linhaDeTabela, novoCursor, garantirEspaco, type Cursor, type Doc } from "./pdf-layout";

const RESPOSTAS: Record<string, string> = { sim: "Sim", nao: "Não", na: "NA" };
const FUNCOES: Record<string, string> = { responsavel: "Supervisor da Atividade", executor: "Executante" };

/** Cabeçalho comum: faixa com o título do documento à esquerda e o registro à direita. */
function cabecalho(c: Cursor, titulo: string, direita: string) {
  linhaDeCelulas(
    c,
    [
      { fracao: 0.2, valor: "SYNQ OS", negrito: true },
      { fracao: 0.55, valor: titulo, negrito: true },
      { fracao: 0.25, valor: direita },
    ],
    9,
  );
}

/**
 * A APR da Execução que encerrou, como o modelo em papel (a coluna "Assinatura" dos participantes só existe nos modelos que a
 * têm). Devolve o texto do rodapé.
 */
export function paginaApr(c: Cursor, d: DadosPdf): string {
  cabecalho(c, `ANÁLISE PRELIMINAR DE RISCO — ${d.modelo.codigo}\n${d.modelo.titulo}`, `Versão ${String(d.modelo.versao).padStart(2, "0")}\nData: ${dataIsoBr(d.modelo.dataDocumento)}`);

  linhaDeCelulas(c, [
    { fracao: 0.25, rotulo: "ORDEM", valor: d.os.numeroOrdem ?? "OS de apoio (sem ordem SAP)", negrito: true },
    { fracao: 0.45, rotulo: "INSTALAÇÃO / LOCAL", valor: d.local.codigo },
    { fracao: 0.15, rotulo: "DATA", valor: dataBr(d.apr.concluidaEm) },
    { fracao: 0.15, rotulo: "HORA", valor: horaBr(d.apr.concluidaEm) },
  ]);
  linhaDeCelulas(c, [{ fracao: 1, rotulo: "DESCRIÇÃO DO SERVIÇO", valor: d.os.titulo + (d.os.descricao ? `\n${d.os.descricao}` : "") }]);
  c.y += 4;

  faixa(c, "PARTICIPANTES");
  const comAssinatura = d.modelo.participantesComAssinatura;
  const lp = (comAssinatura ? [0.2, 0.4, 0.15, 0.25] : [0.25, 0.5, 0.25]).map((f) => f * c.largura);
  linhaDeTabela(
    c,
    [
      { largura: lp[0]!, texto: "Função", negrito: true },
      { largura: lp[1]!, texto: "Nome", negrito: true },
      { largura: lp[2]!, texto: "Matrícula", negrito: true },
      ...(comAssinatura ? [{ largura: lp[3]!, texto: "Assinatura", negrito: true }] : []),
    ],
    { fundo: COR.cinza },
  );
  for (const p of d.participantes) {
    const altura = comAssinatura ? 24 : 14;
    garantirEspaco(c, altura);
    const topo = c.y;
    linhaDeTabelaFixa(c, lp, [FUNCOES[p.funcao] ?? p.funcao, p.nome, p.matricula, ...(comAssinatura ? [""] : [])], altura);
    // Assinatura nula (a pessoa ainda não assinou) = célula vazia, como no papel.
    if (comAssinatura && p.assinaturaPath) {
      desenharImagem(c, d.imagens.get(chaveImagem("assinaturas", p.assinaturaPath)), MARGEM + lp[0]! + lp[1]! + lp[2]! + 3, topo + 2, lp[3]! - 6, altura - 4);
    }
  }
  c.y += 4;

  if (d.riscos.length > 0) {
    faixa(c, "RISCOS MARCADOS NA ATIVIDADE");
    const porClasse = new Map<string, string[]>();
    for (const r of d.riscos) porClasse.set(r.classificacao, [...(porClasse.get(r.classificacao) ?? []), r.nome]);
    for (const [classe, nomes] of porClasse) {
      linhaDeCelulas(c, [{ fracao: 1, rotulo: classe.toUpperCase(), valor: nomes.map((n) => `(X) ${n}`).join("     ") }], 7);
    }
    c.y += 4;
  }

  faixa(c, "ITENS DA APR");
  // Sem coluna de observação (quase sempre vazia): ela sai sob o texto do item, que fica com a largura toda e quebra menos.
  const lt = [22, c.largura - 22 - 72, 72];
  linhaDeTabela(
    c,
    [
      { largura: lt[0]!, texto: "Nº", negrito: true },
      { largura: lt[1]!, texto: "Item (e observação)", negrito: true },
      { largura: lt[2]!, texto: "Resposta", negrito: true },
    ],
    { fundo: COR.cinza, respiro: 3.5, minimo: 10 },
  );
  let numero = 0;
  let grupoAtual: string | null = null;
  let secaoAtual: string | null = null;
  for (const it of d.itens) {
    if (it.secao !== secaoAtual) {
      secaoAtual = it.secao;
      grupoAtual = null;
      linhaDeTabela(c, [{ largura: c.largura, texto: it.secao === "verificacao" ? "VERIFICAÇÃO" : "MEDIDAS PREVENTIVAS", negrito: true }], { fundo: COR.cinza, tamanho: 6.5, respiro: 3, minimo: 9 });
    }
    const grupo = it.risco ? `${it.classificacao} › ${it.risco}` : null;
    if (grupo && grupo !== grupoAtual) {
      grupoAtual = grupo;
      linhaDeTabela(c, [{ largura: c.largura, texto: grupo, negrito: true }], { tamanho: 6.5, respiro: 3, minimo: 9 });
    }
    numero++;
    const marca = it.reprovado ? " · REPROVADO" : it.alerta ? " · ALERTA" : "";
    const observacao = it.observacao?.trim();
    linhaDeTabela(
      c,
      [
        { largura: lt[0]!, texto: String(numero) },
        { largura: lt[1]!, texto: observacao ? `${it.texto}\nObs.: ${observacao}` : it.texto },
        { largura: lt[2]!, texto: `${RESPOSTAS[it.resposta] ?? it.resposta}${marca}`, negrito: it.reprovado || it.alerta },
      ],
      { fundo: it.reprovado ? COR.reprovado : it.alerta ? COR.alerta : undefined, respiro: 3, minimo: 9.5 },
    );
  }
  c.y += 4;

  if (d.apr.observacaoGeral?.trim()) {
    linhaDeCelulas(c, [{ fracao: 1, rotulo: "OBSERVAÇÃO GERAL", valor: d.apr.observacaoGeral }], 7.5);
    c.y += 4;
  }

  pae(c, d.modelo.pae);

  return `${d.modelo.codigo} · Versão ${String(d.modelo.versao).padStart(2, "0")} · Data do documento: ${dataIsoBr(d.modelo.dataDocumento)} · APR preenchida por ${d.preenchidaPor.nome} (${d.preenchidaPor.matricula})`;
}

/** Linha de tabela de altura fixa, para as células que levam imagem. */
function linhaDeTabelaFixa(c: Cursor, larguras: number[], textos: string[], altura: number) {
  let x = MARGEM;
  larguras.forEach((l, i) => {
    c.doc.lineWidth(0.4).strokeColor(COR.borda).rect(x, c.y, l, altura).stroke();
    if (textos[i]) escrever(c.doc.font("Helvetica").fontSize(7).fillColor(COR.texto), textos[i]!, x + 3, c.y + 2.5, { width: l - 6 });
    x += l;
  });
  c.y += altura;
}

interface Pae {
  titulo?: string;
  subtitulo?: string;
  fluxo?: string;
  linhas?: { rotulo: string | null; celulas: { coluna: number; texto: string }[] }[];
}

/** Bloco de contatos de emergência (PAE) do modelo: grade de rótulo mais seis colunas. */
function pae(c: Cursor, bruto: unknown) {
  const p = bruto as Pae | null;
  if (!p || typeof p !== "object") return;
  faixa(c, [p.titulo, p.subtitulo].filter(Boolean).join(" — ") || "Plano de atendimento a emergências", 7);
  if (p.fluxo) linhaDeCelulas(c, [{ fracao: 1, valor: p.fluxo }], 6.5);
  const larguraRotulo = 0.16 * c.largura;
  const largura = (c.largura - larguraRotulo) / COLUNAS_DO_PAE;
  for (const bloco of blocosDoPae(p.linhas ?? [])) {
    linhaDeTabela(
      c,
      [
        { largura: larguraRotulo, texto: bloco.rotulo, negrito: true },
        ...bloco.textos.map((t) => ({ largura, texto: t })),
      ],
      { tamanho: 5.5, respiro: 3, minimo: 9 },
    );
  }
}

const COLUNAS_DO_PAE = 6;

/**
 * As linhas do PAE agrupadas pelo rótulo: as linhas sem rótulo continuam a de cima (a cidade, o "Contato Operação:" e os
 * telefones dela viram uma célula só, linha a linha), o que poupa a borda e o respiro de cada linha da planilha.
 */
function blocosDoPae(linhas: NonNullable<Pae["linhas"]>) {
  const blocos: { rotulo: string; colunas: string[][] }[] = [];
  for (const linha of linhas) {
    if (linha.rotulo !== null || blocos.length === 0) blocos.push({ rotulo: linha.rotulo ?? "", colunas: Array.from({ length: COLUNAS_DO_PAE }, () => []) });
    const bloco = blocos[blocos.length - 1]!;
    bloco.colunas.forEach((col, i) => col.push(linha.celulas.find((x) => x.coluna === i + 1)?.texto ?? ""));
  }
  // Linhas vazias no meio mantêm o alinhamento entre as colunas; as do fim não ocupam espaço.
  return blocos.map((b) => ({ rotulo: b.rotulo, textos: b.colunas.map((col) => col.join("\n").replace(/\n+$/, "")) }));
}


// ---------------------------------------------------------------------------------------------------------------------
// A folha da OS do SAP ("Ordem de Manutenção"): 2 folhas, como o papel (a de dados da ordem e a de execução). O layout é o da
// reconstrução em `test/fixture-pdf-os.ts`. Cada parte é preenchida como a tabela do item 14 de
// `base/reunioes/correcoes-reuniao-3-resumo.md`; "Houve desvio?", "Tempo parada" e "Solicitante" ficam em branco, como no papel.
// ---------------------------------------------------------------------------------------------------------------------

const M = 34;
const L = 595.28 - 2 * M;
/** Limite inferior do conteúdo da folha do SAP. */
const FUNDO = LIMITE_Y - 22;

/** `doc.text` com altura (o texto que passa dela é cortado com reticências, e o pdfkit não abre página sozinho). */
const texto = (doc: Doc, valor: string, x: number, y: number, opcoes: PDFKit.Mixins.TextOptions) => void doc.text(valor, x, y, opcoes);

/** O que a folha precisa saber além dos dados: o dia que sai em "Data de Impr." (o da assinatura final, ou o da geração). */
export interface OpcoesDaFolha {
  impressao: Date;
}

/** Cabeçalho da folha: caixa do logo (o texto "SYNQ OS", no lugar do logotipo da empresa), número da ordem, datas e folha. */
function cabecalhoDaFolha(doc: Doc, d: DadosPdf, folha: string, opcoes: OpcoesDaFolha): number {
  doc.lineWidth(0.8).strokeColor(COR.borda).rect(M, M, L, 46).stroke();
  doc.lineWidth(0.6).rect(M + 8, M + 7, 118, 32).stroke();
  doc.font("Helvetica-Bold").fontSize(18).fillColor(COR.texto);
  escrever(doc, "SYNQ OS", M + 8, M + 14, { width: 118, align: "center", lineBreak: false });
  doc.fontSize(13);
  escrever(doc, "Ordem de Manutenção", M + 150, M + 8, { width: 200, align: "center", lineBreak: false });
  doc.fontSize(16);
  escrever(doc, d.os.numeroOrdem ?? "(sem ordem SAP)", M + 150, M + 25, { width: 200, align: "center", lineBreak: false });
  doc.font("Helvetica").fontSize(9);
  escrever(doc, `Data da Ordem:  ${dataIsoBr(d.os.dataOrdem)}`, M + 370, M + 10, { lineBreak: false });
  escrever(doc, `Data de Impr.:  ${dataBr(opcoes.impressao)}`, M + 370, M + 28, { lineBreak: false });
  escrever(doc, `Folha: ${folha}`, M + 480, M + 10, { lineBreak: false });
  return M + 56;
}

/** Linha de células "Rótulo:Valor" (rótulo em negrito, valor normal colado nele); a altura cresce se o valor não couber numa linha. */
function celulas(doc: Doc, y: number, itens: [string, string, number][]): number {
  const medidas = itens.map(([rotulo, valor, fracao]) => {
    const largura = fracao * L;
    doc.font("Helvetica-Bold").fontSize(9);
    const larguraDoRotulo = doc.widthOfString(`${rotulo}: `);
    doc.font("Helvetica").fontSize(9);
    const linhas = Math.ceil((doc.widthOfString(valor || " ") + 2) / Math.max(20, largura - larguraDoRotulo - 6));
    return { largura, larguraDoRotulo, altura: Math.max(1, linhas) * 11 + 5 };
  });
  const altura = Math.max(16, ...medidas.map((m) => m.altura));
  let x = M;
  itens.forEach(([rotulo, valor], i) => {
    const m = medidas[i]!;
    doc.lineWidth(0.6).strokeColor(COR.borda).rect(x, y, m.largura, altura).stroke();
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COR.texto);
    escrever(doc, `${rotulo}:`, x + 2, y + 4, { lineBreak: false });
    doc.font("Helvetica");
    texto(doc, valor, x + 2 + m.larguraDoRotulo, y + 4, { width: m.largura - m.larguraDoRotulo - 6, height: altura - 4, ellipsis: true });
    x += m.largura;
  });
  return y + altura;
}

/** Caixa de largura total com o texto centralizado (os títulos da folha); cresce se o texto quebrar. */
function caixaCentral(doc: Doc, y: number, texto: string, tamanho: number, alturaMinima = 20): number {
  doc.font("Helvetica-Bold").fontSize(tamanho);
  const altura = Math.max(alturaMinima, doc.heightOfString(texto || " ", { width: L - 8 }) + 8);
  doc.lineWidth(0.6).strokeColor(COR.borda).rect(M, y, L, altura).stroke();
  doc.fillColor(COR.texto);
  escrever(doc, texto, M + 4, y + (altura - doc.heightOfString(texto || " ", { width: L - 8 })) / 2, { width: L - 8, align: "center" });
  return y + altura;
}

/** Folha 1: os dados da ordem do SAP, o planejamento e a tabela de operações (com o início, o fim e o número de pessoas da execução). */
export function folhaDaOrdem(doc: Doc, d: DadosPdf, opcoes: OpcoesDaFolha) {
  const o = d.os;
  const planejada = Boolean(o.planoManutencao);
  let y = cabecalhoDaFolha(doc, d, "1/2", opcoes);
  const GAP = 6;
  y = celulas(doc, y, [["Cent.Trab", "", 0.5], ["Grup. Plan. PM", "", 0.5]]);
  y = celulas(doc, y, [["Tipo Ativ Manut", o.tipoAtividade ?? (o.tipo === "preventiva" ? "Preventiva" : "Corretiva"), 0.5], ["Empresa", "", 0.5]]);
  y = celulas(doc, y, [["Centro de trabalho principal da ordem", d.equipe.centroTrabalho, 0.5], ["Descrição do centro de trabalho", d.equipe.nome, 0.5]]);
  y = celulas(doc, y, [["Status do usuário", "", 0.5], ["Status do sistema", o.statusSap ?? "", 0.5]]);
  y = celulas(doc, y, [["Criado por", o.criadoPorSap ?? "", 0.5], ["Responsável", "", 0.5]]);
  y = caixaCentral(doc, y + GAP, o.titulo, 13, 22);
  y = caixaCentral(doc, y + GAP, "OBJETOS TÉCNICOS", 10, 18);
  y = celulas(doc, y + GAP, [["Local de Instalação", d.local.codigo, 1]]);
  if (d.local.endereco) y = celulas(doc, y, [["Endereço", d.local.endereco, 1]]);
  y = celulas(doc, y, [["Fabricante", "", 0.34], ["Modelo", "", 0.33], ["No. de serie", "", 0.33]]);
  y = celulas(doc, y + GAP, [["Equipamento", o.equipamento ?? "", 0.62], ["Fabricante", "", 0.38]]);
  y = celulas(doc, y, [["Nº peça fabric.", "", 0.34], ["Denomin.Tipo", "", 0.28], ["Nº de serie", "", 0.38]]);
  if (planejada) {
    y = celulas(doc, y + GAP, [["Plano de Manutenção", o.planoManutencao ?? "", 0.37], ["Item de Manutenção", o.itemManutencao ?? "", 0.31], ["Periodicidade", "", 0.32]]);
    y = celulas(doc, y, [["Tipo", "PM-Ordem de manutenção", 0.37], ["Dt.Enc.Ult.Ord Plan", "", 0.63]]);
  }
  y = celulas(doc, y + GAP, [["Nota", o.numeroNota ?? "", 0.34], ["Criado por", "", 0.33], ["Tipo de Nota", "", 0.33]]);
  y = celulas(doc, y, [["Data de criação", "", 0.34], ["Autor da Nota", "", 0.33], ["Parte Objeto", "", 0.33]]);
  y = caixaCentral(doc, y + GAP, "Código de Planejamento da Ordem", 10, 16);
  y = celulas(doc, y, [["Ordem planejada", planejada ? "X" : "", 0.34], ["Ordem imediata", "", 0.33], ["Ordem não planejada", planejada ? "" : "X", 0.33]]);
  y = caixaCentral(doc, y + GAP, "Planejamento de Datas da Ordem", 10, 16);
  y = celulas(doc, y, [["Data de inicio programada", dataIsoBr(o.dataInicioProg), 0.5], ["Data fim programada", o.dataFimProg ? dataIsoBr(o.dataFimProg) : "", 0.5]]);
  y = celulas(doc, y, [["Hora de Inicio", "00:00:00", 0.5], ["Hora de Fim", "00:00:00", 0.5]]);
  y = celulas(doc, y, [["Denominação da Revisão", "", 0.5], ["Prioridade", o.prioridade ?? "", 0.5]]);
  y = celulas(doc, y + GAP, [["Ordem de produção", "", 0.5], ["Tempo parada", "", 0.5]]);
  y = caixaCentral(doc, y + GAP, "HOUVE DESVIO?", 9, 16);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(COR.texto);
  escrever(doc, "Justificativa do desvio:", M + 2, y + 4, { lineBreak: false });
  y += 24;

  // Tabela de operações: a linha de cima é a do SAP (planejada); a de baixo é a que se preenchia à mão, e o SYNQ OS preenche
  // com o número de pessoas e o início e o fim da execução.
  const colunas: [string, number][] = [["Oper", 32], ["Centr.Trab", 58], ["Texto breve operação", 130], ["N Pes", 32], ["Durac.", 40], ["Data Ini", 52], ["Hora Ini", 44], ["Data Final", 52], ["Hora Final", 46], ["HH", L - 486]];
  let x = M;
  for (const [nome, largura] of colunas) {
    doc.lineWidth(0.6).strokeColor(COR.borda).rect(x, y, largura, 16).stroke();
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COR.texto);
    escrever(doc, nome, x + 2, y + 4, { width: largura - 4, lineBreak: false });
    x += largura;
  }
  y += 16;
  const planejada1 = ["0010", d.equipe.centroTrabalho, o.titulo, "0", "0.0", dataIsoBr(o.dataInicioProg), "00:00:00", o.dataFimProg ? dataIsoBr(o.dataFimProg) : dataIsoBr(o.dataInicioProg), "00:00:00", "0.0"];
  const executada = ["", "", "", String(d.principal.numeroPessoas), "", dataBr(d.inicio), horaBr(d.inicio), dataBr(d.fim), horaBr(d.fim), ""];
  for (const [linha, altura] of [[planejada1, 26], [executada, 18]] as const) {
    x = M;
    colunas.forEach(([, largura], i) => {
      doc.lineWidth(0.6).strokeColor(COR.borda).rect(x, y, largura, altura).stroke();
      doc.font("Helvetica").fontSize(8).fillColor(COR.texto);
      texto(doc, linha[i]!, x + 2, y + 4, { width: largura - 4, height: altura - 4, ellipsis: true });
      x += largura;
    });
    y += altura;
  }
  y += 10;

  // Texto longo da ordem: o que o SAP imprime sob a tabela; o que não couber na folha fica de fora (o SAP também corta).
  const longo = o.descricao?.trim();
  if (longo && y < FUNDO - 12) {
    doc.font("Helvetica").fontSize(9).fillColor(COR.texto);
    texto(doc, longo, M + 4, y, { width: L - 8, height: FUNDO - y, ellipsis: true });
  }
}

const POR_LINHA = 3;
const ALTURA_DO_EXECUTANTE = 98;
const ALTURA_DAS_ASSINATURAS = 80;
const ALTURA_DA_LINHA = 18;

/** "Hora (Inicio): 09:00": o rótulo em negrito e o valor normal, colado nele. */
function horario(doc: Doc, rotulo: string, valor: string, x: number, y: number) {
  doc.font("Helvetica-Bold").fontSize(9).fillColor(COR.texto);
  const largura = doc.widthOfString(`${rotulo} `);
  escrever(doc, rotulo, x, y, { lineBreak: false });
  doc.font("Helvetica");
  escrever(doc, valor, x + largura, y, { lineBreak: false });
}

function assinaturaNaCaixa(c: Cursor, d: DadosPdf, caminho: string | null, x: number, y: number, largura: number, altura: number) {
  if (!caminho) return; // Sem assinatura: o espaço fica em branco, como no papel.
  desenharImagem(c, d.imagens.get(chaveImagem("assinaturas", caminho)), x, y, largura, altura);
}

/**
 * Folha 2: a descrição da atividade, o atesto com um bloco por executante (nome, assinatura que ele deu na APR, data e horários
 * da execução; os que passam de 3 seguem em novas linhas de blocos iguais) e as assinaturas do responsável, do supervisor e a
 * do solicitante, esta em branco.
 */
export function folhaDaExecucao(doc: Doc, d: DadosPdf, opcoes: OpcoesDaFolha) {
  const c = novoCursor(doc);
  const folha = () => cabecalhoDaFolha(doc, d, "2/2", opcoes);
  let y = folha();

  doc.font("Helvetica-Bold").fontSize(10).fillColor(COR.texto);
  escrever(doc, "Descrição da atividade:", M + 2, y, { lineBreak: false });
  y += 16;

  // Linhas pautadas: quantas couberem depois dos blocos de executante (de 6 a 20; mais de 4 linhas de blocos seguem em outra folha).
  const linhasDeBlocos = Math.max(1, Math.ceil(d.participantes.length / POR_LINHA));
  const reservado = Math.min(linhasDeBlocos, 4) * ALTURA_DO_EXECUTANTE + ALTURA_DAS_ASSINATURAS + 12 + 24;
  const pautas = Math.max(6, Math.min(20, Math.floor((FUNDO - y - reservado) / ALTURA_DA_LINHA)));
  doc.font("Helvetica").fontSize(10);
  const lineGap = Math.max(0, ALTURA_DA_LINHA - doc.currentLineHeight());
  texto(doc, d.descricao, M + 4, y + 3, { width: L - 8, height: pautas * ALTURA_DA_LINHA - 3, lineGap, ellipsis: true });
  doc.lineWidth(0.6).strokeColor(COR.borda);
  for (let i = 0; i < pautas; i++) doc.moveTo(M, y + i * ALTURA_DA_LINHA).lineTo(M + L, y + i * ALTURA_DA_LINHA).stroke();
  y += pautas * ALTURA_DA_LINHA;

  doc.font("Helvetica-Bold").fontSize(10).fillColor(COR.texto);
  escrever(doc, "Atesto que os serviços acima foram executados satisfatoriamente:", M + 2, y + 6, { lineBreak: false });
  y += 24;

  const larguraDoBloco = L / POR_LINHA;
  for (let i = 0; i < Math.max(d.participantes.length, 1); i += POR_LINHA) {
    if (y + ALTURA_DO_EXECUTANTE > FUNDO) {
      doc.addPage();
      y = folha();
    }
    for (let k = 0; k < POR_LINHA; k++) {
      const p = d.participantes[i + k];
      const x = M + 6 + k * larguraDoBloco;
      doc.font("Helvetica-Bold").fontSize(10).fillColor(COR.texto);
      escrever(doc, "Executante:", x, y, { lineBreak: false });
      if (!p) {
        // Bloco sem executante (a folha sempre tem 3): só os rótulos, como no papel.
        doc.font("Helvetica").fontSize(9);
        escrever(doc, "Data:  ____/____/____", x, y + 58, { lineBreak: false });
        doc.font("Helvetica-Bold");
        escrever(doc, "Hora (Inicio):", x, y + 72, { lineBreak: false });
        escrever(doc, "Hora (Fim):", x, y + 84, { lineBreak: false });
        continue;
      }
      doc.font("Helvetica").fontSize(9);
      texto(doc, p.nome, x, y + 13, { width: larguraDoBloco - 14, height: 11, ellipsis: true });
      assinaturaNaCaixa(c, d, p.assinaturaPath, x, y + 25, larguraDoBloco - 20, 30);
      doc.font("Helvetica").fontSize(9);
      escrever(doc, `Data:  ${dataBr(p.assinadaEm ?? d.inicio)}`, x, y + 58, { lineBreak: false });
      horario(doc, "Hora (Inicio):", horaBr(d.inicio), x, y + 72);
      horario(doc, "Hora (Fim):", horaBr(d.fim), x, y + 84);
    }
    y += ALTURA_DO_EXECUTANTE;
  }

  // Responsável - Manutenção, Supervisor e Solicitante da Manutenção (este em branco).
  if (y + ALTURA_DAS_ASSINATURAS + 6 > FUNDO) {
    doc.addPage();
    y = folha();
  }
  y += 6;
  const caixas = [
    { titulo: "Responsável - Manutenção", quem: d.responsavel },
    { titulo: "Supervisor", quem: d.ciencia },
    { titulo: "Solicitante da Manutenção", quem: null },
  ];
  caixas.forEach(({ titulo, quem }, k) => {
    const x = M + k * larguraDoBloco;
    doc.lineWidth(0.6).strokeColor(COR.borda).rect(x, y, larguraDoBloco, ALTURA_DAS_ASSINATURAS).stroke();
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COR.texto);
    escrever(doc, titulo, x + 4, y + 4, { width: larguraDoBloco - 8, lineBreak: false });
    if (!quem) return;
    assinaturaNaCaixa(c, d, quem.assinaturaPath, x + 6, y + 17, larguraDoBloco - 12, 34);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COR.texto);
    texto(doc, quem.nome, x + 4, y + 55, { width: larguraDoBloco - 8, height: 10, ellipsis: true });
    doc.font("Helvetica").fontSize(8);
    escrever(doc, `Data: ${dataBr(quem.em)}`, x + 4, y + 66, { lineBreak: false });
  });
}
