/**
 * Lê as planilhas de `base/apr-examples/` e gera `modelos-apr.json`: os 8 modelos de APR (itens de verificação,
 * riscos e medidas, PAE, versão e data do documento) e a tabela de atividades. Rodar com `pnpm db:gerar-seed`.
 *
 * O JSON é commitado e revisado como dado; o carregador (`carregar.ts`) só lê ele. Rode de novo
 * quando as planilhas mudarem e confira o diff.
 *
 * As planilhas não dizem qual resposta bloqueia: isso é decisão da Segurança do Trabalho, por item, no editor de
 * modelos. `criterioProvisorio` abaixo é só o ponto de partida da carga, e é o único lugar a mudar.
 */
import ExcelJS from "exceljs";
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(import.meta.dirname, "..", "..", "..", "..");
const PASTA_PLANILHAS = join(RAIZ, "base", "apr-examples");
const SAIDA = join(import.meta.dirname, "modelos-apr.json");

const avisos = [];

const limpar = (s) =>
  String(s)
    .replace(/[\u0000-\u0008\u000b-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Texto de uma célula; as células cobertas por uma mesclagem (que repetem o texto da principal) valem vazio. */
function texto(celula) {
  if (celula.isMerged && celula.master.address !== celula.address) return "";
  let v = celula.value;
  if (v && typeof v === "object") v = v.richText ? v.richText.map((r) => r.text).join("") : (v.result ?? v.text ?? "");
  if (v === null || v === undefined) return "";
  return typeof v === "string" ? limpar(v) : String(v);
}

/** Todas as células com texto da planilha: `{ linha, coluna, texto }`, na ordem de leitura. */
function celulasDe(ws) {
  const todas = [];
  ws.eachRow({ includeEmpty: false }, (row, linha) =>
    row.eachCell({ includeEmpty: false }, (c, coluna) => {
      const t = texto(c);
      if (t) todas.push({ linha, coluna, texto: t });
    }),
  );
  return todas;
}

/** Critério de bloqueio da carga inicial. Provisório: a Segurança do Trabalho redefine cada item no editor. */
function criterioProvisorio(secao, textoItem) {
  const evidencia = /psicol[oó]gic/i.test(textoItem) ? "texto" : "foto";
  if (secao === "medida_preventiva") return { tipo: "alerta", respostaBloqueante: null, evidencia };
  if (/ilumina[cç][aã]o auxiliar/i.test(textoItem)) return { tipo: "alerta", respostaBloqueante: "sim", evidencia };
  if (/impedimento/i.test(textoItem)) return { tipo: "eliminatorio", respostaBloqueante: "sim", evidencia };
  return { tipo: "eliminatorio", respostaBloqueante: "nao", evidencia };
}

/** Une os pedaços do nome de um risco, que a planilha reparte em linhas (às vezes é um nome só, às vezes vários). */
function juntarNome(pedacos) {
  return pedacos
    .map((p) => p.replace(/;$/, "").trim())
    .reduce((acc, p) => (acc === "" ? p : /^[/a-zà-ú]/.test(p) ? `${acc} ${p}` : `${acc}; ${p}`), "");
}

function lerModelo(arquivo, wb) {
  const ws = wb.worksheets.find((w) => w.state === "visible");
  const cel = celulasDe(ws);
  const achar = (re) => cel.find((c) => re.test(c.texto));

  const codigo = /^(APR \d+)/.exec(arquivo)?.[1];
  if (!codigo) throw new Error(`${arquivo}: código do modelo não identificado`);

  const versaoData = cel.map((c) => /VERS[ÃA]O\s*(\d+)\s*DATA:\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(c.texto)).find(Boolean);
  if (!versaoData) throw new Error(`${arquivo}: versão e data do documento não encontradas`);
  const versao = Number(versaoData[1]);
  const dataDocumento = `${versaoData[4]}-${versaoData[3]}-${versaoData[2]}`;

  // Título: o que vem depois de "APR NN" no cabeçalho; senão a "Descrição do serviço"; senão o fim do nome do arquivo.
  const cabecalho = achar(/ANALISE PRELIMINAR DE RISCO/i)?.texto ?? "";
  let titulo = limpar(cabecalho.replace(/ANALISE PRELIMINAR DE RISCO/i, "").replace(/APR \d+/i, "").replace(/^[\s-]+/, ""));
  if (!titulo) titulo = limpar(achar(/^Descrição do serviço:\s*\S/i)?.texto.replace(/^Descrição do serviço:/i, "") ?? "");
  if (!titulo) titulo = limpar(arquivo.replace(/\.xlsx.*$/i, "").split(" - ").at(-1));

  // Âncoras da planilha. As colunas mudam de um arquivo para outro (A ou B, com ou sem a coluna NA), então tudo
  // é localizado pelo texto dos cabeçalhos.
  const verif = achar(/^Itens de Verificação$/);
  const classif = achar(/^Classificação$/);
  const riscos = cel.find((c) => c.texto === "Riscos" && c.linha === classif?.linha);
  const medidas = cel.find((c) => /^Medidas Preventivas Recomendadas$/.test(c.texto));
  const obs = achar(/^Caso necessário, descreva/);
  const pae = achar(/^Plano de atendimento a Emerg/);
  if (!verif || !classif || !riscos || !medidas || !obs || !pae) throw new Error(`${arquivo}: estrutura da planilha não reconhecida`);

  // A folha de participantes tem a coluna "Assinatura" (APR 04, 05 e 06) ou só nome e matrícula (as demais): o PDF da OS a reproduz.
  const cabecalhoDosParticipantes = cel.find((c) => c.texto === "Ord.");
  const participantesComAssinatura = cabecalhoDosParticipantes ? cel.some((c) => c.linha === cabecalhoDosParticipantes.linha && /^Assinatura$/i.test(c.texto)) : true;

  const temNa = (linha) => cel.some((c) => c.linha === linha && c.texto === "NA");
  const naVerificacao = temNa(verif.linha);
  const naMedidas = temNa(classif.linha);

  const itens = [];
  const listaRiscos = [];
  let ordem = 0;
  const novoItem = (secao, textoItem, risco, permiteNa) => {
    ordem += 1;
    itens.push({ secao, ordem, texto: textoItem, ...criterioProvisorio(secao, textoItem), permiteNa, risco });
  };

  // Itens de verificação: o texto fica na coluna ao lado do número.
  for (const c of cel) {
    if (c.linha > verif.linha && c.linha < classif.linha && c.coluna === verif.coluna + 1) {
      novoItem("verificacao", c.texto, null, naVerificacao || /teste de explosividade/i.test(c.texto));
    }
  }
  if (itens.length === 0) throw new Error(`${arquivo}: nenhum item de verificação`);

  // Medidas preventivas: Classificação → Risco ("( )" marca o começo do risco; o nome vem nas linhas dele) → Medida.
  let classificacao = "";
  let risco = null;
  const linhasMedidas = [...new Set(cel.filter((c) => c.linha > classif.linha && c.linha < obs.linha).map((c) => c.linha))];
  for (const linha of linhasMedidas) {
    const naLinha = (coluna) => cel.find((c) => c.linha === linha && c.coluna === coluna)?.texto;
    classificacao = naLinha(classif.coluna)?.replace(/;$/, "") ?? classificacao;
    if (naLinha(riscos.coluna)?.startsWith("(")) {
      risco = { classificacao, pedacos: [], medidas: [] };
      listaRiscos.push(risco);
    }
    const nome = naLinha(riscos.coluna + 1);
    const medida = naLinha(medidas.coluna);
    if (!risco) {
      if (nome || medida) throw new Error(`${arquivo}: linha ${linha} tem medida ou risco antes do primeiro risco marcado`);
      continue;
    }
    if (nome) risco.pedacos.push(nome);
    if (medida) risco.medidas.push(medida);
  }
  const riscosDoModelo = listaRiscos.map((r, i) => {
    const nome = juntarNome(r.pedacos);
    if (!nome || r.medidas.length === 0) throw new Error(`${arquivo}: risco ${i + 1} sem nome ou sem medidas`);
    return { classificacao: r.classificacao, nome, ordem: i + 1, medidas: r.medidas };
  });
  for (const r of riscosDoModelo) for (const m of r.medidas) novoItem("medida_preventiva", m, r.ordem, naMedidas);

  // PAE: título, subtítulo, fluxo e as linhas de contatos, com a coluna de cada célula (a grade não é regular).
  const abaixoDoPae = cel.filter((c) => c.linha >= pae.linha);
  const [tituloPae, subtituloPae, fluxoPae] = [0, 1, 2].map((i) => abaixoDoPae.filter((c) => c.linha === pae.linha + i)[0]?.texto);
  const linhasPae = [];
  for (const linha of [...new Set(abaixoDoPae.filter((c) => c.linha > pae.linha + 2).map((c) => c.linha))]) {
    const doLado = abaixoDoPae.filter((c) => c.linha === linha);
    const rotulo = doLado.find((c) => c.coluna === pae.coluna)?.texto ?? null;
    const celulas = doLado.filter((c) => c.coluna > pae.coluna).map((c) => ({ coluna: c.coluna - pae.coluna, texto: c.texto }));
    linhasPae.push({ rotulo, celulas });
  }

  // Textos da planilha que o schema não guarda.
  for (const c of cel) {
    if (c.linha > verif.linha - 20 && /^Instruções importantes para a atividade$/.test(c.texto)) {
      const regras = cel.filter((x) => x.linha > c.linha && x.linha < c.linha + 4 && x.coluna === c.coluna && !/^Ord\.$/.test(x.texto));
      avisos.push(`${codigo}: "Instruções importantes para a atividade" (${regras.length} regra(s) no papel) não tem onde ficar no modelo`);
    }
  }

  return {
    modelo: {
      codigo,
      versao,
      dataDocumento,
      titulo,
      participantesComAssinatura,
      pae: { titulo: tituloPae, subtitulo: subtituloPae, fluxo: fluxoPae, linhas: linhasPae },
      riscos: riscosDoModelo.map(({ medidas: _, ...r }) => r),
      itens,
    },
    planoSap: listaSapBruta(ws, verif.linha, cel.some((c) => /^Plano de manutenção e operação/.test(c.texto))),
  };
}

/**
 * O campo "Plano de manutenção e operação (SAP)": uma ou duas células grandes com uma atividade por linha
 * (a quebra de linha dentro da célula é o separador). Sem o rótulo do campo (APR 04 e 05), o texto é uma
 * descrição do escopo e não entra; a APR 06 não tem o rótulo, mas a lista começa por um código.
 */
function listaSapBruta(ws, linhaDosItens, temRotulo) {
  const linhas = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n >= linhaDosItens) return;
    row.eachCell({ includeEmpty: false }, (c) => {
      if (c.isMerged && c.master.address !== c.address) return;
      const v = typeof c.value === "string" ? c.value : "";
      const comecaPorCodigo = /^\s*(\d+\.\d+|PMP |CLB)/.test(v);
      if (!v.includes("\n") || /^\s*(Plano de|Relação|Instru|\d[º°] )/.test(v) || !(temRotulo || comecaPorCodigo)) return;
      linhas.push(...v.split("\n").map(limpar).filter(Boolean));
    });
  });
  return linhas;
}

const CODIGO_SAP = /^((?:PMP\s+)?\d+(?:\.\d+)+(?:\s*\/\s*\d+(?:\.\d+)+)*)\s*[-–]\s*(.+)$/;

/** Uma linha do campo "Plano de manutenção e operação (SAP)" vira uma ou mais atividades. */
function atividadesDaLinha(linha, modeloAprCodigo) {
  const t = limpar(linha).replace(/[;.]$/, "");
  const m = CODIGO_SAP.exec(t);
  if (!m) return [{ codigo: t, descricao: t, modeloAprCodigo, origem: "plano SAP, sem código" }];
  return m[1].split("/").map((c) => ({ codigo: limpar(c), descricao: m[2], modeloAprCodigo, origem: "plano SAP" }));
}

/** A aba oculta (tabela dinâmica) lista as atividades da ES Gás por APR; "NÃO APLICÁVEL" não tem modelo. */
function atividadesDaTabelaDinamica(wb) {
  const aba = wb.worksheets.find((w) => w.state === "hidden" && w.getCell("A3").value === "Rótulos de Linha");
  if (!aba) throw new Error("tabela dinâmica 'Rótulos de Linha' não encontrada");
  const atividades = [];
  let modeloAprCodigo = null;
  aba.eachRow((row, n) => {
    if (n <= 3) return;
    const c = row.getCell(1);
    const t = limpar(c.value ?? "");
    if (!t || t === "Total Geral") return;
    if ((c.alignment?.indent ?? 0) === 0) {
      modeloAprCodigo = /^(APR \d+)/.exec(t)?.[1] ?? null;
      return;
    }
    const descricao = t.replace(/[;.]$/, "");
    atividades.push({ codigo: descricao, descricao, modeloAprCodigo, origem: "tabela dinâmica" });
  });
  return atividades;
}

// ---

const arquivos = readdirSync(PASTA_PLANILHAS).filter((f) => /^APR \d+.*\.xlsx/.test(f)).sort();
const modelos = [];
let atividadesBrutas = [];
let tabelaDinamica = null;

for (const arquivo of arquivos) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(join(PASTA_PLANILHAS, arquivo));
  const { modelo, planoSap } = lerModelo(arquivo, wb);
  modelos.push(modelo);
  for (const linha of planoSap) atividadesBrutas.push(...atividadesDaLinha(linha, modelo.codigo));
  const doArquivo = JSON.stringify(atividadesDaTabelaDinamica(wb));
  tabelaDinamica ??= doArquivo;
  if (doArquivo !== tabelaDinamica) avisos.push(`${arquivo}: a tabela dinâmica difere da dos outros arquivos`);
}
atividadesBrutas = [...JSON.parse(tabelaDinamica), ...atividadesBrutas];

// A atividade é única pelo código. Quando a mesma aparece em mais de um modelo (as APR 06 reaproveitam as listas
// das APR 02 e 03, por exemplo), vale o primeiro, na ordem das APR; os outros ficam no aviso (questão 3).
const atividades = new Map();
for (const a of atividadesBrutas) {
  const ja = atividades.get(a.codigo);
  if (!ja) atividades.set(a.codigo, { ...a, tambemEm: [] });
  else if (a.modeloAprCodigo && a.modeloAprCodigo !== ja.modeloAprCodigo) {
    if (ja.modeloAprCodigo === null) Object.assign(ja, { modeloAprCodigo: a.modeloAprCodigo });
    else if (!ja.tambemEm.includes(a.modeloAprCodigo)) ja.tambemEm.push(a.modeloAprCodigo);
  }
}
const repetidas = new Map();
for (const a of atividades.values()) {
  for (const outro of a.tambemEm) {
    const chave = `${outro} repete atividades de ${a.modeloAprCodigo}`;
    repetidas.set(chave, [...(repetidas.get(chave) ?? []), a.codigo]);
  }
}
for (const [chave, codigos] of repetidas) avisos.push(`${chave} (ficam no primeiro): ${codigos.join(", ")}`);

const saida = {
  gerado_de: "base/apr-examples",
  criterio_de_bloqueio: "provisório: ponto de partida; a Segurança do Trabalho define por item no editor de modelos",
  modelos,
  atividades: [...atividades.values()].map(({ tambemEm: _, ...a }) => ({ ...a, provisorio: true })),
};
writeFileSync(SAIDA, JSON.stringify(saida, null, 2) + "\n");

for (const m of modelos) {
  const n = (s) => m.itens.filter((i) => i.secao === s).length;
  console.log(
    `${m.codigo}  v${m.versao}  ${m.dataDocumento}  ${m.titulo.slice(0, 48).padEnd(48)}  verificação ${String(n("verificacao")).padStart(2)}  riscos ${String(m.riscos.length).padStart(2)}  medidas ${String(n("medida_preventiva")).padStart(3)}  NA ${m.itens.filter((i) => i.permiteNa).length}`,
  );
}
console.log(`\natividades: ${saida.atividades.length} (${saida.atividades.filter((a) => !a.modeloAprCodigo).length} sem modelo)`);
for (const a of avisos) console.log("aviso:", a);
