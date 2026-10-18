import { ALVO_DO_AVISO, caminhoDoAviso, ROTULO_DO_AVISO, TIPOS_DE_AVISO, type AlvoDeAviso, type TipoDeAviso } from "../../../../../shared/notificacoes/avisos";
import type { IconName } from "@/components/ui/Icon";
import { ehAdmin, ehSupervisor, type DocumentoDeEvidencia, type OsStatus, type Usuario } from "@/lib/tipos";

/** Os tipos de aviso, os rótulos e para onde cada um leva são os da `api` (`shared/notificacoes/avisos.ts`). */
export type TipoDeAlerta = TipoDeAviso;

/** Alerta como `GET /alertas` devolve. */
export interface Alerta {
  id: string;
  tipo: TipoDeAlerta;
  /** De quem é o alerta (e o `lido_em`): o admin vê os de todos, mas só marca como lidos os seus. */
  destinatario_id: string;
  destinatario_nome: string | null;
  /** A OS do alerta; nulos (os quatro) nos avisos que não apontam para uma OS. */
  os_id: string | null;
  numero_ordem: string | null;
  titulo: string | null;
  equipe_id: string | null;
  /** Só na falha de importação: o registro da importação que falhou e o método. */
  importacao_id: string | null;
  importacao_origem: "api" | "planilha" | "pdf" | null;
  /** Só nos alertas do ciclo das preventivas: o plano (a OS é a última dele). */
  plano_preventiva_id: string | null;
  /** A ausência (`ausencia_*`) e a equipe dela, onde o supervisor responde. */
  ausencia_id: string | null;
  ausencia_equipe_id: string | null;
  /** A pessoa de quem o aviso fala: a da ausência ou a conta (`conta_criada`, `membro_desativado`, `funcionario_readmitido`…). */
  usuario_alvo_id: string | null;
  usuario_alvo_nome: string | null;
  /** A equipe dos avisos que apontam para ela (`representacao_*`, `equipe_sem_supervisor`). */
  equipe_alvo_id: string | null;
  equipe_alvo_nome: string | null;
  /** A leitura do registro de funcionários que falhou (`rh_leitura_falhou`). */
  leitura_rh_id: string | null;
  /** O treinamento de serviço (`treinamento_*`) e o código do serviço dele. */
  treinamento_id: string | null;
  treinamento_codigo: string | null;
  detalhe: string;
  email_enviado_em: string | null;
  lido_em: string | null;
  criado_em: string;
}

export const TIPOS_DE_ALERTA: TipoDeAlerta[] = [...TIPOS_DE_AVISO];

export const rotuloDoTipo: Record<TipoDeAlerta, string> = ROTULO_DO_AVISO;

/** A que o aviso aponta: a OS, a importação, a ausência, a equipe, a conta de uma pessoa, a leitura do registro, o treinamento ou nada. */
export const alvoDoAlerta = (a: Pick<Alerta, "tipo">): AlvoDeAviso => ALVO_DO_AVISO[a.tipo];

/** Alerta da ausência de um usuário: não tem OS e leva ao perfil (do ausente) ou à equipe (do supervisor). */
export const ehDeAusencia = (a: Pick<Alerta, "tipo">) => alvoDoAlerta(a) === "ausencia";

/** Alerta da representação da equipe (o representante assumiu ou devolveu o comando): não tem OS e leva à equipe. */
export const ehDeRepresentacao = (a: Pick<Alerta, "tipo">) => a.tipo.startsWith("representacao_");

/** Alerta do ciclo das preventivas (próximo ou vencido): aponta para o plano e para a última OS dele. */
export const ehDeCiclo = (a: Pick<Alerta, "tipo">) => a.tipo === "preventiva_proxima" || a.tipo === "preventiva_vencida";

/**
 * Os avisos que não são de OS, de importação, de ausência nem de representação: a conta de uma pessoa, a equipe sem supervisor,
 * a leitura do registro de funcionários, o treinamento e a Vitória. Têm o detalhe geral (`DetalheAvisoGeral`).
 */
export const ehAvisoGeral = (a: Pick<Alerta, "tipo">) => {
  const alvo = alvoDoAlerta(a);
  return alvo === "usuario" || alvo === "leitura_rh" || alvo === "treinamento" || alvo === "nenhum" || a.tipo === "equipe_sem_supervisor";
};

/** O alerta de bloqueio nasce de uma APR bloqueada ou de uma execução interrompida; o texto do detalhe diz qual. */
export function rotuloDoAlerta(a: Pick<Alerta, "tipo" | "detalhe">): string {
  if (a.tipo !== "bloqueio") return rotuloDoTipo[a.tipo];
  return a.detalhe.startsWith("Execução interrompida") ? "Execução interrompida" : "APR bloqueada";
}

/** Os avisos de segurança do trabalho da Reunião 3: o direito de recusa na APR e a lesão ou enfermidade na execução. Têm o mesmo destaque do impedimento. */
export const ehDeSeguranca = (a: Pick<Alerta, "tipo">) => a.tipo === "direito_de_recusa" || a.tipo === "lesao_ou_enfermidade";

/**
 * Impedimento, o direito de recusa e a lesão ou enfermidade, as falhas (importação, registro de funcionários, PDF), o ciclo e a
 * ausência vencidos e a equipe sem supervisor pedem atenção (vermelho); os demais só informam (azul).
 */
export function aparenciaDoAlerta(a: Pick<Alerta, "tipo">): { icone: IconName; urgente: boolean } {
  switch (a.tipo) {
    case "bloqueio":
      return { icone: "octagon", urgente: true };
    case "direito_de_recusa":
      return { icone: "shield", urgente: true };
    case "lesao_ou_enfermidade":
      return { icone: "alert", urgente: true };
    case "apr_para_assinar":
      return { icone: "clip", urgente: false };
    case "os_para_assinar":
      return { icone: "file", urgente: false };
    case "falha_importacao":
    case "rh_leitura_falhou":
    case "pdf_os_falhou":
      return { icone: "alert", urgente: true };
    case "preventiva_vencida":
    case "ausencia_vencida":
      return { icone: "clock", urgente: true };
    case "equipe_sem_supervisor":
      return { icone: "users", urgente: true };
    case "preventiva_proxima":
      return { icone: "clock", urgente: false };
    case "inspecao_com_pendencia":
      return { icone: "clip", urgente: false };
    case "os_reservada":
    case "os_reserva_desfeita":
      return { icone: "pin", urgente: false };
    case "os_ciencia":
      return { icone: "check", urgente: false };
    case "conta_criada":
    case "acesso_liberado":
    case "acesso_recusado":
    case "cadastro_pendente":
    case "cadastro_liberado":
    case "cadastro_recusado":
    case "membro_desativado":
    case "funcionario_readmitido":
      return { icone: "user", urgente: false };
    case "senha_redefinida":
      return { icone: "lock", urgente: false };
    case "vitoria_sem_ia":
      return { icone: "chat", urgente: false };
    case "treinamento_publicado":
    case "treinamento_problema":
      return { icone: "trophy", urgente: false };
    default:
      break;
  }
  if (a.tipo.startsWith("ausencia_")) return { icone: "cal", urgente: false };
  if (a.tipo.startsWith("representacao_")) return { icone: "users", urgente: false };
  return { icone: "refresh", urgente: false };
}

/** Nome do método de uma importação que falhou. */
export const metodoDaFalha = (origem: Alerta["importacao_origem"]) =>
  origem === "api" ? "Sincronização com a API do SAP" : origem === "pdf" ? "Importação do PDF da OS" : "Importação de planilha";

/** A que o alerta se refere, na lista e no sino: a OS (número em fonte mono e título), o método da importação, a pessoa, a equipe… */
export function referenciaDoAlerta(a: Alerta): { codigo: string | null; texto: string } {
  if (a.tipo === "falha_importacao") return { codigo: null, texto: metodoDaFalha(a.importacao_origem) };
  if (ehDeRepresentacao(a)) return { codigo: null, texto: a.detalhe };
  switch (alvoDoAlerta(a)) {
    case "ausencia":
      return { codigo: null, texto: a.usuario_alvo_nome ?? "Ausência" };
    case "usuario":
      return { codigo: null, texto: a.usuario_alvo_nome ?? "Conta" };
    case "equipe":
      return { codigo: null, texto: a.equipe_alvo_nome ?? "Equipe" };
    case "leitura_rh":
      return { codigo: null, texto: "Registro de funcionários" };
    case "treinamento":
      return { codigo: a.treinamento_codigo, texto: "Treinamento de serviço" };
    case "nenhum":
      return { codigo: null, texto: "Vitória" };
    default:
      return { codigo: a.numero_ordem ?? "OS de apoio", texto: a.titulo ?? "" };
  }
}

/**
 * Para onde o aviso leva quem não tem a tela de alertas (o técnico): a OS, a ausência, a equipe, o treinamento. Os mesmos
 * endereços dos e-mails (`caminhoDoAviso`, em `shared/notificacoes/avisos.ts`).
 */
export const destinoDoAlerta = (a: Alerta) =>
  caminhoDoAviso({
    id: a.id,
    tipo: a.tipo,
    destinatarioId: a.destinatario_id,
    osId: a.os_id,
    ausenciaEquipeId: a.ausencia_equipe_id,
    usuarioAlvoId: a.usuario_alvo_id,
    equipeAlvoId: a.equipe_alvo_id,
    treinamentoCodigo: a.treinamento_codigo,
  });

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
    status: OsStatus;
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
