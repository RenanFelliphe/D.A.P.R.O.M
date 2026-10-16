import type { IconName } from "@/components/ui/Icon";
import { ehAdmin, ehSupervisor, type DocumentoDeEvidencia, type Usuario } from "@/lib/tipos";

/** Alerta como `GET /alertas` devolve. */
export type TipoDeAlerta =
  | "bloqueio"
  | "conflito_planejamento"
  | "execucao_duplicada"
  | "apoio_encerrado"
  | "falha_importacao"
  | "preventiva_proxima"
  | "preventiva_vencida"
  | "inspecao_com_pendencia"
  | "ausencia_pedida"
  | "ausencia_aprovada"
  | "ausencia_recusada"
  | "ausencia_registrada"
  | "ausencia_fim_pedido"
  | "ausencia_fim_respondido"
  | "ausencia_alterada"
  | "ausencia_vencida"
  | "ausencia_cancelada";

export interface Alerta {
  id: string;
  tipo: TipoDeAlerta;
  /** De quem é o alerta (e o `lido_em`): o admin vê os de todos, mas só marca como lidos os seus. */
  destinatario_id: string;
  destinatario_nome: string | null;
  /** A OS do alerta; nulos (os quatro) na falha de importação e nos alertas da ausência, que não têm OS. */
  os_id: string | null;
  numero_ordem: string | null;
  titulo: string | null;
  equipe_id: string | null;
  /** Só na falha de importação: o registro da importação que falhou e o método. */
  importacao_id: string | null;
  importacao_origem: "api" | "planilha" | "pdf" | null;
  /** Só nos alertas do ciclo das preventivas: o plano (a OS é a última dele). */
  plano_preventiva_id: string | null;
  /** Só nos alertas da ausência de um usuário (`ausencia_*`): a ausência, a pessoa dela e a equipe, onde o supervisor responde. */
  ausencia_id: string | null;
  usuario_alvo_id: string | null;
  usuario_alvo_nome: string | null;
  ausencia_equipe_id: string | null;
  detalhe: string;
  email_enviado_em: string | null;
  lido_em: string | null;
  criado_em: string;
}

export const TIPOS_DE_ALERTA: TipoDeAlerta[] = [
  "bloqueio",
  "conflito_planejamento",
  "execucao_duplicada",
  "apoio_encerrado",
  "falha_importacao",
  "preventiva_proxima",
  "preventiva_vencida",
  "inspecao_com_pendencia",
  "ausencia_pedida",
  "ausencia_aprovada",
  "ausencia_recusada",
  "ausencia_registrada",
  "ausencia_fim_pedido",
  "ausencia_fim_respondido",
  "ausencia_alterada",
  "ausencia_vencida",
  "ausencia_cancelada",
];

export const rotuloDoTipo: Record<TipoDeAlerta, string> = {
  bloqueio: "Impedimento",
  conflito_planejamento: "Conflito de planejamento",
  execucao_duplicada: "Execução duplicada",
  apoio_encerrado: "Apoio encerrado",
  falha_importacao: "Falha na importação",
  preventiva_proxima: "Preventiva: ciclo próximo",
  preventiva_vencida: "Preventiva: ciclo vencido",
  inspecao_com_pendencia: "Inspeção com pendência",
  ausencia_pedida: "Ausência: pedido a responder",
  ausencia_aprovada: "Ausência aprovada",
  ausencia_recusada: "Ausência recusada",
  ausencia_registrada: "Ausência registrada",
  ausencia_fim_pedido: "Ausência: fim antecipado pedido",
  ausencia_fim_respondido: "Ausência: fim antecipado respondido",
  ausencia_alterada: "Ausência alterada",
  ausencia_vencida: "Ausência vencida",
  ausencia_cancelada: "Pedido de ausência cancelado",
};

/** Alerta da ausência de um usuário: não tem OS e leva ao perfil (do ausente) ou à equipe (do supervisor). */
export const ehDeAusencia = (a: Pick<Alerta, "tipo">) => a.tipo.startsWith("ausencia_");

/** Alerta do ciclo das preventivas (próximo ou vencido): aponta para o plano e para a última OS dele. */
export const ehDeCiclo = (a: Pick<Alerta, "tipo">) => a.tipo === "preventiva_proxima" || a.tipo === "preventiva_vencida";

/** O alerta de bloqueio nasce de uma APR bloqueada ou de uma execução interrompida; o texto do detalhe diz qual. */
export function rotuloDoAlerta(a: Pick<Alerta, "tipo" | "detalhe">): string {
  if (a.tipo !== "bloqueio") return rotuloDoTipo[a.tipo];
  return a.detalhe.startsWith("Execução interrompida") ? "Execução interrompida" : "APR bloqueada";
}

/** Impedimento, falha de importação e ciclo vencido pedem atenção (vermelho); os demais, inclusive a inspeção com item não marcado, só informam (azul). */
export function aparenciaDoAlerta(a: Pick<Alerta, "tipo">): { icone: IconName; urgente: boolean } {
  if (a.tipo === "bloqueio") return { icone: "octagon", urgente: true };
  if (a.tipo === "falha_importacao") return { icone: "alert", urgente: true };
  if (a.tipo === "preventiva_vencida" || a.tipo === "ausencia_vencida") return { icone: "clock", urgente: true };
  if (a.tipo.startsWith("ausencia_")) return { icone: "cal", urgente: false };
  if (a.tipo === "preventiva_proxima") return { icone: "clock", urgente: false };
  if (a.tipo === "inspecao_com_pendencia") return { icone: "clip", urgente: false };
  return { icone: "refresh", urgente: false };
}

/** Nome do método de uma importação que falhou. */
export const metodoDaFalha = (origem: Alerta["importacao_origem"]) =>
  origem === "api" ? "Sincronização com a API do SAP" : origem === "pdf" ? "Importação do PDF da OS" : "Importação de planilha";

/** A que o alerta se refere, na lista e no sino: a OS (número em fonte mono e título) ou o método da importação. */
export function referenciaDoAlerta(a: Alerta): { codigo: string | null; texto: string } {
  if (a.tipo === "falha_importacao") return { codigo: null, texto: metodoDaFalha(a.importacao_origem) };
  if (ehDeAusencia(a)) return { codigo: null, texto: a.usuario_alvo_nome ?? "Ausência" };
  return { codigo: a.numero_ordem ?? "OS de apoio", texto: a.titulo ?? "" };
}

/** Quem decide sobre a OS (reprogramar e abrir OS de apoio) e marca os próprios alertas como lidos: o supervisor e o admin. */
export const perfilAgeSobreAlertas = (u: Pick<Usuario, "perfil" | "equipes_supervisionadas">) => ehSupervisor(u) || ehAdmin(u);

/** O alerta é de quem o abre. Só então abrir o marca como lido: o admin vê os alertas de todos sem mexer no `lido_em` dos outros. */
export const ehDoUsuario = (a: Pick<Alerta, "destinatario_id">, u: Pick<Usuario, "id">) => a.destinatario_id === u.id;

/** "Não lido" ou "Lido", dizendo de quem quando o alerta é de outra pessoa. */
export function rotuloDaLeitura(a: Pick<Alerta, "lido_em" | "destinatario_id" | "destinatario_nome">, u: Pick<Usuario, "id">) {
  const estado = a.lido_em === null ? "Não lido" : "Lido";
  return ehDoUsuario(a, u) || !a.destinatario_nome ? estado : `${estado} por ${a.destinatario_nome}`;
}

/** Parte do `GET /os/{id}` que o detalhe do alerta usa. */
export interface DetalheDaOs {
  os: {
    id: string;
    numero_ordem: string | null;
    titulo: string;
    status: "liberada" | "pendente" | "em_execucao" | "encerrada" | "cancelada" | "devolvida";
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
  itens_reprovados: { item_id: string; texto: string; resposta: "sim" | "nao" | "na"; observacao: string | null; fotos: FotoDaOs[]; documentos?: DocumentoDeEvidencia[] }[];
}

export interface ExecucaoDaOs {
  id: string;
  executor: { id: string; nome: string };
  fim: string | null;
  resultado: "encerrada" | "interrompida" | "suspensa" | "cancelada" | null;
  motivo: string | null;
  fotos: FotoDaOs[];
  documentos?: DocumentoDeEvidencia[];
}
