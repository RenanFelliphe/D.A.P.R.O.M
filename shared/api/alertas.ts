/**
 * O aviso (o sino) como `GET /alertas` o devolve, e os textos que as telas repetem: o rótulo, a que ele se refere e se pede atenção.
 * Os tipos de aviso, os rótulos e os destinos vêm de `shared/notificacoes/avisos.ts`. Chaves em snake_case, como a `api` devolve.
 */

import { ALVO_DO_AVISO, ROTULO_DO_AVISO, type AlvoDeAviso, type TipoDeAviso } from "../notificacoes/avisos";

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
  /** A sugestão ou contestação da lista de materiais (`sugestao_materiais_*`, `contestacao_materiais_nova`) e o código do serviço; `materiais_atualizados` traz só o código. */
  sugestao_id: string | null;
  servico_codigo: string | null;
  detalhe: string;
  email_enviado_em: string | null;
  lido_em: string | null;
  criado_em: string;
}

export const rotuloDoTipo: Record<TipoDeAlerta, string> = ROTULO_DO_AVISO;

/** A que o aviso aponta: a OS, a importação, a ausência, a equipe, a conta de uma pessoa, a leitura do registro, o treinamento, a sugestão ou o serviço da lista de materiais, ou nada. */
export const alvoDoAlerta = (a: Pick<Alerta, "tipo">): AlvoDeAviso => ALVO_DO_AVISO[a.tipo];

/** Alerta da representação da equipe (o representante assumiu ou devolveu o comando): não tem OS e leva à equipe. */
export const ehDeRepresentacao = (a: Pick<Alerta, "tipo">) => a.tipo.startsWith("representacao_");

/** O alerta de bloqueio nasce de uma APR bloqueada ou de uma execução interrompida; o texto do detalhe diz qual. */
export function rotuloDoAlerta(a: Pick<Alerta, "tipo" | "detalhe">): string {
  if (a.tipo !== "bloqueio") return rotuloDoTipo[a.tipo];
  return a.detalhe.startsWith("Execução interrompida") ? "Execução interrompida" : "APR bloqueada";
}

/** Os avisos de segurança do trabalho da Reunião 3: o direito de recusa na APR e a lesão ou enfermidade na execução. Têm o mesmo destaque do impedimento. */
export const ehDeSeguranca = (a: Pick<Alerta, "tipo">) => a.tipo === "direito_de_recusa" || a.tipo === "lesao_ou_enfermidade" || a.tipo === "clima_extremo";

/** Os avisos que pedem atenção (vermelho): o impedimento, a segurança, as falhas, o ciclo e a ausência vencidos e a equipe sem supervisor. */
export const alertaUrgente = (a: Pick<Alerta, "tipo">): boolean =>
  a.tipo === "bloqueio" || ehDeSeguranca(a) || ["falha_importacao", "rh_leitura_falhou", "pdf_os_falhou", "preventiva_vencida", "ausencia_vencida", "equipe_sem_supervisor"].includes(a.tipo);

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
    case "sugestao":
      return { codigo: a.servico_codigo, texto: a.tipo === "contestacao_materiais_nova" ? "Contestação de materiais" : "Sugestão de materiais" };
    case "servico":
      return { codigo: a.servico_codigo, texto: "Materiais do serviço" };
    case "nenhum":
      return { codigo: null, texto: "Vitória" };
    default:
      return { codigo: a.numero_ordem ?? "OS de apoio", texto: a.titulo ?? "" };
  }
}
