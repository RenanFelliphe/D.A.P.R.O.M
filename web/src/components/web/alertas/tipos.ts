import type { Perfil } from "@/lib/tipos";

/** Alerta como `GET /alertas` devolve. */
export type TipoDeAlerta = "bloqueio" | "conflito_planejamento" | "execucao_duplicada" | "apoio_encerrado";

export interface Alerta {
  id: string;
  tipo: TipoDeAlerta;
  os_id: string;
  numero_ordem: string | null;
  titulo: string;
  equipe_id: string;
  detalhe: string;
  email_enviado_em: string | null;
  lido_em: string | null;
  criado_em: string;
}

export const TIPOS_DE_ALERTA: TipoDeAlerta[] = ["bloqueio", "conflito_planejamento", "execucao_duplicada", "apoio_encerrado"];

export const rotuloDoTipo: Record<TipoDeAlerta, string> = {
  bloqueio: "Impedimento",
  conflito_planejamento: "Conflito de planejamento",
  execucao_duplicada: "Execução duplicada",
  apoio_encerrado: "Apoio encerrado",
};

/** O alerta de bloqueio nasce de uma APR bloqueada ou de uma execução interrompida; o texto do detalhe diz qual. */
export function rotuloDoAlerta(a: Pick<Alerta, "tipo" | "detalhe">): string {
  if (a.tipo !== "bloqueio") return rotuloDoTipo[a.tipo];
  return a.detalhe.startsWith("Execução interrompida") ? "Execução interrompida" : "APR bloqueada";
}

/** Perfis que decidem sobre a OS (reprogramar e abrir OS de apoio) e marcam o alerta como lido; a Segurança só lê. */
export const perfilAgeSobreAlertas = (perfil: Perfil) => perfil === "supervisor" || perfil === "analista" || perfil === "admin";

/** Parte do `GET /os/{id}` que o detalhe do alerta usa. */
export interface DetalheDaOs {
  os: {
    id: string;
    numero_ordem: string | null;
    titulo: string;
    status: "liberada" | "pendente" | "em_execucao" | "encerrada" | "cancelada";
    equipe_id: string;
    data_inicio_prog: string;
    data_fim_prog: string | null;
    local_instalacao: { id: string; codigo: string; endereco: string | null };
    equipe: { id: string; nome: string };
  };
  aprs: AprDaOs[];
  execucoes: ExecucaoDaOs[];
}

export interface FotoDaOs {
  id: string;
  foto_path: string;
  capturada_em: string;
}

export interface AprDaOs {
  id: string;
  resultado: "aprovada" | "bloqueada";
  observacao_geral: string | null;
  concluida_em: string;
  preenchida_por: { id: string; nome: string };
  modelo: { codigo: string; versao: number; titulo: string };
  participantes: { usuario_id: string; nome: string; funcao: string }[];
  itens_reprovados: { item_id: string; texto: string; resposta: "sim" | "nao" | "na"; observacao: string | null; fotos: FotoDaOs[] }[];
}

export interface ExecucaoDaOs {
  id: string;
  executor: { id: string; nome: string };
  fim: string | null;
  resultado: "encerrada" | "interrompida" | "suspensa" | "cancelada" | null;
  motivo: string | null;
  fotos: FotoDaOs[];
}
