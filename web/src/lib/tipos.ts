/** Tipos das respostas da `api` que várias telas usam (os demais ficam junto da tela que os consome). Chaves em snake_case, como a `api` devolve. */

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
}

export type Liberacao = "liberado" | "pendente" | "recusado";

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
}

export type OsStatus = "liberada" | "pendente" | "em_execucao" | "encerrada" | "cancelada";

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
  encerrada: "Encerrada",
  cancelada: "Cancelada",
};

/** Iniciais para o avatar: primeira e última palavra do nome. */
export function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const letras = partes.length > 1 ? partes[0]![0]! + partes[partes.length - 1]![0]! : partes[0]!.slice(0, 2);
  return letras.toUpperCase();
}
