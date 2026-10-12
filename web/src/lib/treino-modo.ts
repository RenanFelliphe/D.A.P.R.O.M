import "server-only";
import { cookies } from "next/headers";

/** Cookie que liga o modo treino; vale `"1"` enquanto o técnico está no campo de treino. Só o servidor lê (`httpOnly`). */
export const COOKIE_TREINO = "treino";

/** `true` quando a requisição vem do campo de treino: a `api` real não é chamada, responde a API fictícia (`treino/`). */
export async function emTreino(): Promise<boolean> {
  return (await cookies()).get(COOKIE_TREINO)?.value === "1";
}
