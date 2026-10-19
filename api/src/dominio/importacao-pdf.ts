import type { PaginaDeTexto } from "../servicos/pdf-texto";

/**
 * Leitura do PDF da "Ordem de Manutenção" impressa pelo SAP (o layout das OS 4019821 e 4023470 em `base/os-examples`), para
 * a Importação de OS. O PDF traz cada campo como "Rótulo:Valor" nas tabelas da folha; aqui os rótulos viram os campos do
 * contrato do SAP (`OrdemSap`), os mesmos da leitura pela API e da planilha. Este mapeamento é o ponto de ajuste se o
 * formulário do SAP mudar.
 *
 *   campo da ordem            rótulo impresso (maiúsculas, acentos e pontuação não importam)
 *   numero_ordem *            o número sob "Ordem de Manutenção", no cabeçalho de cada folha (ou "Nº da ordem:")
 *   criada_em                 Data da Ordem
 *   tipo_ordem *              Tipo de ordem (YBA1/YBA2); sem ele, Tipo Ativ Manut (Z01 corretiva, Z02 preventiva)
 *   tipo_atividade            Tipo Ativ Manut | Tipo de atividade
 *   centro_trabalho *         Centro de trabalho principal da ordem (sem ele, o centro da primeira operação)
 *   status_sap                Status do sistema (sem ele, a OS vale como liberada, como na planilha sem a coluna)
 *   criado_por                Criado por (o do cabeçalho; o da nota fica de fora)
 *   titulo *                  a linha em destaque logo acima de "OBJETOS TÉCNICOS" (sem ela, o texto da primeira operação)
 *   local_instalacao.codigo * Local de Instalação
 *   local_instalacao.endereco Endereço
 *   equipamento               Equipamento
 *   plano_manutencao          Plano de Manutenção
 *   item_manutencao           Item de Manutenção
 *   intervalo_ciclo           Periodicidade (o intervalo entre ciclos da preventiva, quando o SAP o imprime)
 *   numero_nota               Nota
 *   data_inicio_prog *        Data de inicio programada
 *   data_fim_prog             Data fim programada
 *   prioridade                Prioridade
 *   solicitante               Solicitante
 *   descricao                 o texto longo, depois da tabela de operações e antes da folha de execução
 *
 * (* = obrigatório para a OS entrar; o que o PDF não trouxer volta em `faltando` e a conferência na tela preenche). Um PDF
 * pode trazer várias OS: as folhas seguidas com o mesmo número de ordem no cabeçalho são uma OS só.
 */

export interface LocalLido {
  codigo: string | null;
  endereco: string | null;
  plus_code: string | null;
  cliente: string | null;
}

/** A OS como o PDF a traz, no formato do contrato do SAP; `null` no que o PDF não tem. */
export interface OrdemLidaDoPdf {
  numero_ordem: string;
  numero_nota: string | null;
  tipo_ordem: "YBA1" | "YBA2" | null;
  tipo_atividade: string | null;
  codigo_atividade: string | null;
  titulo: string | null;
  descricao: string | null;
  centro_trabalho: string | null;
  local_instalacao: LocalLido;
  equipamento: string | null;
  prioridade: string | null;
  data_inicio_prog: string | null;
  data_fim_prog: string | null;
  status_sap: string | null;
  solicitante: string | null;
  criado_por: string | null;
  criada_em: string | null;
  plano_manutencao: string | null;
  item_manutencao: string | null;
  /** A periodicidade impressa ("3 MES", "Trimestral"), como texto; a conferência mostra o intervalo entendido. */
  intervalo_ciclo: string | null;
}

export const CAMPOS_OBRIGATORIOS = ["tipo_ordem", "titulo", "centro_trabalho", "local_instalacao", "data_inicio_prog"] as const;
export type CampoObrigatorio = (typeof CAMPOS_OBRIGATORIOS)[number];

export interface OsDoPdf {
  /** Folhas do PDF em que a OS está (a partir de 1). */
  paginas: number[];
  ordem: OrdemLidaDoPdf;
  /** Obrigatórios que o PDF não trouxe: precisam ser preenchidos na conferência. */
  faltando: CampoObrigatorio[];
  /** O que foi deduzido, e não lido, e merece a atenção de quem confere. */
  observacoes: string[];
}

export interface LeituraDoPdf {
  ordens: OsDoPdf[];
  /** Folhas sem número de ordem antes da primeira OS (capa, folha em branco). */
  paginasSemOrdem: number[];
}

/** Rótulos impressos, já normalizados (sem acento, minúsculas); vários nomes para o mesmo campo. */
const ROTULOS: Record<string, string[]> = {
  numero_ordem: ["no. da ordem", "no da ordem", "n. da ordem", "numero da ordem", "ordem"],
  criada_em: ["data da ordem"],
  impressao: ["data de impr.", "data de impr", "data de impressao"],
  folha: ["folha"],
  centro_planejamento: ["cent.trab", "cent. trab", "cent.trab."],
  grupo: ["grup. plan. pm", "grup.plan.pm", "grup. plan.pm"],
  tipo_atividade: ["tipo ativ manut", "tipo ativ. manut", "tipo ativ. manut.", "tipo de atividade", "tipo atividade"],
  empresa: ["empresa"],
  centro_trabalho: ["centro de trabalho principal da ordem", "centro de trabalho principal", "centro de trabalho"],
  descricao_centro: ["descricao do centro de trabalho"],
  status_usuario: ["status do usuario"],
  status_sap: ["status do sistema", "status sistema"],
  criado_por: ["criado por"],
  responsavel: ["responsavel"],
  local: ["local de instalacao", "local instalacao"],
  endereco: ["endereco do local", "endereco"],
  plus_code: ["plus code", "pluscode"],
  cliente: ["cliente"],
  fabricante: ["fabricante"],
  modelo: ["modelo"],
  serie: ["no. de serie", "no de serie", "n. de serie", "n de serie", "numero de serie"],
  peca: ["no peca fabric.", "no. peca fabric.", "n peca fabric."],
  denominacao_tipo: ["denomin.tipo", "denomin. tipo", "denominacao tipo"],
  equipamento: ["equipamento"],
  plano_manutencao: ["plano de manutencao"],
  item_manutencao: ["item de manutencao"],
  periodicidade: ["periodicidade"],
  tipo_plano: ["tipo"],
  ultima_ordem: ["dt.enc.ult.ord plan", "dt. enc. ult. ord. plan"],
  numero_nota: ["no. nota", "no nota", "numero da nota", "nota"],
  tipo_nota: ["tipo de nota"],
  data_criacao: ["data de criacao"],
  autor_nota: ["autor da nota"],
  parte_objeto: ["parte objeto"],
  ordem_planejada: ["ordem planejada"],
  ordem_imediata: ["ordem imediata"],
  ordem_nao_planejada: ["ordem nao planejada"],
  data_inicio_prog: ["data de inicio programada", "data inicio programada", "inicio programado"],
  data_fim_prog: ["data de fim programada", "data fim programada", "fim programado"],
  hora_inicio: ["hora de inicio"],
  hora_fim: ["hora de fim"],
  revisao: ["denominacao da revisao"],
  prioridade: ["prioridade"],
  ordem_producao: ["ordem de producao"],
  tempo_parada: ["tempo parada"],
  justificativa: ["justificativa do desvio"],
  solicitante: ["solicitante"],
  tipo_ordem: ["tipo de ordem", "tipo da ordem", "tipo ordem"],
};

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const CAMPO_DO_ROTULO = new Map<string, string>();
for (const [campo, nomes] of Object.entries(ROTULOS)) for (const nome of nomes) CAMPO_DO_ROTULO.set(nome, campo);
// Os nomes mais longos primeiro: "tipo de nota" antes de "tipo", "data da ordem" antes de "ordem".
const ALTERNATIVAS = [...CAMPO_DO_ROTULO.keys()].sort((a, b) => b.length - a.length).map(escapar).join("|");
const rotulosDaLinha = () => new RegExp(`(?<![a-z])(${ALTERNATIVAS})\\s*:`, "g");

/**
 * Texto sem acento e em minúsculas, com o mesmo comprimento do original (um caractere por caractere), para achar o rótulo
 * no texto normalizado e recortar o valor do texto original.
 */
function normalizarAlinhado(texto: string): string {
  let saida = "";
  for (const c of texto) {
    const n = c.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const um = n.length === 1 ? n : c.toLowerCase().length === 1 ? c.toLowerCase() : "?";
    // Caracteres fora do plano básico ocupam 2 posições na string: o substituto também.
    saida += c.length === 2 ? `${um}?`.slice(0, 2) : um;
  }
  return saida;
}

export const normalizar = (texto: string) => normalizarAlinhado(texto).replace(/\s+/g, " ").trim();

/** Valor recortado: o texto até a próxima célula (tabulação); se o valor só começa depois do vão, a célula seguinte. */
function limparValor(bruto: string): string {
  const celulas = bruto.split("\t").map((c) => c.trim());
  const valor = celulas[0] || celulas[1] || "";
  // Campo em branco do formulário impresso ("____/____/____").
  return /^[_/.\s-]*$/.test(valor) ? "" : valor.replace(/\s+/g, " ").trim();
}

/** Os pares "rótulo: valor" de uma linha, na ordem em que aparecem. */
function paresDaLinha(linha: string): [string, string][] {
  const normalizada = normalizarAlinhado(linha);
  const achados = [...normalizada.matchAll(rotulosDaLinha())];
  return achados.map((m, i) => {
    const fimDoRotulo = m.index! + m[0].length;
    const proximo = achados[i + 1]?.index ?? linha.length;
    return [CAMPO_DO_ROTULO.get(m[1]!)!, limparValor(linha.slice(fimDoRotulo, proximo))];
  });
}

/** Linhas do topo da folha em que ficam o número da ordem, as datas e a folha. */
const LINHAS_DO_CABECALHO = 8;

const temRotulo = (linha: string) => rotulosDaLinha().test(normalizarAlinhado(linha));

/** Número da ordem no cabeçalho da folha: o primeiro número de 6 a 12 dígitos depois de "Ordem de Manutenção". */
export function numeroDaFolha(pagina: PaginaDeTexto): string | null {
  const topo = pagina.linhas.slice(0, LINHAS_DO_CABECALHO);
  const texto = topo.join("\n");
  const cabecalho = /ordem de manutencao[\s\S]{0,240}?(?<![\d/.,:-])(\d{6,12})(?![\d/.,])/.exec(normalizarAlinhado(texto));
  if (cabecalho) return cabecalho[1]!;
  for (const linha of topo) {
    const par = paresDaLinha(linha).find(([campo, valor]) => campo === "numero_ordem" && /^\d{6,12}$/.test(valor));
    if (par) return par[1];
  }
  // A folha lida por OCR (`ocr.ts`) desmonta o cabeçalho ("Ordem de" numa linha, "Manutenção" noutra): vale então o primeiro
  // número de 6 a 12 dígitos que ocupa uma célula inteira nas linhas do topo (uma data ou uma hora tem `/` ou `:`).
  for (const linha of topo) {
    const solto = /(?:^|\t)(\d{6,12})(?=\t|\s|$)/.exec(linha);
    if (solto) return solto[1]!;
  }
  return null;
}

/** `dd/mm/aaaa` (ou `dd.mm.aaaa`, ano com 2 dígitos) → `AAAA-MM-DD`; `null` se não for uma data de verdade. */
export function dataDoPdf(valor: string | null | undefined): string | null {
  const m = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/.exec(valor ?? "");
  if (!m) return null;
  const ano = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const data = new Date(Date.UTC(ano, Number(m[2]) - 1, Number(m[1])));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== Number(m[2]) - 1 || data.getUTCDate() !== Number(m[1])) return null;
  return data.toISOString().slice(0, 10);
}

/** YBA1 (corretiva) ou YBA2 (preventiva): pelo tipo de ordem impresso ou, sem ele, pelo tipo de atividade (Z01/Z02). */
function tipoDaOrdem(tipoOrdem: string | undefined, tipoAtividade: string | undefined): "YBA1" | "YBA2" | null {
  for (const valor of [tipoOrdem, tipoAtividade]) {
    const n = normalizar(valor ?? "");
    if (!n) continue;
    if (/\byba1\b|^z0?1\b|corretiv/.test(n)) return "YBA1";
    if (/\byba2\b|^z0?2\b|preventiv/.test(n)) return "YBA2";
  }
  return null;
}

const LIMITE_DA_DESCRICAO = 4000;
/** Onde o texto longo termina: a folha de execução, que o técnico preenche à mão. */
const FIM_DO_TEXTO = /^(descricao da atividade|atesto que|executante|observacoes gerais)/;
/** A linha de títulos da tabela de operações; abaixo dela ficam as linhas que o técnico preenche à mão. */
export const OPERACOES = /texto breve( da)? operacao/;

/**
 * As linhas de uma OS (de todas as folhas dela), sem o cabeçalho que se repete em cada folha: tudo até a última linha do
 * topo com o número da ordem, a data da ordem, a da impressão ou a folha (o logotipo fica no meio delas).
 */
function linhasSemCabecalho(paginas: PaginaDeTexto[], numero: string): string[] {
  const ehDoCabecalho = (linha: string) => {
    const n = normalizar(linha);
    return n === numero || n.startsWith(`${numero} `) || /ordem de manutencao|data da ordem|data de impr|folha:/.test(n);
  };
  return paginas.flatMap((p) => {
    let fim = -1;
    p.linhas.slice(0, LINHAS_DO_CABECALHO).forEach((linha, i) => {
      if (ehDoCabecalho(linha)) fim = i;
    });
    return p.linhas.slice(fim + 1);
  });
}

function lerUmaOs(paginas: PaginaDeTexto[], numero: string): OsDoPdf {
  const cabecalhos = paginas.flatMap((p) => p.linhas.slice(0, LINHAS_DO_CABECALHO));
  const corpo = linhasSemCabecalho(paginas, numero);
  const iOperacoes = corpo.findIndex((l) => OPERACOES.test(normalizar(l)));
  // Os rótulos valem no cabeçalho e no formulário (antes da tabela de operações); o texto longo pode citar "Data:" etc.
  const formulario = iOperacoes >= 0 ? corpo.slice(0, iOperacoes) : corpo;

  const campos = new Map<string, string>();
  for (const linha of [...cabecalhos, ...formulario]) {
    for (const [campo, valor] of paresDaLinha(linha)) if (valor && !campos.has(campo)) campos.set(campo, valor);
  }
  const campo = (nome: string) => campos.get(nome) ?? null;

  // Operações: a primeira linha depois do cabeçalho da tabela que começa com o número da operação (0010).
  const operacoes = iOperacoes >= 0 ? corpo.slice(iOperacoes + 1) : [];
  const iPrimeira = operacoes.findIndex((l) => /^\d{4}\t/.test(l));
  const primeira = iPrimeira >= 0 ? operacoes[iPrimeira]!.split("\t") : [];

  // Título: a linha (ou linhas) sem rótulo logo acima de "OBJETOS TÉCNICOS".
  let titulo: string | null = null;
  const iObjetos = formulario.findIndex((l) => normalizar(l) === "objetos tecnicos");
  if (iObjetos > 0) {
    const partes: string[] = [];
    for (let i = iObjetos - 1; i >= 0 && !temRotulo(formulario[i]!); i--) partes.unshift(formulario[i]!.replace(/\t/g, " ").trim());
    titulo = partes.filter(Boolean).join(" ") || null;
  }
  titulo ??= primeira[2]?.trim() || null;

  // Texto longo: depois das operações (e da continuação do texto delas, que repete o título) até a folha de execução.
  let descricao: string | null = null;
  if (iPrimeira >= 0) {
    let i = iPrimeira;
    while (i + 1 < operacoes.length && /^\d{4}\t/.test(operacoes[i + 1]!)) i++;
    let textoDaOperacao = normalizar(operacoes[i]!.split("\t")[2] ?? "");
    const alvo = normalizar(titulo ?? "");
    i++;
    // Continuação da célula do texto breve, quebrada em outra linha.
    while (i < operacoes.length && !operacoes[i]!.includes("\t") && alvo.startsWith(`${textoDaOperacao} ${normalizar(operacoes[i]!)}`.trim()) && textoDaOperacao !== alvo) {
      textoDaOperacao = `${textoDaOperacao} ${normalizar(operacoes[i]!)}`.trim();
      i++;
    }
    const linhas: string[] = [];
    for (; i < operacoes.length; i++) {
      const linha = operacoes[i]!;
      if (FIM_DO_TEXTO.test(normalizar(linha))) break;
      const limpa = linha.replace(/_{2,}/g, " ").replace(/\t+/g, "  ").replace(/[ ]{3,}/g, "  ").trim();
      if (limpa && !/^[\s/()]*$/.test(limpa)) linhas.push(limpa);
    }
    descricao = linhas.join("\n").slice(0, LIMITE_DA_DESCRICAO).trim() || null;
  }

  const tipoAtividade = campo("tipo_atividade");
  const statusLido = campo("status_sap");
  const observacoes: string[] = [];
  if (!statusLido) observacoes.push("O PDF não traz o status do sistema: a OS vale como liberada, como na planilha sem a coluna de status.");
  else if (!/\blib\b/.test(normalizar(statusLido))) {
    observacoes.push("O status do sistema não tem LIB: a OS não entra, e uma OS que já existe no sistema fica como está.");
  }
  const tipoOrdem = tipoDaOrdem(campo("tipo_ordem") ?? undefined, tipoAtividade ?? undefined);
  if (tipoOrdem && !campo("tipo_ordem")) observacoes.push(`Tipo da ordem deduzido do tipo de atividade (${tipoAtividade}).`);
  // Da tabela de operações só vale um código de centro (SERV_ESP, PROT_CAT): com a célula vazia, a coluna seguinte (o texto
  // da operação) ocuparia o lugar dela.
  const centroDaOperacao = primeira[1]?.trim() ?? "";
  const centro = campo("centro_trabalho") ?? (/^[A-Z0-9_.-]{2,20}$/.test(centroDaOperacao) ? centroDaOperacao : null);
  if (centro && !campo("centro_trabalho")) observacoes.push("Centro de trabalho lido da tabela de operações.");

  const ordem: OrdemLidaDoPdf = {
    numero_ordem: numero,
    numero_nota: campo("numero_nota"),
    tipo_ordem: tipoOrdem,
    tipo_atividade: tipoAtividade,
    codigo_atividade: null,
    titulo,
    descricao,
    centro_trabalho: centro,
    local_instalacao: { codigo: campo("local"), endereco: campo("endereco"), plus_code: campo("plus_code"), cliente: campo("cliente") },
    equipamento: campo("equipamento"),
    prioridade: campo("prioridade"),
    data_inicio_prog: dataDoPdf(campo("data_inicio_prog")),
    data_fim_prog: dataDoPdf(campo("data_fim_prog")),
    status_sap: statusLido ? statusLido.replace(/\s+/g, " ") : "LIB",
    solicitante: campo("solicitante"),
    criado_por: campo("criado_por"),
    criada_em: dataDoPdf(campo("criada_em")),
    plano_manutencao: campo("plano_manutencao"),
    item_manutencao: campo("item_manutencao"),
    intervalo_ciclo: campo("periodicidade"),
  };
  const faltando = CAMPOS_OBRIGATORIOS.filter((c) => (c === "local_instalacao" ? !ordem.local_instalacao.codigo : !ordem[c]));
  return { paginas: paginas.map((p) => p.numero), ordem, faltando, observacoes };
}

/**
 * As OS do PDF: cada folha vai para a OS do número no cabeçalho dela; a folha sem número continua a OS anterior (a folha de
 * um texto longo comprido, por exemplo). Uma ordem que aparece de novo mais adiante junta-se à primeira.
 */
export function lerOrdensDoPdf(paginas: PaginaDeTexto[]): LeituraDoPdf {
  const grupos = new Map<string, PaginaDeTexto[]>();
  const paginasSemOrdem: number[] = [];
  let atual: string | null = null;
  for (const pagina of paginas) {
    const numero: string | null = numeroDaFolha(pagina) ?? atual;
    if (!numero) {
      paginasSemOrdem.push(pagina.numero);
      continue;
    }
    atual = numero;
    grupos.set(numero, [...(grupos.get(numero) ?? []), pagina]);
  }
  return { ordens: [...grupos.entries()].map(([numero, folhas]) => lerUmaOs(folhas, numero)), paginasSemOrdem };
}
