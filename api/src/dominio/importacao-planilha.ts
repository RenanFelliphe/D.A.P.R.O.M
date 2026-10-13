import ExcelJS from "exceljs";
import { invalido } from "../http/erros";
import type { EntradaOrdem } from "./importacao-ordens";

/**
 * Leitura da planilha .xlsx de OS (Integração SAP, suposição 1: usar os campos do PDF da OS 4023470 até chegar a
 * planilha de 2025 do Iago; este mapeamento é o ponto de ajuste quando ela chegar).
 *
 * Mapeamento por cabeçalho (a primeira aba; a linha de cabeçalho é a que casar mais colunas entre as 10 primeiras;
 * maiúsculas, acentos, pontuação e espaços extras não importam: "Local de Instalação", "LOCAL INSTALACAO" e
 * "local de instalação" são o mesmo cabeçalho). Cabeçalhos aceitos (todos comparados já normalizados):
 *
 *   campo da ordem        cabeçalhos aceitos
 *   numero_ordem *        ordem | nº ordem | numero da ordem | ordem de manutencao | om
 *   numero_nota           nota | nº nota | numero da nota
 *   tipo_ordem *          tipo | tipo de ordem | tipo da ordem   (YBA1/YBA2, ou "corretiva"/"preventiva")
 *   tipo_atividade        tipo de atividade | tipo atividade
 *   codigo_atividade      codigo da atividade | codigo atividade | atividade
 *   titulo *              titulo | texto breve | denominacao | descricao da ordem | descricao breve
 *   descricao             descricao | texto longo | descricao longa | instrucoes | materiais e ferramentas
 *   centro_trabalho *     centro de trabalho | centro trabalho | ct
 *   local_instalacao.codigo *  local de instalacao | local instalacao | local
 *   local_instalacao.endereco  endereco | endereco do local
 *   local_instalacao.plus_code plus code | pluscode
 *   local_instalacao.cliente   cliente
 *   equipamento           equipamento
 *   prioridade            prioridade
 *   data_inicio_prog *    inicio programado | data inicio programada | data de inicio programada | inicio prog | data programada
 *   data_fim_prog         fim programado | data fim programada | data de fim programada | fim prog
 *   status_sap            status do sistema | status sap | status
 *   solicitante           solicitante
 *   criado_por            criado por
 *   criada_em             data da ordem | emitida em | criada em | data de criacao
 *   plano_manutencao      plano de manutencao | plano
 *   item_manutencao       item de manutencao | item
 *   intervalo_ciclo       intervalo | intervalo entre ciclos | periodicidade | ciclo | frequencia   ("3 meses", "30 dias",
 *                         "trimestral"; só vale na preventiva com plano, e um valor que não dá para entender vira aviso)
 *
 * (* = coluna obrigatória; sem alguma delas a importação inteira é recusada com 422). A coluna de status é opcional:
 * sem ela, todas as linhas valem como liberadas (`LIB`), porque a planilha exportada traz as ordens a executar; com ela,
 * a linha precisa conter `LIB` como na leitura pela API. Datas aceitas: célula de data, número de série do Excel,
 * `AAAA-MM-DD` ou `DD/MM/AAAA`. Linhas totalmente vazias são puladas e não contam.
 */

const CAMPOS = {
  numero_ordem: { rotulo: "Ordem", obrigatoria: true, cabecalhos: ["ordem", "n ordem", "no ordem", "numero da ordem", "numero ordem", "ordem de manutencao", "om"] },
  numero_nota: { rotulo: "Nota", cabecalhos: ["nota", "n nota", "no nota", "numero da nota", "numero nota"] },
  tipo_ordem: { rotulo: "Tipo de ordem", obrigatoria: true, cabecalhos: ["tipo", "tipo de ordem", "tipo da ordem", "tipo ordem"] },
  tipo_atividade: { rotulo: "Tipo de atividade", cabecalhos: ["tipo de atividade", "tipo atividade"] },
  codigo_atividade: { rotulo: "Código da atividade", cabecalhos: ["codigo da atividade", "codigo atividade", "atividade"] },
  titulo: { rotulo: "Título", obrigatoria: true, cabecalhos: ["titulo", "texto breve", "denominacao", "descricao da ordem", "descricao breve"] },
  descricao: { rotulo: "Descrição", cabecalhos: ["descricao", "texto longo", "descricao longa", "instrucoes", "materiais e ferramentas"] },
  centro_trabalho: { rotulo: "Centro de trabalho", obrigatoria: true, cabecalhos: ["centro de trabalho", "centro trabalho", "ct"] },
  local_codigo: { rotulo: "Local de instalação", obrigatoria: true, cabecalhos: ["local de instalacao", "local instalacao", "local"] },
  local_endereco: { rotulo: "Endereço", cabecalhos: ["endereco", "endereco do local"] },
  local_plus_code: { rotulo: "Plus code", cabecalhos: ["plus code", "pluscode"] },
  local_cliente: { rotulo: "Cliente", cabecalhos: ["cliente"] },
  equipamento: { rotulo: "Equipamento", cabecalhos: ["equipamento"] },
  prioridade: { rotulo: "Prioridade", cabecalhos: ["prioridade"] },
  data_inicio_prog: {
    rotulo: "Início programado",
    obrigatoria: true,
    cabecalhos: ["inicio programado", "data inicio programada", "data de inicio programada", "inicio prog", "data inicio prog", "data programada", "inicio programada"],
  },
  data_fim_prog: {
    rotulo: "Fim programado",
    cabecalhos: ["fim programado", "data fim programada", "data de fim programada", "fim prog", "data fim prog", "fim programada"],
  },
  status_sap: { rotulo: "Status do sistema", cabecalhos: ["status do sistema", "status sap", "status"] },
  solicitante: { rotulo: "Solicitante", cabecalhos: ["solicitante"] },
  criado_por: { rotulo: "Criado por", cabecalhos: ["criado por"] },
  criada_em: { rotulo: "Data da ordem", cabecalhos: ["data da ordem", "emitida em", "criada em", "data de criacao"] },
  plano_manutencao: { rotulo: "Plano de manutenção", cabecalhos: ["plano de manutencao", "plano"] },
  item_manutencao: { rotulo: "Item de manutenção", cabecalhos: ["item de manutencao", "item"] },
  intervalo_ciclo: {
    rotulo: "Intervalo entre ciclos",
    cabecalhos: ["intervalo", "intervalo entre ciclos", "intervalo do ciclo", "periodicidade", "ciclo", "frequencia", "periodo do ciclo"],
  },
} satisfies Record<string, { rotulo: string; obrigatoria?: boolean; cabecalhos: string[] }>;

type Campo = keyof typeof CAMPOS;
const OBRIGATORIAS = (Object.keys(CAMPOS) as Campo[]).filter((c) => "obrigatoria" in CAMPOS[c]);
const LINHAS_PARA_ACHAR_CABECALHO = 10;

/** Sem acento, minúsculas, pontuação (inclusive º e ª) trocada por espaço e espaços reduzidos. */
export function normalizarCabecalho(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const CAMPO_POR_CABECALHO = new Map<string, Campo>();
for (const campo of Object.keys(CAMPOS) as Campo[]) for (const c of CAMPOS[campo].cabecalhos) CAMPO_POR_CABECALHO.set(c, campo);

/** Conteúdo da célula como valor simples (texto formatado, resultado de fórmula, link) ou `null`. */
function valorDaCelula(valor: ExcelJS.CellValue): string | number | Date | null {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date || typeof valor === "number") return valor;
  if (typeof valor === "string") return valor.trim() === "" ? null : valor.trim();
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if ("richText" in valor) return valor.richText.map((p) => p.text).join("").trim() || null;
  if ("result" in valor) return valor.result === undefined || (typeof valor.result === "object" && valor.result !== null && "error" in valor.result) ? null : valorDaCelula(valor.result as ExcelJS.CellValue);
  if ("text" in valor) return String(valor.text).trim() || null;
  return null;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})/;
const BR = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/;

function dataIso(a: number, m: number, d: number): string | undefined {
  const data = new Date(Date.UTC(a, m - 1, d));
  if (data.getUTCFullYear() !== a || data.getUTCMonth() !== m - 1 || data.getUTCDate() !== d) return undefined;
  return data.toISOString().slice(0, 10);
}

/** Data da célula como `AAAA-MM-DD`; `undefined` quando não dá para entender. */
function paraData(v: string | number | Date): string | undefined {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? undefined : v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Número de série do Excel (dias desde 1899-12-30).
    return v > 1 && v < 100_000 ? new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86_400_000).toISOString().slice(0, 10) : undefined;
  }
  const iso = ISO.exec(v);
  if (iso) return dataIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const br = BR.exec(v);
  if (br) return dataIso(Number(br[3]), Number(br[2]), Number(br[1]));
  return undefined;
}

/** `YBA1`/`YBA2`, ou o texto "corretiva"/"preventiva"; outro valor segue como veio e a validação o recusa. */
function paraTipoDaOrdem(v: string | number | Date): string | number | Date {
  if (typeof v !== "string") return v;
  const n = normalizarCabecalho(v);
  if (n.startsWith("corretiv")) return "YBA1";
  if (n.startsWith("preventiv")) return "YBA2";
  return v;
}

export interface PlanilhaLida {
  entradas: EntradaOrdem[];
}

/**
 * Lê a planilha e devolve as ordens no formato do contrato (`OrdemSap`), uma por linha, para o mesmo processamento da
 * leitura pela API. Arquivo que não é .xlsx ou sem as colunas obrigatórias: `422`, e nada é gravado.
 */
export async function lerPlanilha(bytes: Uint8Array): Promise<PlanilhaLida> {
  const livro = new ExcelJS.Workbook();
  try {
    await livro.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
  } catch {
    throw invalido("planilha_invalida", "O arquivo não é uma planilha .xlsx válida");
  }
  const aba = livro.worksheets[0];
  if (!aba) throw invalido("planilha_invalida", "A planilha não tem abas");

  // Acha a linha de cabeçalho: a que reconhece mais colunas.
  let melhor = { linha: 0, colunas: new Map<Campo, number>() };
  for (let n = 1; n <= Math.min(LINHAS_PARA_ACHAR_CABECALHO, aba.rowCount); n++) {
    const colunas = new Map<Campo, number>();
    aba.getRow(n).eachCell({ includeEmpty: false }, (celula, coluna) => {
      const valor = valorDaCelula(celula.value);
      const campo = typeof valor === "string" ? CAMPO_POR_CABECALHO.get(normalizarCabecalho(valor)) : undefined;
      if (campo && !colunas.has(campo)) colunas.set(campo, coluna);
    });
    if (colunas.size > melhor.colunas.size) melhor = { linha: n, colunas };
  }

  const ausentes = OBRIGATORIAS.filter((c) => !melhor.colunas.has(c));
  if (ausentes.length > 0) {
    throw invalido("colunas_ausentes", `Colunas obrigatórias ausentes: ${ausentes.map((c) => CAMPOS[c].rotulo).join(", ")}`);
  }

  const entradas: EntradaOrdem[] = [];
  for (let n = melhor.linha + 1; n <= aba.rowCount; n++) {
    const linha = aba.getRow(n);
    const valores = new Map<Campo, string | number | Date>();
    let vazia = true;
    linha.eachCell({ includeEmpty: false }, (celula) => {
      if (valorDaCelula(celula.value) !== null) vazia = false;
    });
    if (vazia) continue;
    for (const [campo, coluna] of melhor.colunas) {
      const v = valorDaCelula(linha.getCell(coluna).value);
      if (v !== null) valores.set(campo, v);
    }

    const texto = (c: Campo) => (valores.has(c) ? String(valores.get(c)) : null);
    const colunaPresente = (c: Campo) => melhor.colunas.has(c);
    // Coluna presente com célula vazia é `null` (o SAP limpou o campo); coluna ausente é `undefined` (não mexe).
    const opcional = (c: Campo) => (colunaPresente(c) ? texto(c) : undefined);

    const dataDe = (c: Campo): string | null | undefined => {
      if (!colunaPresente(c)) return undefined;
      const v = valores.get(c);
      if (v === undefined) return null;
      // Data ilegível segue como texto: a validação da ordem a recusa com o motivo.
      return paraData(v) ?? String(v);
    };

    const ordem = {
      numero_ordem: texto("numero_ordem"),
      numero_nota: opcional("numero_nota"),
      tipo_ordem: valores.has("tipo_ordem") ? String(paraTipoDaOrdem(valores.get("tipo_ordem")!)) : null,
      tipo_atividade: opcional("tipo_atividade"),
      codigo_atividade: opcional("codigo_atividade"),
      titulo: texto("titulo"),
      descricao: opcional("descricao"),
      centro_trabalho: texto("centro_trabalho"),
      local_instalacao: {
        codigo: texto("local_codigo"),
        endereco: opcional("local_endereco"),
        plus_code: opcional("local_plus_code"),
        cliente: opcional("local_cliente"),
      },
      equipamento: opcional("equipamento"),
      prioridade: opcional("prioridade"),
      data_inicio_prog: dataDe("data_inicio_prog"),
      data_fim_prog: dataDe("data_fim_prog"),
      // Sem coluna de status, a planilha vale como de ordens liberadas.
      status_sap: colunaPresente("status_sap") ? texto("status_sap") : "LIB",
      solicitante: opcional("solicitante"),
      criado_por: opcional("criado_por"),
      criada_em: dataDe("criada_em"),
      plano_manutencao: opcional("plano_manutencao"),
      item_manutencao: opcional("item_manutencao"),
      // Célula vazia não apaga o intervalo já definido: só o que veio preenchido muda o plano.
      intervalo_ciclo: texto("intervalo_ciclo") ?? undefined,
    };
    entradas.push({ linha: n, ordem });
  }
  return { entradas };
}
