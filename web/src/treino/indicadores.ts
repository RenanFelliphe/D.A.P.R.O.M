/**
 * Dashboards do Campo de treino (`GET /indicadores/os`, `/indicadores/equipes`, `/indicadores/meus` e
 * `/aprs/resumo`), calculados sobre o estado em memória com as regras de `api/src/dominio/dashboards.ts`,
 * `painel-indicadores.ts`, `meus-resultados.ts`, `apr-resumo.ts` e `periodo.ts`. O treino é só do técnico que não supervisiona,
 * então vale o que a `api` devolve a ele: só a equipe do treino, nada por pessoa (sem o executor nas listas, sem a lista de
 * técnicos), sem as pendências de gestão e sem a classificação dos itens da APR. Não há reprogramação no treino: a preventiva
 * atrasada só se justifica pela OS pendente.
 */
import type { DashboardEquipes, DashboardMeus, DashboardOs } from "../data/dashboards";
import type { ResumoDasAprs } from "../data/modelos";
import type { AprReg, EstadoTreino, ExecucaoReg, OsReg } from "./dados";
import { diaDe } from "./dados";
import { PAUSA_MOTIVOS } from "./motivos";

// ---------------------------------------------------------------------------------------------------------------
// Período (como `api/src/dominio/periodo.ts`)
// ---------------------------------------------------------------------------------------------------------------

type Agrupamento = "dia" | "semana" | "mes";

interface FaixaDeDias {
  inicio: string;
  fim: string;
}

const PERIODOS_MOVEIS = ["7d", "30d", "90d", "12m"];
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

/** O `?periodo=` dos dashboards (30 dias quando não vem), ou `null` quando a `api` o recusaria. */
export const periodoDoFiltro = (valor: string | undefined): string | null =>
  valor === undefined ? "30d" : PERIODOS_MOVEIS.includes(valor) || MES.test(valor) ? valor : null;

const paraDia = (d: Date) => d.toISOString().slice(0, 10);
const partes = (dia: string) => dia.split("-").map(Number) as [number, number, number];

function somarDias(dia: string, n: number): string {
  const [a, m, d] = partes(dia);
  return paraDia(new Date(Date.UTC(a, m - 1, d + n)));
}

function inicioDoMes(dia: string, n = 0): string {
  const [a, m] = partes(dia);
  return paraDia(new Date(Date.UTC(a, m - 1 + n, 1)));
}

function segundaFeira(dia: string): string {
  const [a, m, d] = partes(dia);
  return somarDias(dia, -((new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7));
}

/** As faixas do período, o intervalo `[inicio, fim)` inteiro, o período anterior e o `de`/`ate` que a tela mostra. */
function resolverPeriodo(periodo: string, hoje: string) {
  let agrupamento: Agrupamento;
  let faixas: FaixaDeDias[];
  let anterior: FaixaDeDias;
  if (MES.test(periodo)) {
    const inicio = `${periodo}-01`;
    const fim = inicioDoMes(inicio, 1);
    const dias = Math.round((Date.parse(fim) - Date.parse(inicio)) / 86_400_000);
    agrupamento = "dia";
    faixas = Array.from({ length: dias }, (_, i) => ({ inicio: somarDias(inicio, i), fim: somarDias(inicio, i + 1) }));
    anterior = { inicio: inicioDoMes(inicio, -1), fim: inicio };
  } else {
    const [grupo, n, inicioDa]: [Agrupamento, number, (i: number) => string] =
      periodo === "7d"
        ? ["dia", 7, (i) => somarDias(hoje, i - 6)]
        : periodo === "30d"
          ? ["dia", 30, (i) => somarDias(hoje, i - 29)]
          : periodo === "90d"
            ? ["semana", 13, (i) => somarDias(segundaFeira(hoje), 7 * (i - 12))]
            : ["mes", 12, (i) => inicioDoMes(hoje, i - 11)];
    agrupamento = grupo;
    faixas = Array.from({ length: n }, (_, i) => ({ inicio: inicioDa(i), fim: inicioDa(i + 1) }));
    anterior = { inicio: inicioDa(-n), fim: inicioDa(0) };
  }
  const inicio = faixas[0]!.inicio;
  const fim = faixas.at(-1)!.fim;
  const ultimoDia = somarDias(fim, -1);
  return { periodo, agrupamento, faixas, anterior, inicio, fim, de: inicio, ate: hoje < ultimoDia ? hoje : ultimoDia };
}

type PeriodoResolvido = ReturnType<typeof resolverPeriodo>;

const entre = (dia: string, inicio: string, fim: string) => dia >= inicio && dia < fim;
const faixaDoDia = <T extends FaixaDeDias>(faixas: T[], dia: string) => faixas.find((f) => entre(dia, f.inicio, f.fim));
const cabecalho = (p: PeriodoResolvido) => ({ periodo: p.periodo, agrupamento: p.agrupamento, de: p.de, ate: p.ate });

// ---------------------------------------------------------------------------------------------------------------
// Contagens
// ---------------------------------------------------------------------------------------------------------------

const HORAS_DE_EXECUCAO_ESQUECIDA = 12;
const INTERRUPCOES_RECENTES = 5;
const LOCAIS_NO_RANKING = 6;
const OS_COM_MAIS_PAUSA = 5;
/** Os motivos de pausa do app, na ordem em que aparecem; `sem_motivo` é a pausa antiga, registrada sem escolher um (hoje o motivo é obrigatório). */
const MOTIVOS_DE_PAUSA = [...PAUSA_MOTIVOS, "sem_motivo"] as const;
type MotivoDaPausa = (typeof MOTIVOS_DE_PAUSA)[number];

const arredondar = (valor: number, casas = 1) => Math.round(valor * 10 ** casas) / 10 ** casas;
const emMinutos = (ms: number) => Math.round(ms / 60_000);
const ms = (instante: string) => new Date(instante).getTime();

/** As OS da equipe do treino (o escopo do técnico) e um acesso por id. */
function escopo(e: EstadoTreino) {
  const os = e.os.filter((o) => o.equipe_id === e.equipe.id);
  const porId = new Map(os.map((o) => [o.id, o]));
  return {
    os,
    porId,
    execucoes: e.execucoes.filter((x) => porId.has(x.os_id)),
    aprs: e.aprs.filter((a) => porId.has(a.os_id)),
  };
}

const ABERTAS: OsReg["status"][] = ["liberada", "pendente", "em_execucao"];
const referencia = (o: OsReg) => o.data_fim_prog ?? o.data_inicio_prog;
const critico = (e: EstadoTreino, o: OsReg) => e.locais.find((l) => l.id === o.local_instalacao_id)?.critico ?? false;

/** Foto da carteira agora: OS abertas por status, as atrasadas, as de local crítico e as de apoio ainda abertas. */
function carteira(e: EstadoTreino, os: OsReg[], hoje: string) {
  const abertas = os.filter((o) => ABERTAS.includes(o.status));
  return {
    liberadas: os.filter((o) => o.status === "liberada").length,
    pendentes: os.filter((o) => o.status === "pendente").length,
    em_execucao: os.filter((o) => o.status === "em_execucao").length,
    atrasadas: os.filter((o) => (o.status === "liberada" || o.status === "pendente") && referencia(o) < hoje).length,
    criticas: abertas.filter((o) => critico(e, o)).length,
    apoio_abertas: abertas.filter((o) => o.origem === "apoio").length,
  };
}

/** OS encerradas por faixa e por tipo, pelo fim da execução que as encerrou, e o total do período anterior. */
function encerradas(execucoes: ExecucaoReg[], porId: Map<string, OsReg>, p: PeriodoResolvido) {
  const serie = p.faixas.map((f) => ({ ...f, corretivas: 0, preventivas: 0 }));
  const totais = { total: 0, anterior: 0, corretivas: 0, preventivas: 0 };
  for (const x of execucoes) {
    if (x.resultado !== "encerrada" || !x.fim) continue;
    const dia = diaDe(x.fim);
    if (!entre(dia, p.anterior.inicio, p.fim)) continue;
    if (dia < p.inicio) {
      totais.anterior++;
      continue;
    }
    const ponto = faixaDoDia(serie, dia);
    if (!ponto) continue;
    const chave = porId.get(x.os_id)?.tipo === "preventiva" ? "preventivas" : "corretivas";
    ponto[chave]++;
    totais[chave]++;
    totais.total++;
  }
  return { ...totais, serie };
}

/** APRs concluídas no período e no anterior, com as bloqueadas. */
function contarAprs(aprs: AprReg[], p: PeriodoResolvido) {
  const saida = { total: 0, bloqueadas: 0, anterior: 0, bloqueadas_anterior: 0 };
  for (const a of aprs) {
    const dia = diaDe(a.concluida_em);
    const bloqueada = a.resultado === "bloqueada" ? 1 : 0;
    if (entre(dia, p.inicio, p.fim)) {
      saida.total++;
      saida.bloqueadas += bloqueada;
    } else if (entre(dia, p.anterior.inicio, p.anterior.fim)) {
      saida.anterior++;
      saida.bloqueadas_anterior += bloqueada;
    }
  }
  return saida;
}

/** Execuções interrompidas por risco no período: o total e as mais recentes, com o motivo. */
function interrupcoes(e: EstadoTreino, execucoes: ExecucaoReg[], porId: Map<string, OsReg>, p: PeriodoResolvido, comExecutor: boolean) {
  const no = execucoes
    .filter((x) => x.resultado === "interrompida" && x.fim && entre(diaDe(x.fim), p.inicio, p.fim))
    .sort((a, b) => ms(b.fim!) - ms(a.fim!));
  return {
    total: no.length,
    recentes: no.slice(0, INTERRUPCOES_RECENTES).map((x) => {
      const o = porId.get(x.os_id)!;
      return { os_id: o.id, numero_ordem: o.numero_ordem, titulo: o.titulo, motivo: x.motivo, fim: x.fim!, executor: comExecutor ? (e.usuarios.find((u) => u.id === x.executor_id)?.nome ?? null) : null };
    }),
  };
}

/**
 * Situação das preventivas programadas no período (`data_inicio_prog`): encerradas; atrasadas justificadas (abertas, pendentes
 * e com a data de referência já passada); atrasadas sem justificativa (liberadas com a data já passada).
 */
function situacaoDasPreventivas(os: OsReg[], p: PeriodoResolvido, hoje: string) {
  const doPeriodo = os.filter((o) => o.tipo === "preventiva" && entre(o.data_inicio_prog, p.inicio, p.fim));
  const passou = (o: OsReg) => referencia(o) < hoje;
  return {
    encerradas: doPeriodo.filter((o) => o.status === "encerrada").length,
    atrasadas_justificadas: doPeriodo.filter((o) => o.status === "pendente" && passou(o)).length,
    atrasadas_sem_justificativa: doPeriodo.filter((o) => o.status === "liberada" && passou(o)).length,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Tempo de execução (como `temposDeExecucao`)
// ---------------------------------------------------------------------------------------------------------------

interface TempoMedido {
  totalMs: number;
  pausaMs: number;
  liquidoMs: number;
  pausas: number;
}

const SEM_MEDIDA = { execucoes: 0, tempo_total_medio_min: null, tempo_liquido_medio_min: null, pausa_media_min: null, proporcao_pausa: null, execucoes_com_pausa: 0, pausas_por_execucao: null };

function medir(tempos: TempoMedido[]) {
  const n = tempos.length;
  if (n === 0) return SEM_MEDIDA;
  const total = tempos.reduce((t, x) => t + x.totalMs, 0);
  const pausa = tempos.reduce((t, x) => t + x.pausaMs, 0);
  const liquido = tempos.reduce((t, x) => t + x.liquidoMs, 0);
  return {
    execucoes: n,
    tempo_total_medio_min: arredondar(total / n / 60_000),
    tempo_liquido_medio_min: arredondar(liquido / n / 60_000),
    pausa_media_min: arredondar(pausa / n / 60_000),
    proporcao_pausa: total > 0 ? arredondar(pausa / total, 4) : null,
    execucoes_com_pausa: tempos.filter((x) => x.pausaMs > 0).length,
    pausas_por_execucao: arredondar(tempos.reduce((t, x) => t + x.pausas, 0) / n),
  };
}

/**
 * O tempo das execuções encerradas iniciadas no período (a pausa aberta vale até o fim da execução), com a pausa por motivo
 * e as OS com mais tempo em pausa; `comExecutor: false` tira o nome de quem executou dessa lista.
 */
function temposDeExecucao(e: EstadoTreino, execucoes: ExecucaoReg[], porId: Map<string, OsReg>, p: PeriodoResolvido, comExecutor: boolean) {
  const porMotivo = new Map<MotivoDaPausa, { pausas: number; ms: number }>();
  const medidas = execucoes
    .filter((x) => x.resultado === "encerrada" && x.fim && entre(diaDe(x.inicio), p.inicio, p.fim))
    .map((x) => {
      const [inicio, fim] = [ms(x.inicio), ms(x.fim!)];
      let pausaMs = 0;
      let pausas = 0;
      for (const pausa of x.pausas) {
        const dentro = Math.min(pausa.fim ? ms(pausa.fim) : fim, fim) - Math.max(ms(pausa.inicio), inicio);
        if (dentro <= 0) continue;
        pausaMs += dentro;
        pausas++;
        const motivo: MotivoDaPausa = pausa.motivo ?? "sem_motivo";
        const soma = porMotivo.get(motivo) ?? { pausas: 0, ms: 0 };
        porMotivo.set(motivo, { pausas: soma.pausas + 1, ms: soma.ms + dentro });
      }
      return { x, tempo: { totalMs: fim - inicio, pausaMs, liquidoMs: fim - inicio - pausaMs, pausas } };
    });

  const osComMaisPausa = medidas
    .filter((m) => m.tempo.pausaMs > 0)
    .sort((a, b) => b.tempo.pausaMs - a.tempo.pausaMs || ms(b.x.fim!) - ms(a.x.fim!))
    .slice(0, OS_COM_MAIS_PAUSA)
    .map(({ x, tempo }) => {
      const o = porId.get(x.os_id)!;
      return {
        os_id: o.id,
        numero_ordem: o.numero_ordem,
        titulo: o.titulo,
        executor: comExecutor ? (e.usuarios.find((u) => u.id === x.executor_id)?.nome ?? null) : null,
        fim: x.fim!,
        tempo_total_min: emMinutos(tempo.totalMs),
        tempo_liquido_min: emMinutos(tempo.liquidoMs),
        pausa_min: emMinutos(tempo.pausaMs),
        pausas: tempo.pausas,
        proporcao_pausa: tempo.totalMs > 0 ? arredondar(tempo.pausaMs / tempo.totalMs, 4) : null,
      };
    });

  return {
    ...medir(medidas.map((m) => m.tempo)),
    por_motivo: MOTIVOS_DE_PAUSA.filter((m) => porMotivo.has(m)).map((motivo) => ({ motivo, pausas: porMotivo.get(motivo)!.pausas, minutos: emMinutos(porMotivo.get(motivo)!.ms) })),
    os_com_mais_pausa: osComMaisPausa,
  };
}

/** Os locais com mais OS encerradas no período. */
function locais(e: EstadoTreino, execucoes: ExecucaoReg[], porId: Map<string, OsReg>, p: PeriodoResolvido) {
  const contagem = new Map<string, number>();
  for (const x of execucoes) {
    if (x.resultado !== "encerrada" || !x.fim || !entre(diaDe(x.fim), p.inicio, p.fim)) continue;
    const local = porId.get(x.os_id)!.local_instalacao_id;
    contagem.set(local, (contagem.get(local) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .map(([id, n]) => {
      const l = e.locais.find((x) => x.id === id)!;
      return { id, codigo: l.codigo, critico: l.critico, encerradas: n };
    })
    .sort((a, b) => b.encerradas - a.encerradas || a.codigo.localeCompare(b.codigo, "pt-BR"))
    .slice(0, LOCAIS_NO_RANKING);
}

// ---------------------------------------------------------------------------------------------------------------
// Dashboards
// ---------------------------------------------------------------------------------------------------------------

/** `GET /indicadores/os`. */
export function dashboardDeOs(e: EstadoTreino, periodo: string, agora: Date): DashboardOs {
  const hoje = diaDe(agora);
  const p = resolverPeriodo(periodo, hoje);
  const { os, porId, execucoes } = escopo(e);
  const { serie, ...fechadas } = encerradas(execucoes, porId, p);
  const programadas = os.filter((o) => entre(o.data_inicio_prog, p.inicio, p.fim));
  const ativas = programadas.filter((o) => o.status !== "cancelada");
  const esquecida = agora.getTime() - HORAS_DE_EXECUCAO_ESQUECIDA * 3_600_000;
  return {
    ...cabecalho(p),
    carteira: carteira(e, os, hoje),
    programadas: {
      total: ativas.length,
      corretivas: ativas.filter((o) => o.tipo === "corretiva").length,
      preventivas: ativas.filter((o) => o.tipo === "preventiva").length,
      canceladas: programadas.length - ativas.length,
    },
    encerradas: fechadas,
    serie,
    preventivas: situacaoDasPreventivas(os, p, hoje),
    tempo: temposDeExecucao(e, execucoes, porId, p, false),
    interrupcoes: interrupcoes(e, execucoes, porId, p, false),
    reprogramacoes: 0,
    locais: locais(e, execucoes, porId, p),
    // As pendências de gestão (baixa no SAP e ciência) não são do técnico.
    pendencias: { a_exportar: null, sem_ciencia: null, execucoes_esquecidas: execucoes.filter((x) => x.resultado === null && ms(x.inicio) < esquecida).length },
  };
}

/** `GET /indicadores/equipes` ("Minha equipe"): a equipe do treino como um todo, sem nada por pessoa. */
export function dashboardDeEquipes(e: EstadoTreino, periodo: string, agora: Date): DashboardEquipes {
  const hoje = diaDe(agora);
  const p = resolverPeriodo(periodo, hoje);
  const { os, porId, execucoes, aprs } = escopo(e);
  const { os_com_mais_pausa: _os, ...tempo } = temposDeExecucao(e, execucoes, porId, p, false);
  void _os;
  const { por_motivo: _motivos, ...medida } = tempo;
  void _motivos;
  const tecnicos = e.usuarios.filter((u) => u.ativo && u.perfil === "tecnico" && u.equipe_id === e.equipe.id).length;
  const doPeriodo = aprs.filter((a) => entre(diaDe(a.concluida_em), p.inicio, p.fim));
  return {
    ...cabecalho(p),
    totais: { equipes: 1, tecnicos_ativos: tecnicos, tecnicos_com_execucao: null, execucoes: tempo.execucoes, tempo_liquido_medio_min: tempo.tempo_liquido_medio_min },
    tempo,
    equipes: [
      {
        id: e.equipe.id,
        nome: e.equipe.nome,
        supervisor_nome: e.usuarios.find((u) => u.id === e.equipe.supervisor_id)?.nome ?? null,
        tecnicos,
        preventivas: situacaoDasPreventivas(os, p, hoje),
        ...medida,
        aprs: doPeriodo.length,
        aprs_bloqueadas: doPeriodo.filter((a) => a.resultado === "bloqueada").length,
        interrompidas: interrupcoes(e, execucoes, porId, p, false).total,
      },
    ],
    tecnicos: [],
    cadastro: null,
  };
}

/** `GET /indicadores/meus`: só o que o próprio técnico fez (as execuções dele e as APRs que preencheu). */
export function meusResultados(e: EstadoTreino, eu: string, periodo: string, agora: Date): DashboardMeus {
  const p = resolverPeriodo(periodo, diaDe(agora));
  const porId = new Map(e.os.map((o) => [o.id, o]));
  const minhas = e.execucoes.filter((x) => x.executor_id === eu);
  const { serie, ...fechadas } = encerradas(minhas, porId, p);
  return {
    ...cabecalho(p),
    encerradas: fechadas,
    serie,
    tempo: temposDeExecucao(e, minhas, porId, p, false),
    aprs: contarAprs(e.aprs.filter((a) => a.preenchida_por === eu), p),
    interrupcoes: interrupcoes(e, minhas, porId, p, true),
    locais: locais(e, minhas, porId, p),
  };
}

/** `GET /aprs/resumo`, sem os rankings de itens (eles revelariam o que é eliminatório: só o admin os vê). */
export function resumoDasAprs(e: EstadoTreino, periodo: string, agora: Date): ResumoDasAprs {
  const p = resolverPeriodo(periodo, diaDe(agora));
  const { aprs } = escopo(e);
  const serie = p.faixas.map((f) => ({ ...f, aprovadas: 0, bloqueadas: 0 }));
  const totais = { aprovadas: 0, bloqueadas: 0 };
  const anterior = { aprovadas: 0, bloqueadas: 0 };
  const doPeriodo: AprReg[] = [];
  for (const a of aprs) {
    const dia = diaDe(a.concluida_em);
    const chave = a.resultado === "bloqueada" ? "bloqueadas" : "aprovadas";
    if (entre(dia, p.anterior.inicio, p.inicio)) anterior[chave]++;
    const ponto = faixaDoDia(serie, dia);
    if (!ponto) continue;
    ponto[chave]++;
    totais[chave]++;
    doPeriodo.push(a);
  }

  const porModelo = new Map<string, { codigo: string; titulo: string; aprs: number; bloqueadas: number }>();
  const versaoDoTitulo = new Map<string, number>();
  for (const a of doPeriodo) {
    const m = e.modelos.find((x) => x.id === a.modelo_apr_id)!;
    const linha = porModelo.get(m.codigo) ?? { codigo: m.codigo, titulo: m.titulo, aprs: 0, bloqueadas: 0 };
    // O título é o da versão mais nova respondida no período.
    if (m.versao >= (versaoDoTitulo.get(m.codigo) ?? 0)) {
      linha.titulo = m.titulo;
      versaoDoTitulo.set(m.codigo, m.versao);
    }
    linha.aprs++;
    if (a.resultado === "bloqueada") linha.bloqueadas++;
    porModelo.set(m.codigo, linha);
  }

  return {
    ...cabecalho(p),
    totais: {
      aprs: totais.aprovadas + totais.bloqueadas,
      ...totais,
      alertas: null,
    },
    anterior: { aprs: anterior.aprovadas + anterior.bloqueadas, bloqueadas: anterior.bloqueadas },
    serie,
    itens_que_bloqueiam: null,
    alertas_registrados: null,
    por_modelo: [...porModelo.values()].sort((a, b) => b.aprs - a.aprs || a.codigo.localeCompare(b.codigo, "pt-BR")),
    por_equipe: doPeriodo.length ? [{ id: e.equipe.id, nome: e.equipe.nome, aprs: doPeriodo.length, bloqueadas: totais.bloqueadas }] : [],
  };
}
