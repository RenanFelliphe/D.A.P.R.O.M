import type { NextRequest } from "next/server";
import { redirecionarNoPainel } from "@/lib/redirecionar";
import { rotas } from "@/lib/rotas";
import { COOKIE_ACESSO, apiUrl, chegouPorHttps, opcoesDoCookie } from "@/lib/sessao-comum";
import { COOKIE_TREINO_ADIADO } from "@/lib/treino-comum";
import { COOKIE_TREINO } from "@/lib/treino-modo";

/** Só o técnico (supervisor incluso) treina: o admin segue para o painel, sem o cookie do modo treino. */
async function ehAdmin(token: string | undefined) {
  if (!token) return false;
  try {
    const resposta = await fetch(`${apiUrl()}/me`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!resposta.ok) return false;
    const eu = (await resposta.json()) as { usuario?: { perfil?: string } };
    return eu.usuario?.perfil === "admin";
  } catch {
    return false;
  }
}

/**
 * Liga o campo de treino: grava o cookie `treino=1` (de sessão, `httpOnly`) e leva à lista. A modalidade escolhida
 * (`?modo=direcionado|livre`) segue na URL para o navegador guardá-la; sem ela, a lista abre a escolha.
 */
export async function GET(req: NextRequest) {
  if (await ehAdmin(req.cookies.get(COOKIE_ACESSO)?.value)) return redirecionarNoPainel(rotas.app.lista);

  const modo = req.nextUrl.searchParams.get("modo");
  const resposta = redirecionarNoPainel(rotas.app.lista, { treino: modo === "direcionado" || modo === "livre" ? modo : "escolher" });
  resposta.cookies.set(COOKIE_TREINO, "1", opcoesDoCookie(undefined, chegouPorHttps(req.headers, req.nextUrl)));
  // Quem entra no treino não precisa das boas-vindas do sistema real ao voltar.
  resposta.cookies.set(COOKIE_TREINO_ADIADO, "1", { sameSite: "lax", path: "/" });
  return resposta;
}
