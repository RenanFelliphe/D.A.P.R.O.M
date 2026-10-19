/** Tipos das respostas da `api` que várias telas usam (os demais ficam junto da tela que os consome). Chaves em snake_case, como a `api` devolve. */

import type { AusenciaDaPessoa, MinhaAusencia } from "./ausencia";
import type { EquipeRepresentada, RepresentacaoDaEquipe } from "./representacao";
import type { ResumoDaBarra } from "./gamificacao";

/** Tons dos selos de status (`Badge` na web, selo do app): cada tela traduz o tom na cor dela. */
export type TomDoSelo = "lib" | "exe" | "blq" | "enc" | "neu" | "al" | "crit" | "dark" | "brand";

/** Só técnico e administrador. Supervisor não é perfil: é quem a equipe aponta (`equipes_supervisionadas` de `GET /me`) e sempre é técnico. */
export type Perfil = "tecnico" | "admin";

export interface Usuario {
  id: string;
  nome: string;
  /** Identificação definitiva da pessoa na empresa (PDF e SAP); o login é o e-mail. */
  matricula: string;
  /** E-mail institucional (o login). Só o admin o recebe na lista de usuários; cada pessoa o recebe em `/me`. */
  email?: string;
  cargo: string | null;
  registro_profissional: string | null;
  perfil: Perfil;
  equipe_id: string | null;
  ativo: boolean;
  senha_provisoria: boolean;
  /** Id do arquivo da assinatura (bucket `assinaturas`); `GET /arquivos/{id}/url` dá o endereço da imagem. */
  assinatura_path: string | null;
  assinatura_em: string | null;
  /** Equipes de que a pessoa é supervisora (qualquer perfil). Só `GET /me` preenche. */
  equipes_supervisionadas?: { id: string; nome: string }[];
  /** As equipes que a pessoa representa agora (o supervisor está ausente ou parado há 3 dias); cada uma também entra em `equipes_supervisionadas`. Só `GET /me` preenche. */
  equipes_representadas?: EquipeRepresentada[];
  /** Situação do treinamento do técnico (Campo de treino); `GET /me` preenche. O admin não tem treinamento. */
  treinamento?: Treinamento;
  /** Liberação do acesso geral. Técnico cadastrado por supervisor nasce `pendente` até um admin liberar; `recusado` não entra. Ausente (API antiga) vale `liberado`. */
  liberacao?: Liberacao;
  /** Quem cadastrou a pessoa (supervisor ou admin); `null` nas contas antigas. */
  criado_por_id?: string | null;
  /** Quando o admin liberou o acesso. */
  liberado_em?: string | null;
  /** Motivo informado pelo admin ao recusar o cadastro. */
  recusa_motivo?: string | null;
  /** Nome de quem cadastrou e o instante do cadastro: a tela de espera os mostra quando a `api` os devolve em `/me`. */
  criado_por_nome?: string | null;
  criado_em?: string | null;
  /** O que o registro de funcionários diz da pessoa na última conferência; `null` até a primeira. `GET /usuarios` e `GET /usuarios/{id}` preenchem. */
  situacao_registro?: SituacaoRegistro | null;
  registro_conferido_em?: string | null;
  /** Quem não quer aparecer pelo nome no ranking da gamificação (os pontos continuam valendo); `GET /me` preenche. */
  ranking_anonimo?: boolean;
  /** A patente e os pontos da temporada para a barra superior; `GET /me` preenche, e é `null` para o admin (não joga). */
  gamificacao?: ResumoDaBarra | null;
  /** A ausência em curso ou vencida da pessoa (o ausente só visualiza); `null` quando não está ausente. As listas de pessoas e `GET /me` preenchem. */
  ausencia?: AusenciaDaPessoa | null;
}

export type Liberacao = "liberado" | "pendente" | "recusado";

/** `GET /me`: quem está logado, a equipe, as equipes que supervisiona ou representa e o que a barra superior e as faixas mostram. */
export interface RespostaMe {
  usuario: Usuario;
  equipe: Equipe | null;
  equipes_supervisionadas: { id: string; nome: string }[];
  equipes_representadas?: EquipeRepresentada[];
  gamificacao?: ResumoDaBarra | null;
  /** A ausência em curso ou vencida (a faixa "Você está ausente até DD/MM"); `null` quando não está ausente. */
  ausencia?: MinhaAusencia | null;
  /** As categorias de e-mail desligadas no perfil e se o servidor de e-mail está configurado. */
  emails?: { desligados: string[]; servidor_configurado: boolean };
}

/** Situação da pessoa no registro de funcionários (RH); `fora_do_registro` é a matrícula que sumiu de lá. */
export type SituacaoRegistro = "ativo" | "afastado" | "desligado" | "fora_do_registro";

export const rotuloDaSituacaoRegistro: Record<SituacaoRegistro, string> = {
  ativo: "Ativo no registro",
  afastado: "Afastado",
  desligado: "Desligado no registro",
  fora_do_registro: "Fora do registro",
};

export const rotuloDaLiberacao: Record<Liberacao, string> = {
  liberado: "Liberado",
  pendente: "Pendente",
  recusado: "Recusado",
};

/** Onde o técnico está no Campo de treino: `nao_iniciado` abre as boas-vindas no login; `concluido` e `pulado` não. */
export interface Treinamento {
  estado: "nao_iniciado" | "concluido" | "pulado";
  em: string | null;
}

export interface Equipe {
  id: string;
  nome: string;
  centro_trabalho: string;
  supervisor_id: string | null;
  /** Quem substitui o supervisor, e a representação em vigor (`null` enquanto o supervisor responde pela equipe). */
  representante_id?: string | null;
  representacao?: RepresentacaoDaEquipe | null;
}

/**
 * `encerrando` e `aguardando_supervisor` são os dois passos entre o fim da execução e a conclusão: o tempo parou e o responsável
 * preenche e assina o encerramento (`encerrando`); depois o supervisor lê o relatório da execução e assina por último
 * (`aguardando_supervisor`). Só então a OS fica `encerrada` (concluída).
 * `devolvida`: o supervisor a devolveu ao SAP com uma justificativa (erro na ordem); sai do quadro, como a `cancelada`.
 */
export type OsStatus = "liberada" | "pendente" | "em_execucao" | "encerrando" | "aguardando_supervisor" | "encerrada" | "cancelada" | "devolvida";

/** A OS já passou da execução (encerrando, esperando o supervisor ou concluída): não recebe mais APR nem execução. */
export const execucaoJaTerminou = (status: OsStatus | string): boolean => status === "encerrando" || status === "aguardando_supervisor" || status === "encerrada";

/** Resposta de listas: `{<nome>: [...], pagina, tamanho, total}`. */
export interface Paginacao {
  pagina: number;
  tamanho: number;
  total: number;
}

type ComPerfil = Pick<Usuario, "perfil">;
type ComSupervisao = Pick<Usuario, "perfil" | "equipes_supervisionadas">;

/** Administrador: só gestão (`/web`); vê todas as equipes, importa e exporta OS e edita modelos de APR. */
export const ehAdmin = (u: ComPerfil): boolean => u.perfil === "admin";

/** Supervisor: técnico que supervisiona ao menos uma equipe. Usa a área de campo e o painel de gestão das equipes dele. */
export const ehSupervisor = (u: ComSupervisao): boolean => u.perfil === "tecnico" && (u.equipes_supervisionadas?.length ?? 0) > 0;

/** Cadastro aguardando o admin: só o Campo de treino e a troca de senha estão liberados. */
export const estaPendente = (u: Pick<Usuario, "liberacao">): boolean => u.liberacao === "pendente";

/** Cadastro recusado pelo admin: a pessoa não entra. */
export const foiRecusado = (u: Pick<Usuario, "liberacao">): boolean => u.liberacao === "recusado";

/** Ids das equipes que o supervisor acompanha. `null` para quem não é supervisor (o admin vê todas as equipes). */
export function equipesDoSupervisor(u: ComSupervisao): string[] | null {
  if (!ehSupervisor(u)) return null;
  return [...new Set(u.equipes_supervisionadas?.map((e) => e.id) ?? [])];
}

/** Nomes das equipes que o supervisor acompanha, separados por vírgula. */
export const nomesDasEquipesDoSupervisor = (u: Pick<Usuario, "equipes_supervisionadas">): string => u.equipes_supervisionadas?.map((e) => e.nome).join(", ") ?? "";

export const rotuloDoPerfil: Record<Perfil, string> = {
  tecnico: "Técnico",
  admin: "Administrador",
};

export const rotuloDoStatus: Record<OsStatus, string> = {
  liberada: "Liberada",
  pendente: "Pendente",
  em_execucao: "Em execução",
  encerrando: "Encerrando",
  aguardando_supervisor: "Aguardando o supervisor",
  encerrada: "Encerrada",
  cancelada: "Cancelada",
  devolvida: "Devolvida ao SAP",
};

/** A pessoa para quem o supervisor reservou a OS (atribuição individual): só ela inicia a APR e a execução. */
export interface ResponsavelDaOs {
  id: string;
  nome: string;
}

/** Iniciais para o avatar: primeira e última palavra do nome. */
export function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const letras = partes.length > 1 ? partes[0]![0]! + partes[partes.length - 1]![0]! : partes[0]!.slice(0, 2);
  return letras.toUpperCase();
}

/** Documento em PDF de uma evidência (laudo, atestado, relatório), como a `api` devolve em `documentos`, ao lado de `fotos`. */
export interface DocumentoDeEvidencia {
  id: string;
  /** Id para `GET /arquivos/{id}/url`. */
  arquivo_path: string;
  /** Nome do arquivo anexado; nulo quando o aparelho não informou. */
  nome: string | null;
  capturada_em: string;
}
