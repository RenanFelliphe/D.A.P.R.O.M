import { caminhoDoAviso, TIPOS_DE_AVISO } from "../../../../../shared/notificacoes/avisos";
import { alvoDoAlerta, type Alerta, type TipoDeAlerta } from "../../../../../shared/api/alertas";
import type { IconName } from "@/components/ui/Icon";
import { ehAdmin, ehSupervisor, type DocumentoDeEvidencia, type OsStatus, type Usuario } from "@/lib/tipos";

/** O aviso e os textos dele vivem em `shared/api/alertas.ts` (o app `mobile` usa o mesmo código). */
export { alvoDoAlerta, ehDeRepresentacao, ehDeSeguranca, metodoDaFalha, referenciaDoAlerta, rotuloDoAlerta, rotuloDoTipo, type Alerta, type TipoDeAlerta } from "../../../../../shared/api/alertas";

export const TIPOS_DE_ALERTA: TipoDeAlerta[] = [...TIPOS_DE_AVISO];

/** Alerta da ausência de um usuário: não tem OS e leva ao perfil (do ausente) ou à equipe (do supervisor). */
export const ehDeAusencia = (a: Pick<Alerta, "tipo">) => alvoDoAlerta(a) === "ausencia";

/** Alerta do ciclo das preventivas (próximo ou vencido): aponta para o plano e para a última OS dele. */
export const ehDeCiclo = (a: Pick<Alerta, "tipo">) => a.tipo === "preventiva_proxima" || a.tipo === "preventiva_vencida";

/**
 * Os avisos que não são de OS, de importação, de ausência nem de representação: a conta de uma pessoa, a equipe sem supervisor,
 * a leitura do registro de funcionários, o treinamento, a lista de materiais de um serviço e a Vitória. Têm o detalhe geral (`DetalheAvisoGeral`).
 */
export const ehAvisoGeral = (a: Pick<Alerta, "tipo">) => {
  const alvo = alvoDoAlerta(a);
  return alvo === "usuario" || alvo === "leitura_rh" || alvo === "treinamento" || alvo === "sugestao" || alvo === "servico" || alvo === "nenhum" || a.tipo === "equipe_sem_supervisor";
};

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
    case "sugestao_materiais_nova":
    case "contestacao_materiais_nova":
    case "sugestao_materiais_aceita":
    case "sugestao_materiais_recusada":
    case "materiais_atualizados":
      return { icone: "box", urgente: false };
    default:
      break;
  }
  if (a.tipo.startsWith("ausencia_")) return { icone: "cal", urgente: false };
  if (a.tipo.startsWith("representacao_")) return { icone: "users", urgente: false };
  return { icone: "refresh", urgente: false };
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
    sugestaoId: a.sugestao_id,
    servicoCodigo: a.servico_codigo,
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
