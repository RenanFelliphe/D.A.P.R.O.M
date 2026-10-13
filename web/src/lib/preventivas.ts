import type { BadgeTone } from "@/components/ui/Badge";
import type { OsStatus } from "./tipos";

/**
 * Intervalo entre ciclos das preventivas, como a `api` devolve em `GET /preventivas`, `GET /preventivas/{id}` e
 * `GET /os/{id}/preventiva`. O sistema não cria OS: ele conta o tempo até o próximo ciclo de cada plano de manutenção e
 * avisa quando o ciclo se aproxima ou vence sem OS nova do plano.
 */

export type IntervaloUnidade = "dia" | "semana" | "quinzena" | "mes" | "bimestre" | "trimestre" | "semestre" | "ano";
export type BaseDoCiclo = "execucao" | "programacao";
export type SituacaoDoCiclo = "vencido" | "proximo" | "aguardando_execucao" | "em_dia" | "sem_intervalo" | "sem_historico" | "pausado";

export interface Intervalo {
  quantidade: number;
  unidade: IntervaloUnidade;
}

export interface PlanoPreventiva {
  id: string;
  plano_manutencao: string;
  item_manutencao: string | null;
  /** Título da última OS do plano. */
  titulo: string | null;
  equipe: { id: string; nome: string } | null;
  local: { id: string; codigo: string } | null;
  equipamento: string | null;
  intervalo: Intervalo | null;
  intervalo_descricao: string | null;
  base_do_ciclo: BaseDoCiclo;
  antecedencia_dias: number;
  ativo: boolean;
  observacao: string | null;
  situacao: SituacaoDoCiclo;
  referencia: string | null;
  proximo_ciclo: string | null;
  /** Negativo quando o ciclo já venceu. */
  dias_restantes: number | null;
  /** 0 no começo do ciclo, 1 no vencimento. */
  progresso: number | null;
  ultima_os: { id: string; numero_ordem: string | null; titulo: string; status: OsStatus; data_inicio_prog: string; data_fim_prog: string | null; encerrada_em: string | null } | null;
  os_abertas: number;
  total_ciclos: number;
  atualizado_em: string;
  pode_editar: boolean;
}

export type ContagemDosCiclos = Record<SituacaoDoCiclo, number> & { total: number };

/** `GET /preventivas`. */
export interface ListaDePreventivas {
  hoje: string;
  contagem: ContagemDosCiclos;
  planos: PlanoPreventiva[];
}

export interface CicloDoPlano {
  os_id: string;
  numero_ordem: string | null;
  titulo: string;
  status: OsStatus;
  equipe_nome: string;
  data_inicio_prog: string;
  data_fim_prog: string | null;
  encerrada_em: string | null;
  /** O vencimento que o ciclo anterior marcou. */
  previsto: string | null;
  atraso_dias: number | null;
  no_prazo: boolean | null;
}

/** `GET /preventivas/{id}` (e a resposta de `PUT /preventivas/{id}`). */
export interface DetalheDoPlano {
  hoje: string;
  plano: PlanoPreventiva;
  ciclos: CicloDoPlano[];
  estatisticas: {
    ciclos_encerrados: number;
    no_prazo: number;
    com_atraso: number;
    intervalo_real_medio_dias: number | null;
    intervalo_definido_dias: number | null;
  };
  proximas_datas: string[];
}

/** `GET /os/{id}/preventiva`. */
export type PlanoDaOs = PlanoPreventiva & { eh_ultima_do_plano: boolean };

export const UNIDADES: { valor: IntervaloUnidade; singular: string; plural: string }[] = [
  { valor: "dia", singular: "dia", plural: "dias" },
  { valor: "semana", singular: "semana", plural: "semanas" },
  { valor: "quinzena", singular: "quinzena (15 dias)", plural: "quinzenas" },
  { valor: "mes", singular: "mês", plural: "meses" },
  { valor: "bimestre", singular: "bimestre", plural: "bimestres" },
  { valor: "trimestre", singular: "trimestre", plural: "trimestres" },
  { valor: "semestre", singular: "semestre", plural: "semestres" },
  { valor: "ano", singular: "ano", plural: "anos" },
];

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

/** "a cada 3 meses"; com quantidade 1, "mensal" (o mesmo texto da `api`). */
export function descreverIntervalo(i: Intervalo): string {
  if (i.quantidade === 1) return ADJETIVOS[i.unidade];
  return `a cada ${i.quantidade} ${UNIDADES.find((u) => u.valor === i.unidade)!.plural}`;
}

export const rotuloDaBase: Record<BaseDoCiclo, string> = {
  execucao: "do encerramento da última OS",
  programacao: "da data programada da última OS",
};

export const SITUACOES: SituacaoDoCiclo[] = ["vencido", "proximo", "aguardando_execucao", "em_dia", "sem_intervalo", "sem_historico", "pausado"];

export const aparenciaDaSituacao: Record<SituacaoDoCiclo, { rotulo: string; tom: BadgeTone; cor: string }> = {
  vencido: { rotulo: "Vencido", tom: "blq", cor: "var(--blq)" },
  proximo: { rotulo: "Vence em breve", tom: "al", cor: "var(--al)" },
  aguardando_execucao: { rotulo: "Aguardando execução", tom: "lib", cor: "var(--lib)" },
  em_dia: { rotulo: "Em dia", tom: "enc", cor: "var(--enc)" },
  sem_intervalo: { rotulo: "Sem intervalo", tom: "neu", cor: "var(--ink4)" },
  sem_historico: { rotulo: "Sem OS ativa", tom: "neu", cor: "var(--ink4)" },
  pausado: { rotulo: "Pausado", tom: "neu", cor: "var(--ink4)" },
};

const dias = (n: number) => (n === 1 ? "1 dia" : `${n} dias`);

/** A contagem regressiva em texto: "faltam 12 dias", "vence hoje", "vencido há 3 dias". */
export function contagemRegressiva(p: Pick<PlanoPreventiva, "dias_restantes" | "situacao">): string {
  if (p.situacao === "pausado") return "Ciclo pausado";
  if (p.situacao === "sem_intervalo") return "Intervalo não definido";
  if (p.situacao === "sem_historico") return "Nenhuma OS ativa do plano";
  if (p.situacao === "aguardando_execucao" || p.dias_restantes === null) return "Conta a partir do encerramento";
  if (p.dias_restantes === 0) return "Vence hoje";
  if (p.dias_restantes < 0) return `Vencido há ${dias(-p.dias_restantes)}`;
  return `Faltam ${dias(p.dias_restantes)}`;
}

/** Plano e item como o SAP os mostra: "Plano 10573 · Item 10603". */
export const rotuloDoPlano = (p: Pick<PlanoPreventiva, "plano_manutencao" | "item_manutencao">) =>
  `Plano ${p.plano_manutencao}${p.item_manutencao ? ` · Item ${p.item_manutencao}` : ""}`;

/** Quantos planos pedem atenção agora (vencidos e próximos do vencimento). */
export const pedemAtencao = (c: Pick<ContagemDosCiclos, "vencido" | "proximo">) => c.vencido + c.proximo;
