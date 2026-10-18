import "server-only";

import { api, apiOuNulo } from "@/lib/api";
import { pedemAtencao, type ListaDePreventivas } from "@/lib/preventivas";
import { ehAdmin, ehSupervisor, type Equipe, type OsStatus, type Paginacao, type ResponsavelDaOs, type Usuario } from "@/lib/tipos";

/** OS como a `api` a devolve em `GET /os` (quadro). */
export interface OsDoQuadro {
  id: string;
  numero_ordem: string | null;
  numero_nota: string | null;
  tipo: "preventiva" | "corretiva";
  titulo: string;
  status: OsStatus;
  equipe_id: string;
  equipe_nome: string;
  local_instalacao: { id: string; codigo: string; cliente: string | null; critico: boolean };
  equipamento: string | null;
  prioridade: string | null;
  data_inicio_prog: string;
  data_fim_prog: string | null;
  pdf_pronto: boolean;
  ciencia_em: string | null;
  /** A pessoa para quem o supervisor reservou a OS; `null` = a OS é da equipe toda. */
  responsavel: ResponsavelDaOs | null;
  /** Há quantas horas a execução em andamento está aberta, só quando passa do limite da `api` (12 h). */
  execucao_aberta_ha_horas: number | null;
  atrasada: boolean;
}

export type ContagemPorStatus = Record<OsStatus, number>;

export interface RespostaOs extends Paginacao {
  os: OsDoQuadro[];
  contagem_por_status: ContagemPorStatus;
}

/** Filtros do quadro, como vêm da URL. */
export interface FiltrosDoQuadro {
  equipe_id?: string;
  tipo?: "preventiva" | "corretiva";
  critica?: boolean;
  periodo?: string;
  busca?: string;
  /** Ordem dos cartões: por prioridade (padrão) ou pela data limite. */
  ordem?: "prioridade" | "data_limite";
  /** Quando presente, o quadro mostra só esse status, paginado. */
  status?: OsStatus;
  pagina?: number;
}

/**
 * Os status que o quadro carrega, um a um. `encerrando` e `aguardando_supervisor` (as assinaturas do fim) aparecem juntos numa
 * coluna só, "Aguardando assinaturas" (ver `STATUS_DAS_ASSINATURAS`). `cancelada` e `devolvida` ficam fora e aparecem como links de contagem.
 */
export const STATUS_DO_QUADRO = ["liberada", "pendente", "em_execucao", "aguardando_supervisor", "encerrando", "encerrada"] as const;

/** Os dois passos entre o fim da execução e a conclusão, que dividem a coluna "Aguardando assinaturas" (a do supervisor vem primeiro: é a que pede ação dele). */
export const STATUS_DAS_ASSINATURAS = ["aguardando_supervisor", "encerrando"] as const satisfies readonly OsStatus[];

/** Quantos cartões cada coluna mostra antes do "Ver todas". */
export const CARTOES_POR_COLUNA = 8;
/** Tamanho da página quando só um status é mostrado. */
export const TAMANHO_DA_LISTA = 24;

const consultaDe = (f: FiltrosDoQuadro) => ({
  equipe_id: f.equipe_id,
  tipo: f.tipo,
  critica: f.critica,
  periodo: f.periodo,
  busca: f.busca,
  ordem: f.ordem,
});

export interface DadosDoQuadro {
  /** Uma entrada por coluna (sem `status`) ou uma só, paginada (com `status`). */
  colunas: { status: OsStatus; os: OsDoQuadro[]; total: number }[];
  contagem: ContagemPorStatus;
  pagina: number;
  tamanho: number;
}

/** Carrega o quadro: uma consulta por status em paralelo (as duas das assinaturas viram uma coluna só) ou, com `status`, a lista paginada dele. */
export async function carregarQuadro(filtros: FiltrosDoQuadro): Promise<DadosDoQuadro> {
  const base = consultaDe(filtros);
  if (filtros.status) {
    const pagina = filtros.pagina ?? 1;
    const r = await api<RespostaOs>("/os", { consulta: { ...base, status: filtros.status, pagina, tamanho: TAMANHO_DA_LISTA } });
    return { colunas: [{ status: filtros.status, os: r.os, total: r.contagem_por_status[filtros.status] }], contagem: r.contagem_por_status, pagina: r.pagina, tamanho: r.tamanho };
  }
  const respostas = await Promise.all(STATUS_DO_QUADRO.map((status) => api<RespostaOs>("/os", { consulta: { ...base, status, tamanho: CARTOES_POR_COLUNA } })));
  return {
    colunas: STATUS_DO_QUADRO.map((status, i) => ({ status, os: respostas[i]!.os, total: respostas[i]!.contagem_por_status[status] })),
    contagem: respostas[0]!.contagem_por_status,
    pagina: 1,
    tamanho: CARTOES_POR_COLUNA,
  };
}

/** Id da OS cujo número de ordem é exatamente `busca`, se houver uma só (a busca do quadro vai direto ao detalhe). */
export async function osPorNumeroExato(busca: string): Promise<string | null> {
  const r = await api<RespostaOs>("/os", { consulta: { numero_ordem: busca.trim(), tamanho: 2 } });
  return r.os.length === 1 ? r.os[0]!.id : null;
}

/** Alertas não lidos do usuário (supervisor) ou de todos (admin). O técnico que não supervisiona não tem alertas. */
export async function totalDeAlertasNaoLidos(usuario: Pick<Usuario, "perfil" | "equipes_supervisionadas">): Promise<number> {
  if (!ehAdmin(usuario) && !ehSupervisor(usuario)) return 0;
  const r = await apiOuNulo<{ total: number }>("/alertas", { consulta: { lido: false, tamanho: 1 } });
  return r?.total ?? 0;
}

/**
 * Quantos planos de preventiva pedem atenção (ciclo vencido ou próximo do vencimento), para o selo do botão "OS
 * preventivas" do quadro. Uma falha aqui não derruba o quadro: o selo some.
 */
export async function preventivasEmAtencao(equipeId?: string): Promise<number> {
  try {
    const r = await api<ListaDePreventivas>("/preventivas", { consulta: { equipe_id: equipeId } });
    return pedemAtencao(r.contagem);
  } catch {
    return 0;
  }
}

export async function listarEquipes(): Promise<Equipe[]> {
  return (await api<{ equipes: Equipe[] }>("/equipes", { consulta: { tamanho: 200 } })).equipes;
}

/** Meses para o seletor de período: do mês atual para trás (12) e dois à frente, no fuso de São Paulo. */
export function mesesDoSeletor(hoje: string, extra?: string): { valor: string; rotulo: string }[] {
  const [a, m] = hoje.split("-").map(Number) as [number, number];
  const valores: string[] = [];
  for (let i = -2; i <= 12; i++) {
    const total = a * 12 + (m - 1) - i;
    valores.push(`${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`);
  }
  if (extra && !valores.includes(extra)) valores.push(extra);
  return valores.sort().reverse().map((valor) => ({ valor, rotulo: rotuloDoMes(valor) }));
}

const NOMES_DOS_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** `2026-10` → `outubro de 2026`. */
export function rotuloDoMes(mes: string): string {
  const [a, m] = mes.split("-");
  return `${NOMES_DOS_MESES[Number(m) - 1] ?? m} de ${a}`;
}
