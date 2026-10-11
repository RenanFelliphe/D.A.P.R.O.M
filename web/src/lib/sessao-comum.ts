/** Constantes e funções puras da sessão, usadas pelo proxy, pelas ações do servidor e pelo handler `/api`. */

export const COOKIE_ACESSO = "daprom_at";
export const COOKIE_RENOVACAO = "daprom_rt";

/** Endereço da `api` (variável `API_URL`, só do servidor do `web`). */
export const apiUrl = () => (process.env.API_URL ?? "http://localhost:3333").replace(/\/$/, "");

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** Instante em que o `accessToken` expira (ISO 8601). */
  expiraEm: string;
}

/** Cookies `httpOnly`: o JavaScript do navegador nunca vê os tokens. */
export function opcoesDoCookie(expira?: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.COOKIE_SEGURO ? process.env.COOKIE_SEGURO === "true" : process.env.NODE_ENV === "production",
    path: "/",
    ...(expira ? { expires: expira } : {}),
  };
}

const TRINTA_DIAS_MS = 30 * 24 * 3600 * 1000;
export const validadeDaRenovacao = () => new Date(Date.now() + TRINTA_DIAS_MS);

/** Instante de expiração (`exp`) de um JWT, sem validar a assinatura: só decide quando renovar. */
export function expiracaoDoJwt(token: string): number | null {
  try {
    const carga = token.split(".")[1];
    if (!carga) return null;
    const json = JSON.parse(atob(carga.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}
