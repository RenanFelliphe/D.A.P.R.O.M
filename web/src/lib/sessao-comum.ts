/** Constantes e funções puras da sessão, usadas pelo proxy, pelas ações do servidor e pelo handler `/api`. */

export const COOKIE_ACESSO = "syncos_at";
export const COOKIE_RENOVACAO = "syncos_rt";
/** Cabeçalho que o `proxy.ts` põe na requisição com o endereço pedido (só o servidor lê). */
export const CABECALHO_ENDERECO = "x-syncos-endereco";

/** Endereço da `api` (variável `API_URL`, só do servidor do `web`). */
export const apiUrl = () => (process.env.API_URL ?? "http://localhost:3333").replace(/\/$/, "");

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** Instante em que o `accessToken` expira (ISO 8601). */
  expiraEm: string;
}

/**
 * Cookies `httpOnly`: o JavaScript do navegador nunca vê os tokens. `secure` acompanha o protocolo da requisição
 * (`https`, de `chegouPorHttps`): o navegador recusa cookie `secure` vindo por HTTP, e o login aberto pelo IP da rede (um
 * celular na demonstração) pararia de funcionar. Sem saber o protocolo, vale o ambiente; `COOKIE_SEGURO=true|false` força.
 */
export function opcoesDoCookie(expira?: Date, https?: boolean) {
  const forcado = process.env.COOKIE_SEGURO;
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: forcado ? forcado === "true" : (https ?? process.env.NODE_ENV === "production"),
    path: "/",
    ...(expira ? { expires: expira } : {}),
  };
}

/** A requisição chegou por HTTPS: direto, ou atrás do proxy da hospedagem, que informa `x-forwarded-proto`. */
export function chegouPorHttps(cabecalhos: Headers, url?: URL): boolean {
  const protocolo = cabecalhos.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  return protocolo ? protocolo === "https" : url?.protocol === "https:";
}

/**
 * Endereço para voltar depois do login (`?para=`, como o link do e-mail de alerta): só um caminho do próprio painel,
 * nunca outro site, a raiz ou a própria tela de entrada. `null` quando não serve.
 */
export function destinoInterno(valor: unknown): string | null {
  if (typeof valor !== "string" || !valor.startsWith("/") || valor.startsWith("//") || valor.startsWith("/\\")) return null;
  if (valor === "/" || valor.startsWith("/app/entrar") || valor.startsWith("/api/")) return null;
  return valor;
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
