import { chaveImagem, type DadosPdf } from "./pdf-dados";
import { dataBr, dataHoraBr, dataIsoBr, duracao, horaBr } from "./pdf-formato";
import { COR, MARGEM, desenharImagem, escrever, faixa, garantirEspaco, linhaDeCelulas, linhaDeTabela, type Cursor } from "./pdf-layout";

const RESPOSTAS: Record<string, string> = { sim: "Sim", nao: "Não", na: "NA" };
const FUNCOES: Record<string, string> = { responsavel: "Supervisor da Atividade", executor: "Executante" };
const STATUS: Record<string, string> = {
  liberada: "Liberada",
  pendente: "Pendente",
  em_execucao: "Em execução",
  encerrada: "Encerrada",
  cancelada: "Cancelada",
};
const MOTIVOS_PAUSA: Record<string, string> = { almoco: "almoço", descanso: "descanso", outro: "outro" };

/** Cabeçalho comum: faixa com o título do documento à esquerda e o registro à direita. */
function cabecalho(c: Cursor, titulo: string, direita: string) {
  linhaDeCelulas(
    c,
    [
      { fracao: 0.2, valor: "D.A.P.R.O.M", negrito: true },
      { fracao: 0.55, valor: titulo, negrito: true },
      { fracao: 0.25, valor: direita },
    ],
    9,
  );
}

/** Página 1: a APR da Execução que encerrou, como o papel. Devolve o texto do rodapé. */
export function paginaApr(c: Cursor, d: DadosPdf): string {
  const aprovada = d.apr.resultado === "aprovada";
  cabecalho(c, `ANÁLISE PRELIMINAR DE RISCO — ${d.modelo.codigo}\n${d.modelo.titulo}`, `Versão ${String(d.modelo.versao).padStart(2, "0")}\nData: ${dataIsoBr(d.modelo.dataDocumento)}`);

  linhaDeCelulas(c, [
    { fracao: 0.25, rotulo: "ORDEM", valor: d.os.numeroOrdem ?? "OS de apoio (sem ordem SAP)", negrito: true },
    { fracao: 0.45, rotulo: "INSTALAÇÃO / LOCAL", valor: d.local.codigo },
    { fracao: 0.15, rotulo: "DATA", valor: dataBr(d.apr.concluidaEm) },
    { fracao: 0.15, rotulo: "HORA", valor: horaBr(d.apr.concluidaEm) },
  ]);
  linhaDeCelulas(c, [
    { fracao: 0.75, rotulo: "DESCRIÇÃO DO SERVIÇO", valor: d.os.titulo + (d.os.descricao ? `\n${d.os.descricao}` : "") },
    { fracao: 0.25, rotulo: "RESULTADO DA APR", valor: aprovada ? "APROVADA" : "BLOQUEADA", negrito: true },
  ]);
  c.y += 4;

  faixa(c, "PARTICIPANTES");
  const lp = [0.2, 0.4, 0.15, 0.25].map((f) => f * c.largura);
  linhaDeTabela(
    c,
    [
      { largura: lp[0]!, texto: "Função", negrito: true },
      { largura: lp[1]!, texto: "Nome", negrito: true },
      { largura: lp[2]!, texto: "Matrícula", negrito: true },
      { largura: lp[3]!, texto: "Assinatura", negrito: true },
    ],
    { fundo: COR.cinza },
  );
  for (const p of d.participantes) {
    const altura = 24;
    garantirEspaco(c, altura);
    const topo = c.y;
    linhaDeTabelaFixa(c, [lp[0]!, lp[1]!, lp[2]!, lp[3]!], [FUNCOES[p.funcao] ?? p.funcao, p.nome, p.matricula, ""], altura);
    desenharImagem(c, d.imagens.get(chaveImagem("assinaturas", p.assinaturaPath)), MARGEM + lp[0]! + lp[1]! + lp[2]! + 3, topo + 2, lp[3]! - 6, altura - 4);
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

const caixaAssinatura = 3;

interface Assinante {
  titulo: string;
  nome: string;
  detalhe: string;
  caminho: string | null;
  quando: Date | null;
}

/** Linhas de caixas de assinatura (imagem, nome, cargo/registro e data), três por linha. */
function assinaturas(c: Cursor, d: DadosPdf, lista: Assinante[]) {
  const l = c.largura / caixaAssinatura;
  const altura = 74;
  for (let i = 0; i < lista.length; i += caixaAssinatura) {
    garantirEspaco(c, altura);
    lista.slice(i, i + caixaAssinatura).forEach((a, k) => {
      const x = MARGEM + k * l;
      c.doc.lineWidth(0.5).strokeColor(COR.borda).rect(x, c.y, l, altura).stroke();
      escrever(c.doc.font("Helvetica").fontSize(5.5).fillColor(COR.rotulo), a.titulo.toUpperCase(), x + 3, c.y + 2, { width: l - 6, lineBreak: false });
      desenharImagem(c, a.caminho ? d.imagens.get(chaveImagem("assinaturas", a.caminho)) : null, x + 4, c.y + 10, l - 8, 34);
      escrever(c.doc.font("Helvetica-Bold").fontSize(7.5).fillColor(COR.texto), a.nome, x + 3, c.y + 47, { width: l - 6, lineBreak: false });
      escrever(c.doc.font("Helvetica").fontSize(6).fillColor(COR.texto), a.detalhe, x + 3, c.y + 57, { width: l - 6, lineBreak: false });
      if (a.quando) escrever(c.doc.font("Helvetica").fontSize(6).fillColor(COR.rotulo), `Data: ${dataHoraBr(a.quando)}`, x + 3, c.y + 65, { width: l - 6, lineBreak: false });
    });
    c.y += altura;
  }
}

const cargoERegistro = (u: { cargo: string | null; registro: string | null; matricula?: string }) =>
  [u.cargo, u.registro ? `CREA ${u.registro}` : null, u.matricula ? `Mat. ${u.matricula}` : null].filter(Boolean).join(" · ");

/** Página 2: a ordem, a execução, as assinaturas e as fotos. Devolve o texto do rodapé. */
export function paginaOs(c: Cursor, d: DadosPdf, geradoEm: Date): string {
  const o = d.os;
  cabecalho(c, `ORDEM DE MANUTENÇÃO Nº ${o.numeroOrdem ?? "(sem ordem SAP)"}`, `Data da ordem: ${dataIsoBr(o.dataOrdem)}\nRegistro digital: ${dataHoraBr(geradoEm)}`);

  linhaDeCelulas(c, [
    { fracao: 0.25, rotulo: "CENTRO DE TRABALHO", valor: `${d.equipe.centroTrabalho} (${d.equipe.nome})` },
    { fracao: 0.25, rotulo: "TIPO DE ATIVIDADE", valor: o.tipoAtividade ?? (o.tipo === "preventiva" ? "Preventiva" : "Corretiva") },
    { fracao: 0.25, rotulo: "STATUS", valor: `${STATUS[o.status] ?? o.status}${o.statusSap ? ` (SAP: ${o.statusSap})` : ""}` },
    { fracao: 0.25, rotulo: "CRIADO POR", valor: o.criadoPorSap ?? "—" },
  ]);
  linhaDeCelulas(c, [
    { fracao: 0.5, rotulo: "LOCAL DE INSTALAÇÃO", valor: d.local.codigo + (d.local.endereco ? `\n${d.local.endereco}` : "") },
    { fracao: 0.5, rotulo: "EQUIPAMENTO", valor: o.equipamento ?? "—" },
  ]);
  linhaDeCelulas(c, [
    { fracao: 0.25, rotulo: "NOTA DE MANUTENÇÃO", valor: o.numeroNota ?? "—" },
    { fracao: 0.75, rotulo: "TEXTO BREVE", valor: o.titulo + (o.descricao ? ` — ${o.descricao}` : "") },
  ]);
  linhaDeCelulas(c, [
    { fracao: 0.2, rotulo: "PRIORIDADE", valor: o.prioridade ?? "—" },
    { fracao: 0.2, rotulo: "CRITICIDADE", valor: d.local.critico ? "Crítica" : "Normal" },
    { fracao: 0.2, rotulo: "INÍCIO PROGRAMADO", valor: dataIsoBr(o.dataInicioProg) },
    { fracao: 0.2, rotulo: "FIM PROGRAMADO", valor: dataIsoBr(o.dataFimProg) },
    { fracao: 0.2, rotulo: "PLANO / ITEM", valor: [o.planoManutencao, o.itemManutencao].filter(Boolean).join(" / ") || "—" },
  ]);
  if (o.solicitante) linhaDeCelulas(c, [{ fracao: 1, rotulo: "SOLICITANTE", valor: o.solicitante }]);
  c.y += 4;

  faixa(c, "EXECUÇÃO");
  const t = d.trechoPrincipal;
  const todos = [...d.anteriores, t];
  const bruto = todos.reduce((s, x) => s + x.brutoMs, 0);
  const pausa = todos.reduce((s, x) => s + x.pausaMs, 0);
  const liquido = todos.reduce((s, x) => s + x.liquidoMs, 0);
  linhaDeCelulas(c, [
    { fracao: 0.2, rotulo: "INÍCIO", valor: dataHoraBr(t.inicio) },
    { fracao: 0.2, rotulo: "FIM", valor: dataHoraBr(t.fim) },
    { fracao: 0.2, rotulo: "TEMPO TOTAL", valor: duracao(bruto) },
    { fracao: 0.2, rotulo: "PAUSAS", valor: duracao(pausa) },
    { fracao: 0.2, rotulo: "TEMPO LÍQUIDO", valor: duracao(liquido), negrito: true },
  ]);
  const pausasTexto = t.pausas.map((p) => `${horaBr(p.inicio)}–${horaBr(p.fim)}${p.motivo ? ` (${MOTIVOS_PAUSA[p.motivo] ?? p.motivo})` : ""}`).join(";  ");
  linhaDeCelulas(c, [
    { fracao: 0.2, rotulo: "Nº DE PESSOAS", valor: String(d.principal.numeroPessoas) },
    { fracao: 0.8, rotulo: "PAUSAS DESTE TRECHO", valor: pausasTexto || "Sem pausas" },
  ]);
  if (d.anteriores.length > 0) {
    const datas = d.anteriores.map((x) => `${dataBr(x.inicio)} (${horaBr(x.inicio)}–${horaBr(x.fim)}, líquido ${duracao(x.liquidoMs)})`).join(";  ");
    linhaDeCelulas(c, [{ fracao: 1, rotulo: "TRECHOS ANTERIORES (o tempo líquido acima soma todos os trechos)", valor: datas }]);
  }
  linhaDeCelulas(c, [{ fracao: 1, rotulo: "DESCRIÇÃO DA ATIVIDADE EXECUTADA", valor: d.principal.descricaoAtividade ?? "" }], 8);
  const inspecao = d.principal.dadosInspecao;
  if (inspecao && typeof inspecao === "object" && Object.keys(inspecao).length > 0) {
    const texto = Object.entries(inspecao as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
      .join("\n");
    linhaDeCelulas(c, [{ fracao: 1, rotulo: "FORMULÁRIO DE INSPEÇÃO", valor: texto }], 7);
  }
  c.y += 4;

  faixa(c, "ASSINATURAS");
  const lista: Assinante[] = d.assinaturasExecucao.map((a) => ({
    titulo: "Executante",
    nome: a.nome,
    detalhe: cargoERegistro(a),
    caminho: a.assinaturaPath,
    quando: a.assinadaEm,
  }));
  const resp = d.participantes.find((p) => p.funcao === "responsavel");
  if (resp) {
    lista.push({ titulo: "Responsável da manutenção", nome: resp.nome, detalhe: cargoERegistro(resp), caminho: resp.assinaturaPath, quando: resp.assinadaEm });
  }
  if (d.ciencia) {
    lista.push({ titulo: "Ciência do supervisor", nome: d.ciencia.nome, detalhe: [cargoERegistro(d.ciencia), "Ciente"].filter(Boolean).join(" · "), caminho: d.ciencia.assinaturaPath, quando: d.ciencia.em });
  }
  if (lista.length === 0) linhaDeCelulas(c, [{ fracao: 1, valor: "Sem assinaturas registradas." }]);
  else assinaturas(c, d, lista);
  c.y += 4;

  if (d.fotos.length > 0) {
    faixa(c, "FOTOS");
    const colunas = 3;
    const l = c.largura / colunas;
    const altura = 112;
    for (let i = 0; i < d.fotos.length; i += colunas) {
      garantirEspaco(c, altura);
      d.fotos.slice(i, i + colunas).forEach((f, k) => {
        const x = MARGEM + k * l;
        c.doc.lineWidth(0.5).strokeColor(COR.borda).rect(x, c.y, l, altura).stroke();
        desenharImagem(c, d.imagens.get(chaveImagem("fotos", f.fotoPath)), x + 3, c.y + 3, l - 6, altura - 22);
        const posicao = f.latitude !== null && f.longitude !== null ? `Posição: ${f.latitude.toFixed(6)}, ${f.longitude.toFixed(6)}` : "Posição: não informada";
        escrever(c.doc.font("Helvetica").fontSize(6).fillColor(COR.texto), `${dataBr(f.capturadaEm)} ${horaBr(f.capturadaEm)}`, x + 3, c.y + altura - 17, { width: l - 6, lineBreak: false });
        escrever(c.doc, posicao, x + 3, c.y + altura - 9, { width: l - 6, lineBreak: false });
      });
      c.y += altura;
    }
  }

  return `OS ${o.numeroOrdem ?? o.id} · registro digital gerado em ${dataHoraBr(geradoEm)} (horário de Brasília)`;
}
