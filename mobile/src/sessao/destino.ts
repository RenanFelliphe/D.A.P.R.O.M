import type { RespostaMe } from "@shared/api/tipos";

/** Para onde a conta vai depois do login, pela situação dela em `GET /me`. A conta ausente abre em `abas` (só consulta, com a faixa). */
export type Destino = "trocar-senha" | "aguardando" | "somente-web" | "assinatura" | "abas";

/**
 * A ordem é a das travas da `api`: a senha provisória vem antes de tudo; quem aguarda a liberação ainda não é cobrado pela
 * assinatura; o administrador não usa o app (a gestão é na web); quem foi liberado e não cadastrou a assinatura vai cadastrá-la.
 */
export function destinoDaConta(eu: Pick<RespostaMe, "usuario">): Destino {
  const u = eu.usuario;
  if (u.senha_provisoria) return "trocar-senha";
  if (u.liberacao === "pendente") return "aguardando";
  if (u.perfil === "admin") return "somente-web";
  if (!u.assinatura_path) return "assinatura";
  return "abas";
}

/** O caminho de cada destino (o das abas é a lista de OS). */
export const rotaDoDestino: Record<Destino, string> = {
  "trocar-senha": "/trocar-senha",
  aguardando: "/aguardando",
  "somente-web": "/somente-web",
  assinatura: "/assinatura",
  abas: "/lista",
};
