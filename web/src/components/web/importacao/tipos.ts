/** Formatos das respostas de `GET /importacoes`, `POST /importacoes` e `GET /importacoes/resumo`. */

import { dataDoDia } from "@/lib/formatar";

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
  origem: "api" | "planilha";
  /** `<id>/<nome>.xlsx` no bucket; só as planilhas têm. */
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

export interface ResultadoDaPlanilha {
  importacao_id: string;
  criadas: number;
  atualizadas: number;
  ignoradas: LinhaIgnorada[];
  avisos: AvisoDaOrdem[];
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
 * digitalização ainda não registra OS (a `api` não tem essa origem): no painel ela aparece sempre com zero.
 */
export const origensDeEntrada = {
  api: { nome: "Sincronização (API)", curto: "API", cor: "var(--o-api)" },
  planilha: { nome: "Importação (arquivo)", curto: "Arquivo", cor: "var(--o-arq)" },
  digitalizacao: { nome: "Digitalização (câmera)", curto: "Câmera", cor: "var(--o-cam)" },
} as const;

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
