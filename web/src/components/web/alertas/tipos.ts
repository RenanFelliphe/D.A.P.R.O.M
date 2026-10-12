import type { IconName } from "@/components/ui/Icon";
import { ehAdmin, ehSupervisor, type Usuario } from "@/lib/tipos";

/** Alerta como `GET /alertas` devolve. */
export type TipoDeAlerta = "bloqueio" | "conflito_planejamento" | "execucao_duplicada" | "apoio_encerrado" | "falha_importacao";

export interface Alerta {
  id: string;
  tipo: TipoDeAlerta;
  /** A OS do alerta; nulos (os quatro) na falha de importação, que não tem OS. */
  os_id: string | null;
  numero_ordem: string | null;
  titulo: string | null;
  equipe_id: string | null;
  /** Só na falha de importação: o registro da importação que falhou e o método. */
  importacao_id: string | null;
  importacao_origem: "api" | "planilha" | null;
  detalhe: string;
  email_enviado_em: string | null;
  lido_em: string | null;
  criado_em: string;
}

export const TIPOS_DE_ALERTA: TipoDeAlerta[] = ["bloqueio", "conflito_planejamento", "execucao_duplicada", "apoio_encerrado", "falha_importacao"];

export const rotuloDoTipo: Record<TipoDeAlerta, string> = {
  bloqueio: "Impedimento",
  conflito_planejamento: "Conflito de planejamento",
  execucao_duplicada: "Execução duplicada",
  apoio_encerrado: "Apoio encerrado",
  falha_importacao: "Falha na importação",
};

/** O alerta de bloqueio nasce de uma APR bloqueada ou de uma execução interrompida; o texto do detalhe diz qual. */
export function rotuloDoAlerta(a: Pick<Alerta, "tipo" | "detalhe">): string {
  if (a.tipo !== "bloqueio") return rotuloDoTipo[a.tipo];
  return a.detalhe.startsWith("Execução interrompida") ? "Execução interrompida" : "APR bloqueada";
}

/** Impedimento e falha de importação pedem atenção (vermelho); os demais só informam (azul). */
export function aparenciaDoAlerta(a: Pick<Alerta, "tipo">): { icone: IconName; urgente: boolean } {
  if (a.tipo === "bloqueio") return { icone: "octagon", urgente: true };
  if (a.tipo === "falha_importacao") return { icone: "alert", urgente: true };
  return { icone: "refresh", urgente: false };
}

/** Nome do método de uma importação que falhou. */
export const metodoDaFalha = (origem: Alerta["importacao_origem"]) => (origem === "api" ? "Sincronização com a API do SAP" : "Importação de planilha");

/** A que o alerta se refere, na lista e no sino: a OS (número em fonte mono e título) ou o método da importação. */
export function referenciaDoAlerta(a: Alerta): { codigo: string | null; texto: string } {
  if (a.tipo === "falha_importacao") return { codigo: null, texto: metodoDaFalha(a.importacao_origem) };
  return { codigo: a.numero_ordem ?? "OS de apoio", texto: a.titulo ?? "" };
}

/** Quem decide sobre a OS (reprogramar e abrir OS de apoio) e marca o alerta como lido: o supervisor (dele) e o admin. */
export const perfilAgeSobreAlertas = (u: Pick<Usuario, "perfil" | "equipes_supervisionadas">) => ehSupervisor(u) || ehAdmin(u);

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
