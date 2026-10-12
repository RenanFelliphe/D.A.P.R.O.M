/** Tipos das respostas da `api` que várias telas usam (os demais ficam junto da tela que os consome). Chaves em snake_case, como a `api` devolve. */

export type Perfil = "tecnico" | "supervisor" | "analista" | "seguranca" | "admin";

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

export const rotuloDoPerfil: Record<Perfil, string> = {
  tecnico: "Técnico",
  supervisor: "Supervisor",
  analista: "Analista",
  seguranca: "Segurança do Trabalho",
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
