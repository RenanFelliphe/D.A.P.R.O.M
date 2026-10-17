/** Formas das respostas de `/sap-simulado/gestao/...` (chaves em snake_case, como a `api` devolve). */

export type SituacaoNoSyncOs = "nao_lida" | "ignorada" | "liberada" | "pendente" | "em_execucao" | "encerrada" | "cancelada" | "devolvida";

export const rotuloDaSituacaoNoSyncOs: Record<SituacaoNoSyncOs, string> = {
  nao_lida: "Ainda não lida",
  ignorada: "Ignorada",
  liberada: "Liberada",
  pendente: "Pendente",
  em_execucao: "Em execução",
  encerrada: "Encerrada",
  cancelada: "Cancelada",
  devolvida: "Devolvida ao SAP",
};

export interface NoSyncOs {
  situacao: SituacaoNoSyncOs;
  /** Só em `ignorada`: o motivo que a leitura registrou. */
  motivo?: string;
}

export interface LocalDeInstalacao {
  codigo: string;
  endereco?: string | null;
  plus_code?: string | null;
  cliente?: string | null;
}

export interface Ordem {
  numero_ordem: string;
  numero_nota: string | null;
  tipo_ordem: "YBA1" | "YBA2";
  tipo_atividade: string | null;
  codigo_atividade: string | null;
  titulo: string;
  descricao: string | null;
  centro_trabalho: string;
  local_instalacao: LocalDeInstalacao;
  equipamento: string | null;
  prioridade: string | null;
  data_inicio_prog: string;
  data_fim_prog: string | null;
  status_sap: string | null;
  solicitante: string | null;
  criado_por: string | null;
  criada_em: string | null;
  plano_manutencao: string | null;
  item_manutencao: string | null;
  intervalo_ciclo?: string | { quantidade: number; unidade: string } | null;
  /** Só na lista de gestão: como o SYNC OS está com a ordem e se ela mudou depois da última leitura sem erro. */
  no_sync_os: NoSyncOs;
  alterada_depois_da_leitura: boolean;
  alterada_em: string;
}

export interface ListaDeOrdens {
  ordens: Ordem[];
  total: number;
  pagina: number;
  tamanho: number;
  /** Contador de todas as ordens por situação no SYNC OS. */
  contagem: Record<SituacaoNoSyncOs, number>;
  total_geral: number;
}

export interface CentroDoCatalogo {
  centro_trabalho: string;
  nome: string;
  equipe_no_sync_os: string | null;
}

export interface CatalogoDeOrdens {
  centros_de_trabalho: CentroDoCatalogo[];
  locais: { codigo: string; endereco: string; plus_code: string; cliente: string | null }[];
  /** As atividades que o SYNC OS já tem cadastradas (o serviço do catálogo). */
  atividades: { codigo: string; descricao: string }[];
  servicos: { titulo: string; descricao: string; tipo: "YBA1" | "YBA2"; prefixo: string }[];
  status_prontos: { codigo: string; rotulo: string }[];
  proximo_numero: string;
}

export interface RecusadaEmMassa {
  numero_ordem: string;
  motivo: string;
}

export type AcaoEmMassaDeOrdens = "mudar_status" | "mudar_centro" | "reprogramar" | "excluir";

/** O que o SYNC OS faz com uma ordem que muda no SAP, pelas regras da leitura (`apiSAP.md`, seção 7): o aviso da janela de edição. */
export function efeitoDaEdicao(n: NoSyncOs["situacao"]): string | null {
  switch (n) {
    case "em_execucao":
      return "A OS está em execução: só o planejamento muda. Tirar o LIB gera um alerta de conflito, e a execução segue.";
    case "encerrada":
    case "cancelada":
      return "A OS já está encerrada ou cancelada no SYNC OS: o SAP só acompanha, e nada muda lá.";
    case "liberada":
    case "pendente":
      return "A OS está no SYNC OS: tirar o LIB do status a cancela na próxima leitura, e outra data só vale se a OS não tiver sido reprogramada lá (a reprogramação vence).";
    case "devolvida":
      return "O supervisor devolveu esta OS ao SAP, com a justificativa na planilha de baixa. Corrigir a ordem aqui a traz de volta na próxima leitura; tirar o LIB a cancela.";
    case "ignorada":
      return "O SYNC OS ignorou esta ordem na última leitura. Ao mudar, ele a confere de novo na próxima.";
    default:
      return null;
  }
}

/** Texto curto do status SAP: o rótulo das opções prontas, ou o próprio código. */
export const rotuloDoStatus = (status: string | null, prontos: { codigo: string; rotulo: string }[]) => (status ? (prontos.find((p) => p.codigo === status)?.rotulo ?? status) : "—");

/** Tem o `LIB` na lista de códigos: a regra do SYNC OS para "liberada". */
export const temLib = (status: string | null) => (status ?? "").toUpperCase().split(/\s+/).includes("LIB");
