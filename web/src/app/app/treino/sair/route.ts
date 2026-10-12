import { NextResponse, type NextRequest } from "next/server";
import { rotas } from "@/lib/rotas";
import { COOKIE_TREINO } from "@/lib/treino-modo";

/** Desliga o campo de treino e volta à lista real; `?treino=fim` manda o navegador limpar o tutorial e o estado local. */
export function GET(req: NextRequest) {
  const destino = new URL(rotas.app.lista, req.url);
  destino.searchParams.set("treino", "fim");
  const resposta = NextResponse.redirect(destino);
  resposta.cookies.delete(COOKIE_TREINO);
  return resposta;
}
