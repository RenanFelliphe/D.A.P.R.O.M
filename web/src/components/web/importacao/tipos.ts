/**
 * Formatos das respostas de `GET /importacoes`, `POST /importacoes` (planilha), `POST /importacoes/pdf/leitura` e
 * `POST /importacoes/pdf` (PDF da OS) e `GET /importacoes/resumo`.
 */

import type { PlanoSemIntervalo } from "@/components/web/preventivas/IntervalosDoResultado";
import { dataDoDia } from "@/lib/formatar";
import type { Intervalo } from "@/lib/preventivas";
import type { OsStatus } from "@/lib/tipos";

export interface LinhaIgnorada {
  /** Número da linha na planilha; na leitura pela API vem só o `numero_ordem`. */
  linha?: number;
  numero_ordem?: string;
  centro_trabalho?: string;
  motivo: string;
}

export interface AvisoDaOrdem {
  linha?: number;
  numero_ordem: string;
  motivo: string;
}

export interface Importacao {
  id: string;
  origem: "api" | "planilha" | "pdf";
  /** `<id>/<nome>.xlsx` ou `<id>/<nome>.pdf` no bucket; só os arquivos têm. */
  arquivo: string | null;
  usuario_id: string | null;
  usuario_nome: string | null;
  criadas: number;
  atualizadas: number;
  ignoradas: number;
  detalhe_ignoradas: LinhaIgnorada[] | null;
  erro: string | null;
  criada_em: string;
}

/** O que a importação de um arquivo (planilha ou PDF) fez. */
export interface ResultadoDaImportacao {
  importacao_id: string;
  criadas: number;
  atualizadas: number;
  ignoradas: LinhaIgnorada[];
  avisos: AvisoDaOrdem[];
  /** Preventivas que entraram com plano de manutenção, mas cujo plano segue sem intervalo entre ciclos. */
  planos_sem_intervalo?: PlanoSemIntervalo[];
}

/** Uma OS no formato do contrato do SAP, como o PDF a trouxe e a conferência a deixou; `null` no que não veio. */
export interface OrdemDoPdf {
  numero_ordem: string;
  numero_nota: string | null;
  tipo_ordem: "YBA1" | "YBA2" | null;
  tipo_atividade: string | null;
  codigo_atividade: string | null;
  titulo: string | null;
  descricao: string | null;
  centro_trabalho: string | null;
  local_instalacao: { codigo: string | null; endereco: string | null; plus_code: string | null; cliente: string | null };
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
  /** A "Periodicidade" impressa (texto) ou o intervalo conferido na tela, que vai para o plano da preventiva. */
  intervalo_ciclo: string | Intervalo | null;
}

export type CampoObrigatorioDoPdf = "tipo_ordem" | "titulo" | "centro_trabalho" | "local_instalacao" | "data_inicio_prog";

/** Uma OS lida do PDF, com o que faltou e o que o sistema já sabe dela. */
export interface OsLidaDoPdf {
  /** Folhas do PDF (a partir de 1). */
  paginas: number[];
  ordem: OrdemDoPdf;
  faltando: CampoObrigatorioDoPdf[];
  /** O que foi deduzido, e não lido. */
  observacoes: string[];
  existente: { id: string; status: OsStatus; origem: string } | null;
  /** A equipe do centro de trabalho lido (`null`: centro sem equipe cadastrada). */
  equipe: { id: string; nome: string } | null;
  /** A atividade cadastrada que casou com o título. */
  atividade: { codigo: string; com_modelo: boolean } | null;
  /** Preventiva com plano: o intervalo que o plano já tem no sistema e o que o PDF trouxe (`null` na corretiva ou sem plano). */
  preventiva: { plano_id: string | null; intervalo_atual: Intervalo | null; intervalo_atual_descricao: string | null; intervalo_lido: Intervalo | null } | null;
}

/** `POST /importacoes/pdf/leitura`. */
export interface LeituraDoPdf {
  arquivo: string;
  paginas: number;
  paginas_sem_ordem: number[];
  ordens: OsLidaDoPdf[];
}

/** Nome da planilha sem a pasta do bucket. */
export const nomeDoArquivo = (arquivo: string | null) => (arquivo ? arquivo.slice(arquivo.lastIndexOf("/") + 1) : "—");

export type Agrupamento = "dia" | "semana" | "mes";

export interface ContagensDaEntrada {
  criadas: number;
  atualizadas: number;
  ignoradas: number;
}

/**
 * Uma faixa `[inicio, fim)` (dias `AAAA-MM-DD`) do período: as OS registradas por origem (`api`, `planilha`) e as
 * leituras da API, com as que falharam.
 */
export interface PontoDaSerie {
  inicio: string;
  fim: string;
  api: number;
  planilha: number;
  leituras: number;
  falhas: number;
}

/** `GET /sap/sincronizacao`. */
export interface Sincronizacao {
  ultima_leitura_sem_erro_em: string | null;
  /** A leitura agendada só roda com a API do SAP configurada. */
  automatica: boolean;
  intervalo_min: number;
}

/** `GET /importacoes/resumo`: a entrada de OS (dashboard de OS). */
export interface ResumoDasImportacoes {
  /** `7d`, `30d`, `90d`, `12m` ou `AAAA-MM`. */
  periodo: string;
  agrupamento: Agrupamento;
  de: string;
  ate: string;
  totais: ContagensDaEntrada;
  anterior: ContagensDaEntrada;
  por_origem: {
    api: ContagensDaEntrada & { leituras: number; leituras_com_erro: number };
    planilha: ContagensDaEntrada & { arquivos: number; arquivos_com_erro: number };
  };
  serie: PontoDaSerie[];
  /** Do mais comum ao menos; os que passam de cinco somam em "Outros motivos". */
  motivos_ignoradas: { motivo: string; total: number }[];
}

/**
 * As três formas de uma OS nova entrar, com a cor de cada uma nos gráficos (paleta categórica de `variables.css`). A
 * Importação (arquivo) leva a chave `planilha` e soma a planilha e o PDF da OS. A digitalização ainda não registra OS (a
 * `api` não tem essa origem): no painel ela aparece sempre com zero.
 */
export const origensDeEntrada = {
  api: { nome: "Sincronização (API)", curto: "API", cor: "var(--o-api)" },
  planilha: { nome: "Importação (arquivo)", curto: "Arquivo", cor: "var(--o-arq)" },
  digitalizacao: { nome: "Digitalização (câmera)", curto: "Câmera", cor: "var(--o-cam)" },
} as const;

/** O método de entrada de uma importação do histórico: a planilha e o PDF são os dois arquivos da Importação. */
export const metodoDaImportacao = (origem: Importacao["origem"]) => (origem === "api" ? origensDeEntrada.api : origensDeEntrada.planilha);

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** `AAAA-MM-DD` menos um dia (o último dia de uma faixa `[inicio, fim)`). */
function diaAnterior(dia: string) {
  const [a, m, d] = dia.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d - 1)).toISOString().slice(0, 10);
}

const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

/** Rótulo curto do ponto no eixo (`08/10`, `out/26`). */
export function rotuloCurto(p: Pick<PontoDaSerie, "inicio">, agrupamento: Agrupamento) {
  return agrupamento === "mes" ? `${MESES[Number(p.inicio.slice(5, 7)) - 1]}/${p.inicio.slice(2, 4)}` : ddmm(p.inicio);
}

/** Rótulo completo do ponto (dica e tabela): `08/10/2026`, `12/10 a 18/10/2026`, `outubro de 2026`. */
export function rotuloLongo(p: Pick<PontoDaSerie, "inicio" | "fim">, agrupamento: Agrupamento) {
  if (agrupamento === "dia") return dataDoDia(p.inicio);
  if (agrupamento === "semana") return `${ddmm(p.inicio)} a ${dataDoDia(diaAnterior(p.fim))}`;
  return `${MESES_LONGOS[Number(p.inicio.slice(5, 7)) - 1]} de ${p.inicio.slice(0, 4)}`;
}
