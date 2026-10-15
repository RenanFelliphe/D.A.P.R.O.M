import { and, eq, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/conexao";
import {
  CICLO_BASES,
  INTERVALO_UNIDADES,
  equipe,
  execucao,
  localInstalacao,
  os,
  planoPreventiva,
  type CicloBase,
  type IntervaloUnidade,
  type OsStatus,
} from "../db/schema";
import { equipesDoEscopo, podeSupervisionarEquipe, type UsuarioAutenticado } from "../http/autenticacao";
import { naoEncontrado, proibido } from "../http/erros";
import { criarAlertas } from "./alertas";
import { normalizar } from "./busca";
import { esquemaChecklist, perguntasDosPlanos, salvarChecklist, type Pergunta } from "./checklist-inspecao";
import { ganhosDe } from "./lancamentos";
import { dataDeReferencia, diaBr, diaNoFuso, FUSO } from "./painel-comum";
import { pontuarIntervalo } from "./pontuacao";

/*
 * Intervalo entre ciclos das preventivas. Cada plano de manutenção do SAP (plano + item) gera uma OS preventiva por ciclo;
 * o sistema não cria essas OS (elas vêm do SAP), mas conta o tempo até o próximo ciclo e avisa quem planeja quando ele se
 * aproxima (`preventiva_proxima`, a `antecedencia_dias` do vencimento) e quando vence sem OS nova do plano
 * (`preventiva_vencida`). Um alerta de cada tipo por ciclo: o vencimento já avisado fica gravado no plano.
 *
 * O próximo ciclo é contado a partir da última OS do plano (a de início programado mais recente, sem as canceladas e as devolvidas):
 * - `execucao`: do dia em que ela foi encerrada; enquanto ela não é executada, o ciclo está "aguardando execução";
 * - `programacao`: da data programada dela, siga ela aberta ou não (o calendário fixo do plano).
 * Uma OS nova do plano (o ciclo seguinte que chegou do SAP) passa a ser a última e a contagem recomeça.
 */

// ---- Intervalo -------------------------------------------------------------------------------------------------

export interface Intervalo {
  quantidade: number;
  unidade: IntervaloUnidade;
}

const DIAS_DA_UNIDADE: Partial<Record<IntervaloUnidade, number>> = { dia: 1, semana: 7, quinzena: 15 };
const MESES_DA_UNIDADE: Partial<Record<IntervaloUnidade, number>> = { mes: 1, bimestre: 2, trimestre: 3, semestre: 6, ano: 12 };

const NOMES: Record<IntervaloUnidade, [string, string]> = {
  dia: ["dia", "dias"],
  semana: ["semana", "semanas"],
  quinzena: ["quinzena", "quinzenas"],
  mes: ["mês", "meses"],
  bimestre: ["bimestre", "bimestres"],
  trimestre: ["trimestre", "trimestres"],
  semestre: ["semestre", "semestres"],
  ano: ["ano", "anos"],
};
const ADJETIVOS: Record<IntervaloUnidade, string> = {
  dia: "diária",
  semana: "semanal",
  quinzena: "quinzenal",
  mes: "mensal",
  bimestre: "bimestral",
  trimestre: "trimestral",
  semestre: "semestral",
  ano: "anual",
};

/** "a cada 3 meses"; com quantidade 1, "mensal". */
export function descreverIntervalo(i: Intervalo): string {
  if (i.quantidade === 1) return ADJETIVOS[i.unidade];
  return `a cada ${i.quantidade} ${NOMES[i.unidade][1]}`;
}

/** `AAAA-MM-DD` mais o intervalo `vezes` vezes. Meses de calendário: 31/01 + 1 mês = último dia de fevereiro. */
export function somarIntervalo(dia: string, i: Intervalo, vezes = 1): string {
  const [a, m, d] = dia.split("-").map(Number) as [number, number, number];
  const dias = DIAS_DA_UNIDADE[i.unidade];
  if (dias !== undefined) return new Date(Date.UTC(a, m - 1, d + dias * i.quantidade * vezes)).toISOString().slice(0, 10);
  const meses = MESES_DA_UNIDADE[i.unidade]! * i.quantidade * vezes;
  const ultimoDia = new Date(Date.UTC(a, m - 1 + meses + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m - 1 + meses, Math.min(d, ultimoDia))).toISOString().slice(0, 10);
}

/** Dias corridos de `de` até `ate` (negativo quando `ate` vem antes). */
export function diasEntre(de: string, ate: string): number {
  const dia = (iso: string) => {
    const [a, m, d] = iso.split("-").map(Number) as [number, number, number];
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((dia(ate) - dia(de)) / 86_400_000);
}

/** Palavras aceitas para cada unidade (já sem acento e minúsculas), inclusive as abreviações do SAP (`MON`, `TAG`, `JAH`). */
const UNIDADE_DA_PALAVRA = new Map<string, IntervaloUnidade>();
const PALAVRAS: Record<IntervaloUnidade, string[]> = {
  dia: ["d", "dia", "dias", "day", "days", "tag", "tage"],
  semana: ["sem", "semana", "semanas", "w", "wk", "wks", "week", "weeks", "woc", "wo"],
  quinzena: ["quinzena", "quinzenas"],
  mes: ["m", "mes", "meses", "mon", "mo", "month", "months"],
  bimestre: ["bimestre", "bimestres"],
  trimestre: ["trimestre", "trimestres", "tri"],
  semestre: ["semestre", "semestres"],
  ano: ["a", "ano", "anos", "y", "yr", "year", "years", "jah", "jahr"],
};
for (const [unidade, palavras] of Object.entries(PALAVRAS)) for (const p of palavras) UNIDADE_DA_PALAVRA.set(p, unidade as IntervaloUnidade);

const DOS_ADJETIVOS: [RegExp, Intervalo][] = [
  [/^diari[oa]s?$/, { quantidade: 1, unidade: "dia" }],
  [/^semana(l|is)$/, { quantidade: 1, unidade: "semana" }],
  [/^quinzena(l|is)$/, { quantidade: 1, unidade: "quinzena" }],
  [/^mensa(l|is)$/, { quantidade: 1, unidade: "mes" }],
  [/^bimestra(l|is)$/, { quantidade: 1, unidade: "bimestre" }],
  [/^trimestra(l|is)$/, { quantidade: 1, unidade: "trimestre" }],
  [/^semestra(l|is)$/, { quantidade: 1, unidade: "semestre" }],
  [/^anua(l|is)$/, { quantidade: 1, unidade: "ano" }],
  [/^(bienal|bianual)$/, { quantidade: 2, unidade: "ano" }],
];

const esquemaIntervaloObjeto = z.object({
  quantidade: z.coerce.number().int("Use um número inteiro").min(1, "O intervalo é de ao menos 1").max(999, "No máximo 999"),
  unidade: z.enum(INTERVALO_UNIDADES, { error: `Unidade inválida (use ${INTERVALO_UNIDADES.join(", ")})` }),
});

/**
 * O intervalo como a importação o recebe: `{quantidade, unidade}` ou o texto do SAP e da planilha ("3 meses", "30 dias",
 * "trimestral", "a cada 2 semanas", "3 MON", "1 JAH"). Vazio é `null` (sem intervalo informado); o que não dá para entender
 * é `undefined`.
 */
export function lerIntervalo(bruto: unknown): Intervalo | null | undefined {
  if (bruto === null || bruto === undefined) return null;
  if (typeof bruto === "object") {
    const r = esquemaIntervaloObjeto.safeParse(bruto);
    return r.success ? r.data : undefined;
  }
  if (typeof bruto !== "string") return undefined;
  const texto = normalizar(bruto).replace(/[.,;]/g, " ").replace(/\s+/g, " ").trim();
  if (texto === "") return null;
  for (const [padrao, intervalo] of DOS_ADJETIVOS) if (padrao.test(texto)) return { ...intervalo };
  const m = /^(?:a cada |cada |de )?(\d{1,3})? ?([a-z]+)$/.exec(texto);
  if (!m) return undefined;
  const unidade = UNIDADE_DA_PALAVRA.get(m[2]!);
  const quantidade = m[1] === undefined ? 1 : Number(m[1]);
  if (!unidade || quantidade < 1 || quantidade > 999) return undefined;
  // Uma letra solta ("m", "a", "d") só vale com o número na frente.
  if (m[1] === undefined && m[2]!.length === 1) return undefined;
  return { quantidade, unidade };
}

export const esquemaIntervalo = esquemaIntervaloObjeto;

// ---- Plano -----------------------------------------------------------------------------------------------------

/** Plano e item como chave: aparados, e o item vazio vira nulo. */
export function chaveDoPlano(plano: string | null | undefined, item: string | null | undefined): { plano: string; item: string | null } | null {
  const p = plano?.trim();
  if (!p) return null;
  return { plano: p, item: item?.trim() || null };
}

/**
 * O plano de uma OS preventiva, criado na primeira OS dele. Com `intervalo`, grava o intervalo (o que a importação trouxe ou
 * a pessoa conferiu); sem ele, o plano fica como está. Quem chama passa a própria transação. Devolve o id e se o plano está
 * sem intervalo.
 */
export async function garantirPlano(
  db: Db,
  chave: { plano: string; item: string | null },
  intervalo: Intervalo | undefined,
  agora: Date,
): Promise<{ id: string; criado: boolean; semIntervalo: boolean }> {
  const daChave = and(eq(planoPreventiva.planoManutencao, chave.plano), chave.item === null ? sql`${planoPreventiva.itemManutencao} is null` : eq(planoPreventiva.itemManutencao, chave.item));
  let [existente] = await db.select({ id: planoPreventiva.id, quantidade: planoPreventiva.intervaloQuantidade }).from(planoPreventiva).where(daChave);
  let criado = false;
  if (!existente) {
    [existente] = await db
      .insert(planoPreventiva)
      .values({ planoManutencao: chave.plano, itemManutencao: chave.item })
      .onConflictDoNothing()
      .returning({ id: planoPreventiva.id, quantidade: planoPreventiva.intervaloQuantidade });
    criado = Boolean(existente);
    existente ??= (await db.select({ id: planoPreventiva.id, quantidade: planoPreventiva.intervaloQuantidade }).from(planoPreventiva).where(daChave))[0];
  }
  if (intervalo) {
    await db
      .update(planoPreventiva)
      .set({ intervaloQuantidade: intervalo.quantidade, intervaloUnidade: intervalo.unidade, atualizadoEm: agora })
      .where(eq(planoPreventiva.id, existente!.id));
  }
  return { id: existente!.id, criado, semIntervalo: !intervalo && existente!.quantidade === null };
}

// ---- Situação do ciclo -----------------------------------------------------------------------------------------

export const SITUACOES_DO_CICLO = ["vencido", "proximo", "aguardando_execucao", "em_dia", "sem_intervalo", "sem_historico", "pausado"] as const;
export type SituacaoDoCiclo = (typeof SITUACOES_DO_CICLO)[number];

/** Ordem da lista: o que pede ação primeiro. */
const PRIORIDADE: Record<SituacaoDoCiclo, number> = Object.fromEntries(SITUACOES_DO_CICLO.map((s, i) => [s, i])) as Record<SituacaoDoCiclo, number>;

const ABERTAS: OsStatus[] = ["liberada", "pendente", "em_execucao"];

export interface OsDoCiclo {
  id: string;
  numeroOrdem: string | null;
  titulo: string;
  status: OsStatus;
  equipeId: string;
  equipeNome: string;
  localId: string;
  localCodigo: string;
  equipamento: string | null;
  dataInicioProg: string;
  dataFimProg: string | null;
  /** Dia (São Paulo) em que a execução foi encerrada; nulo enquanto a OS não foi executada. */
  encerradaEm: string | null;
}

type LinhaDoPlano = typeof planoPreventiva.$inferSelect;

export interface PlanoCalculado {
  id: string;
  planoManutencao: string;
  itemManutencao: string | null;
  titulo: string | null;
  equipe: { id: string; nome: string } | null;
  local: { id: string; codigo: string } | null;
  equipamento: string | null;
  intervalo: Intervalo | null;
  intervaloDescricao: string | null;
  /** De onde o ciclo é contado (`plano_preventiva.contar_a_partir`). */
  baseDoCiclo: CicloBase;
  antecedenciaDias: number;
  ativo: boolean;
  observacao: string | null;
  situacao: SituacaoDoCiclo;
  /** De onde o ciclo atual é contado (o encerramento ou a data programada da última OS). */
  referencia: string | null;
  proximoCiclo: string | null;
  /** Até o próximo ciclo; negativo quando já venceu. */
  diasRestantes: number | null;
  /** Quanto do ciclo já passou (0 no começo, 1 no vencimento, mais que 1 depois). */
  progresso: number | null;
  ultimaOs: Pick<OsDoCiclo, "id" | "numeroOrdem" | "titulo" | "status" | "dataInicioProg" | "dataFimProg" | "encerradaEm"> | null;
  /** OS do plano ainda não executadas (liberadas, pendentes ou em execução). */
  osAbertas: number;
  totalCiclos: number;
  atualizadoEm: Date;
  alertaProximoPara: string | null;
  alertaVencidoPara: string | null;
  /** O checklist de inspeção do plano, na ordem (`inspecao-preventivas.md`). */
  checklist: Pergunta[];
}

const intervaloDe = (p: Pick<LinhaDoPlano, "intervaloQuantidade" | "intervaloUnidade">): Intervalo | null =>
  p.intervaloQuantidade !== null && p.intervaloUnidade !== null ? { quantidade: p.intervaloQuantidade, unidade: p.intervaloUnidade } : null;

const chaveTexto = (plano: string, item: string | null) => `${plano}\u0000${item ?? ""}`;

/** O ciclo de um plano no dia `hoje`, dadas as OS dele (as mais recentes primeiro). */
export function calcularCiclo(p: LinhaDoPlano, osDoPlano: OsDoCiclo[], hoje: string, checklist: Pergunta[] = []): PlanoCalculado {
  const intervalo = intervaloDe(p);
  const ultima = osDoPlano[0] ?? null;

  let referencia: string | null = null;
  if (ultima) referencia = p.contarAPartir === "programacao" ? ultima.dataInicioProg : ultima.encerradaEm;
  const proximoCiclo = intervalo && referencia ? somarIntervalo(referencia, intervalo) : null;
  const diasRestantes = proximoCiclo ? diasEntre(hoje, proximoCiclo) : null;
  const duracao = proximoCiclo && referencia ? diasEntre(referencia, proximoCiclo) : 0;
  const progresso = proximoCiclo && referencia && duracao > 0 ? Math.max(0, diasEntre(referencia, hoje) / duracao) : null;

  let situacao: SituacaoDoCiclo;
  if (!p.ativo) situacao = "pausado";
  else if (!intervalo) situacao = "sem_intervalo";
  else if (!ultima) situacao = "sem_historico";
  // Contando da execução, a OS do ciclo atual ainda não executada segura a contagem (não há referência ainda).
  else if (diasRestantes === null) situacao = "aguardando_execucao";
  else if (diasRestantes < 0) situacao = "vencido";
  else if (diasRestantes <= p.antecedenciaDias) situacao = "proximo";
  else situacao = "em_dia";

  return {
    id: p.id,
    planoManutencao: p.planoManutencao,
    itemManutencao: p.itemManutencao,
    titulo: ultima?.titulo ?? null,
    equipe: ultima ? { id: ultima.equipeId, nome: ultima.equipeNome } : null,
    local: ultima ? { id: ultima.localId, codigo: ultima.localCodigo } : null,
    equipamento: ultima?.equipamento ?? null,
    intervalo,
    intervaloDescricao: intervalo ? descreverIntervalo(intervalo) : null,
    baseDoCiclo: p.contarAPartir,
    antecedenciaDias: p.antecedenciaDias,
    ativo: p.ativo,
    observacao: p.observacao,
    situacao,
    referencia,
    proximoCiclo,
    diasRestantes,
    progresso: progresso === null ? null : Math.round(progresso * 1000) / 1000,
    ultimaOs: ultima
      ? {
          id: ultima.id,
          numeroOrdem: ultima.numeroOrdem,
          titulo: ultima.titulo,
          status: ultima.status,
          dataInicioProg: ultima.dataInicioProg,
          dataFimProg: ultima.dataFimProg,
          encerradaEm: ultima.encerradaEm,
        }
      : null,
    osAbertas: osDoPlano.filter((o) => ABERTAS.includes(o.status)).length,
    totalCiclos: osDoPlano.length,
    atualizadoEm: p.atualizadoEm,
    alertaProximoPara: p.alertaProximoPara,
    alertaVencidoPara: p.alertaVencidoPara,
    checklist,
  };
}

/** Dia (São Paulo) do encerramento da OS: a execução encerrada mais recente dela. */
const encerradaEm = sql<string | null>`(select to_char(max(${execucao.fim}) at time zone ${FUSO}, 'YYYY-MM-DD') from ${execucao} where ${execucao.osId} = ${os.id} and ${execucao.resultado} = 'encerrada')`;

/** As OS preventivas (sem as canceladas e as devolvidas) dos planos, agrupadas pela chave plano + item, das mais recentes às mais antigas. */
async function osDosPlanos(db: Db, planos: LinhaDoPlano[]): Promise<Map<string, OsDoCiclo[]>> {
  const grupos = new Map<string, OsDoCiclo[]>();
  if (planos.length === 0) return grupos;
  const codigos = [...new Set(planos.map((p) => p.planoManutencao))];
  const linhas = await db
    .select({
      id: os.id,
      numeroOrdem: os.numeroOrdem,
      titulo: os.titulo,
      status: os.status,
      equipeId: os.equipeId,
      equipeNome: equipe.nome,
      localId: localInstalacao.id,
      localCodigo: localInstalacao.codigo,
      equipamento: os.equipamento,
      dataInicioProg: os.dataInicioProg,
      dataFimProg: os.dataFimProg,
      planoManutencao: os.planoManutencao,
      itemManutencao: os.itemManutencao,
      encerradaEm,
    })
    .from(os)
    .innerJoin(equipe, eq(equipe.id, os.equipeId))
    .innerJoin(localInstalacao, eq(localInstalacao.id, os.localInstalacaoId))
    .where(and(eq(os.tipo, "preventiva"), notInArray(os.status, ["cancelada", "devolvida"]), isNotNull(os.planoManutencao), inArray(sql`btrim(${os.planoManutencao})`, codigos)));
  for (const { planoManutencao, itemManutencao, ...o } of linhas) {
    const chave = chaveDoPlano(planoManutencao, itemManutencao);
    if (!chave) continue;
    const k = chaveTexto(chave.plano, chave.item);
    grupos.set(k, [...(grupos.get(k) ?? []), o]);
  }
  for (const lista of grupos.values()) {
    lista.sort((a, b) => b.dataInicioProg.localeCompare(a.dataInicioProg) || (b.numeroOrdem ?? "").localeCompare(a.numeroOrdem ?? ""));
  }
  return grupos;
}

/** Todos os planos (ou só os pedidos), já com o ciclo calculado para o dia de `agora`. */
export async function calcularPlanos(db: Db, agora: Date, ids?: string[]): Promise<{ hoje: string; planos: PlanoCalculado[]; osPorPlano: Map<string, OsDoCiclo[]> }> {
  const hoje = diaNoFuso(agora);
  const linhas = await db
    .select()
    .from(planoPreventiva)
    .where(ids ? inArray(planoPreventiva.id, ids) : undefined);
  const grupos = await osDosPlanos(db, linhas);
  const perguntas = await perguntasDosPlanos(db, linhas.map((p) => p.id));
  const osPorPlano = new Map<string, OsDoCiclo[]>();
  const planos = linhas.map((p) => {
    const lista = grupos.get(chaveTexto(p.planoManutencao, p.itemManutencao)) ?? [];
    osPorPlano.set(p.id, lista);
    return calcularCiclo(p, lista, hoje, perguntas.get(p.id) ?? []);
  });
  return { hoje, planos, osPorPlano };
}

/** Quem vê o plano: quem vê a equipe da última OS dele; o plano sem OS, só quem vê todas as equipes. */
function veOPlano(eu: UsuarioAutenticado, p: PlanoCalculado): boolean {
  const escopo = equipesDoEscopo(eu);
  if (escopo === null) return true;
  return p.equipe !== null && escopo.includes(p.equipe.id);
}

/** Quem define o intervalo e o checklist de inspeção: o admin e o supervisor da equipe do plano. */
export const podeEditarPlano = (eu: UsuarioAutenticado, p: Pick<PlanoCalculado, "equipe">) =>
  eu.perfil === "admin" || (p.equipe !== null && podeSupervisionarEquipe(eu, p.equipe.id));

export interface FiltrosDosPlanos {
  situacao?: SituacaoDoCiclo;
  equipe_id?: string;
  busca?: string;
}

const ordenar = (a: PlanoCalculado, b: PlanoCalculado) =>
  PRIORIDADE[a.situacao] - PRIORIDADE[b.situacao] ||
  (a.diasRestantes ?? Number.MAX_SAFE_INTEGER) - (b.diasRestantes ?? Number.MAX_SAFE_INTEGER) ||
  (a.titulo ?? "").localeCompare(b.titulo ?? "", "pt-BR") ||
  a.planoManutencao.localeCompare(b.planoManutencao);

/**
 * Os planos que a pessoa vê, com a contagem por situação (depois dos filtros de equipe e busca, antes do de situação, para
 * a tela mostrar quantos há em cada uma). A busca olha o título, o plano, o item, o equipamento e o local.
 */
export async function listarPlanos(db: Db, eu: UsuarioAutenticado, f: FiltrosDosPlanos, agora: Date) {
  const { hoje, planos } = await calcularPlanos(db, agora);
  const termo = f.busca ? normalizar(f.busca.trim()) : null;
  const visiveis = planos
    .filter((p) => veOPlano(eu, p))
    .filter((p) => !f.equipe_id || p.equipe?.id === f.equipe_id)
    .filter((p) => !termo || [p.titulo, p.planoManutencao, p.itemManutencao, p.equipamento, p.local?.codigo].some((c) => c && normalizar(c).includes(termo)));
  const contagem = Object.fromEntries(SITUACOES_DO_CICLO.map((s) => [s, 0])) as Record<SituacaoDoCiclo, number>;
  for (const p of visiveis) contagem[p.situacao]++;
  const lista = visiveis.filter((p) => !f.situacao || p.situacao === f.situacao).sort(ordenar);
  return {
    hoje,
    contagem: { ...contagem, total: visiveis.length },
    planos: lista.map((p) => {
      const { checklist, ...resto } = semControle(p);
      return { ...resto, totalPerguntas: checklist.length, podeEditar: podeEditarPlano(eu, p) };
    }),
  };
}

/** O que só o servidor usa (o controle dos alertas) não vai para a tela. */
function semControle(p: PlanoCalculado) {
  const { alertaProximoPara: _p, alertaVencidoPara: _v, ...resto } = p;
  return resto;
}

/** Quantas datas futuras do plano a tela mostra. */
const DATAS_PROJETADAS = 6;

/**
 * Um plano com o histórico dos ciclos (as OS dele, da mais recente à mais antiga) e as próximas datas. Em cada ciclo, o
 * `previsto` é o vencimento que o ciclo anterior marcou (a referência dele mais o intervalo) e o `atraso_dias`, o quanto o
 * encerramento passou da data limite da própria OS (o fim programado, ou o início sem ele), como no indicador de atraso.
 */
export async function detalharPlano(db: Db, eu: UsuarioAutenticado, id: string, agora: Date) {
  const { hoje, planos, osPorPlano } = await calcularPlanos(db, agora, [id]);
  const p = planos[0];
  if (!p || !veOPlano(eu, p)) throw naoEncontrado("Plano de preventiva não encontrado");
  const lista = osPorPlano.get(id) ?? [];

  const ciclos = lista.map((o, i) => {
    const anterior = lista[i + 1];
    const refAnterior = anterior ? (p.baseDoCiclo === "programacao" ? anterior.dataInicioProg : anterior.encerradaEm) : null;
    const previsto = p.intervalo && refAnterior ? somarIntervalo(refAnterior, p.intervalo) : null;
    const limite = dataDeReferencia(o);
    const atrasoDias = o.encerradaEm ? Math.max(0, diasEntre(limite, o.encerradaEm)) : ABERTAS.includes(o.status) && limite < hoje ? diasEntre(limite, hoje) : null;
    return {
      osId: o.id,
      numeroOrdem: o.numeroOrdem,
      titulo: o.titulo,
      status: o.status,
      equipeNome: o.equipeNome,
      dataInicioProg: o.dataInicioProg,
      dataFimProg: o.dataFimProg,
      encerradaEm: o.encerradaEm,
      previsto,
      atrasoDias,
      noPrazo: o.encerradaEm ? o.encerradaEm <= limite : null,
    };
  });

  const encerrados = ciclos.filter((c) => c.encerradaEm !== null);
  const datas = encerrados.map((c) => c.encerradaEm!).sort();
  const intervalos = datas.slice(1).map((d, i) => diasEntre(datas[i]!, d));
  const estatisticas = {
    ciclosEncerrados: encerrados.length,
    noPrazo: encerrados.filter((c) => c.noPrazo).length,
    comAtraso: encerrados.filter((c) => c.noPrazo === false).length,
    /** Média, em dias, entre um encerramento e o seguinte: o intervalo que o plano cumpre de fato. */
    intervaloRealMedioDias: intervalos.length > 0 ? Math.round(intervalos.reduce((s, n) => s + n, 0) / intervalos.length) : null,
    /** O intervalo definido, em dias, para comparar com o real (meses contam como 30,4 dias). */
    intervaloDefinidoDias: p.intervalo ? Math.round((DIAS_DA_UNIDADE[p.intervalo.unidade] ?? MESES_DA_UNIDADE[p.intervalo.unidade]! * 30.4375) * p.intervalo.quantidade) : null,
  };

  const proximasDatas = p.intervalo && p.referencia && p.situacao !== "pausado" ? Array.from({ length: DATAS_PROJETADAS }, (_, k) => somarIntervalo(p.referencia!, p.intervalo!, k + 1)) : [];

  return { hoje, plano: { ...semControle(p), podeEditar: podeEditarPlano(eu, p) }, ciclos, estatisticas, proximasDatas };
}

/** O plano da OS (pela chave plano + item), para o detalhe da OS. `null` quando a OS não é preventiva de plano. */
export async function planoDaOs(db: Db, eu: UsuarioAutenticado, osId: string, agora: Date) {
  const [o] = await db.select({ tipo: os.tipo, plano: os.planoManutencao, item: os.itemManutencao }).from(os).where(eq(os.id, osId));
  const chave = o?.tipo === "preventiva" ? chaveDoPlano(o.plano, o.item) : null;
  if (!chave) return null;
  const [p] = await db
    .select({ id: planoPreventiva.id })
    .from(planoPreventiva)
    .where(and(eq(planoPreventiva.planoManutencao, chave.plano), chave.item === null ? sql`${planoPreventiva.itemManutencao} is null` : eq(planoPreventiva.itemManutencao, chave.item)));
  if (!p) return null;
  const { planos } = await calcularPlanos(db, agora, [p.id]);
  const calculado = planos[0]!;
  if (!veOPlano(eu, calculado)) return null;
  return { ...semControle(calculado), podeEditar: podeEditarPlano(eu, calculado), ehUltimaDoPlano: calculado.ultimaOs?.id === osId };
}

// ---- Edição ----------------------------------------------------------------------------------------------------

export const esquemaEdicaoDoPlano = z.object({
  /** `null` tira o intervalo (o plano volta a "sem intervalo"). */
  intervalo: esquemaIntervalo.nullable().optional(),
  base_do_ciclo: z.enum(CICLO_BASES).optional(),
  antecedencia_dias: z.number().int("Use um número inteiro de dias").min(0, "A antecedência não pode ser negativa").max(365, "No máximo 365 dias").optional(),
  ativo: z.boolean().optional(),
  /** O checklist de inspeção inteiro, na ordem: a lista recebida passa a ser a do plano (ver `salvarChecklist`). */
  checklist: esquemaChecklist.optional(),
  observacao: z
    .string()
    .trim()
    .max(500, "No máximo 500 caracteres")
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null)),
});
export type EdicaoDoPlano = z.infer<typeof esquemaEdicaoDoPlano>;

/** Os campos que a auditoria compara (o checklist entra como a lista dos textos, na ordem). */
const retrato = (p: PlanoCalculado) => ({
  intervalo: p.intervaloDescricao,
  base_do_ciclo: p.baseDoCiclo,
  antecedencia_dias: p.antecedenciaDias,
  ativo: p.ativo,
  observacao: p.observacao,
  checklist: p.checklist.map((c) => c.texto),
});

/**
 * Define o intervalo e as regras do ciclo. Mudar o intervalo, a base ou a antecedência muda o vencimento, então os alertas
 * do ciclo podem sair de novo para o vencimento novo. Devolve o antes e o depois, para a auditoria.
 */
export async function editarPlano(db: Db, eu: UsuarioAutenticado, id: string, dados: EdicaoDoPlano, agora: Date) {
  const { planos } = await calcularPlanos(db, agora, [id]);
  const antes = planos[0];
  if (!antes || !veOPlano(eu, antes)) throw naoEncontrado("Plano de preventiva não encontrado");
  if (!podeEditarPlano(eu, antes)) throw proibido("Só o administrador e o supervisor da equipe definem o intervalo e o checklist da preventiva");

  // Definir o intervalo de um plano que estava sem pontua o supervisor (na mesma transação que grava o intervalo).
  const definiuAgora = dados.intervalo != null && antes.intervalo === null;
  const ganhos = await db.transaction(async (transacao) => {
    const tx = transacao as unknown as Db;
    await tx
      .update(planoPreventiva)
      .set({
        ...(dados.intervalo !== undefined && {
          intervaloQuantidade: dados.intervalo?.quantidade ?? null,
          intervaloUnidade: dados.intervalo?.unidade ?? null,
        }),
        ...(dados.base_do_ciclo !== undefined && { contarAPartir: dados.base_do_ciclo }),
        ...(dados.antecedencia_dias !== undefined && { antecedenciaDias: dados.antecedencia_dias }),
        ...(dados.ativo !== undefined && { ativo: dados.ativo }),
        ...(dados.observacao !== undefined && { observacao: dados.observacao }),
        atualizadoEm: agora,
        atualizadoPor: eu.id,
      })
      .where(eq(planoPreventiva.id, id));
    if (dados.checklist !== undefined) await salvarChecklist(tx, id, dados.checklist);
    return definiuAgora && eu.perfil === "tecnico" ? pontuarIntervalo({ tx, agora }, id, eu.id, agora) : [];
  });

  const depois = (await calcularPlanos(db, agora, [id])).planos[0]!;
  return { antes: retrato(antes), depois: retrato(depois), plano: depois, ...ganhosDe(ganhos, eu.id) };
}

/** Como o plano aparece na trilha e nos alertas: o título da última OS e o plano/item. */
export const rotuloDoPlano = (p: Pick<PlanoCalculado, "titulo" | "planoManutencao" | "itemManutencao">) =>
  `${p.titulo ? `"${p.titulo}" ` : ""}(plano ${p.planoManutencao}${p.itemManutencao ? `, item ${p.itemManutencao}` : ""})`;

/**
 * Depois de gravadas as ordens: confere o ciclo dos planos de preventiva que elas tocaram (uma OS antiga importada agora
 * pode deixar o ciclo vencido). Uma falha aqui não desfaz a importação: o executor de tarefas confere de novo depois.
 */
export async function conferirCiclosDaImportacao(db: Db, agora: Date, planos: string[]) {
  if (planos.length === 0) return;
  try {
    await verificarCiclos(db, agora, planos);
  } catch (erro) {
    console.error("Falha ao conferir o ciclo das preventivas importadas", erro);
  }
}

// ---- Alertas do ciclo ------------------------------------------------------------------------------------------

const emDias = (n: number) => (n === 1 ? "1 dia" : `${n} dias`);

function detalheDoAlerta(p: PlanoCalculado, tipo: "preventiva_proxima" | "preventiva_vencida"): string {
  const ultima = p.ultimaOs!;
  const numero = ultima.numeroOrdem ? `OS ${ultima.numeroOrdem}` : "última OS";
  const base =
    p.baseDoCiclo === "programacao"
      ? `programada para ${diaBr(ultima.dataInicioProg)}`
      : `encerrada em ${diaBr(ultima.encerradaEm ?? ultima.dataInicioProg)}`;
  const quando =
    tipo === "preventiva_vencida"
      ? `venceu em ${diaBr(p.proximoCiclo!)} (há ${emDias(-p.diasRestantes!)})`
      : p.diasRestantes === 0
        ? `vence hoje (${diaBr(p.proximoCiclo!)})`
        : `vence em ${diaBr(p.proximoCiclo!)}, daqui a ${emDias(p.diasRestantes!)}`;
  const acao = tipo === "preventiva_vencida" ? "Nenhuma OS nova do plano chegou: confira a programação no SAP." : "Confira se a OS do próximo ciclo já está programada no SAP.";
  return `O próximo ciclo da preventiva ${rotuloDoPlano(p)}, ${p.intervaloDescricao}, ${quando}. Último ciclo: ${numero}, ${base}. ${acao}`;
}

/**
 * Confere o ciclo de todos os planos (ou dos pedidos) e cria os alertas que faltam: `preventiva_proxima` quando o
 * vencimento entra na antecedência e `preventiva_vencida` quando passa, cada um uma vez por vencimento, para o supervisor
 * da equipe da última OS (sem supervisor, os administradores). O alerta aponta para a última OS do plano. Roda no executor
 * de tarefas, depois de cada importação e de cada edição do plano. Devolve quantos alertas criou.
 */
export async function verificarCiclos(db: Db, agora: Date, ids?: string[]): Promise<number> {
  const { planos } = await calcularPlanos(db, agora, ids);
  let criados = 0;
  for (const p of planos) {
    if ((p.situacao !== "proximo" && p.situacao !== "vencido") || !p.ultimaOs || !p.equipe || !p.proximoCiclo) continue;
    const vencido = p.situacao === "vencido";
    if (vencido ? p.alertaVencidoPara === p.proximoCiclo : p.alertaProximoPara === p.proximoCiclo) continue;
    const tipo = vencido ? "preventiva_vencida" : "preventiva_proxima";
    await db.transaction(async (tx) => {
      const t = tx as unknown as Db;
      // Marca antes de criar: se outra rodada chegou primeiro, a condição não casa e nada é criado.
      const marcados = await t
        .update(planoPreventiva)
        .set(vencido ? { alertaVencidoPara: p.proximoCiclo, alertaProximoPara: p.proximoCiclo } : { alertaProximoPara: p.proximoCiclo })
        .where(
          and(
            eq(planoPreventiva.id, p.id),
            sql`${vencido ? planoPreventiva.alertaVencidoPara : planoPreventiva.alertaProximoPara} is distinct from ${p.proximoCiclo}`,
          ),
        )
        .returning({ id: planoPreventiva.id });
      if (marcados.length === 0) return;
      const ids = await criarAlertas(t, { tipo, osId: p.ultimaOs!.id, equipeId: p.equipe!.id, detalhe: detalheDoAlerta(p, tipo), planoPreventivaId: p.id });
      criados += ids.length;
    });
  }
  return criados;
}
