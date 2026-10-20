import { redirecionarNoPainel } from "@/lib/redirecionar";
import { rotas } from "@/lib/rotas";
import { COOKIE_TREINO } from "@/lib/treino-modo";

/** Desliga o campo de treino e volta à lista real; `?treino=fim` manda o navegador limpar o tutorial e o estado local. */
export function GET() {
  const resposta = redirecionarNoPainel(rotas.app.lista, { treino: "fim" });
  resposta.cookies.delete(COOKIE_TREINO);
  return resposta;
}
