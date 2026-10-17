import "server-only";
import { emTreino } from "../lib/treino-modo";
import { apiUrl } from "../lib/sessao-comum";
import type { Usuario } from "../lib/tipos";

/**
 * Liga a sessão real ao Campo de treino (só servidor): descobre quem é o técnico pelo token (`GET /me` da `api` real, lido
 * no máximo uma vez por minuto por token) e diz se a chamada deve ir para a API fictícia. É a única coisa que o treino
 * pede à `api` real.
 */

const VALIDADE_MS = 60_000;
const LIMITE = 200;
const cache = new Map<string, { ate: number; usuario: Promise<Usuario | null> }>();

/** O usuário dono do token (`GET /me` real), ou `null` se a `api` não o reconhece ou está fora do ar. */
export function usuarioReal(token: string): Promise<Usuario | null> {
  const agora = Date.now();
  const guardado = cache.get(token);
  if (guardado && guardado.ate > agora) return guardado.usuario;
  if (cache.size >= LIMITE) cache.clear();
  const usuario = (async () => {
    try {
      const r = await fetch(`${apiUrl()}/me`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!r.ok) return null;
      return ((await r.json()) as { usuario: Usuario }).usuario;
    } catch {
      return null;
    }
  })();
  cache.set(token, { ate: agora + VALIDADE_MS, usuario });
  // Falha não fica guardada: a próxima chamada tenta de novo.
  void usuario.then((u) => u ?? cache.delete(token));
  return usuario;
}

/**
 * O técnico a atender com a API fictícia: o cookie `treino=1` está ligado e o usuário real é `tecnico`. Fora do treino,
 * ou para o administrador, devolve `null` e nada é lido na `api` real.
 */
export async function usuarioDoTreino(token: string): Promise<Usuario | null> {
  if (!(await emTreino())) return null;
  const usuario = await usuarioReal(token);
  return usuario && usuario.perfil === "tecnico" ? usuario : null;
}

/**
 * Chamadas que, mesmo no treino, vão à `api` real: `PUT /me/treinamento` (guarda o estado do próprio treino, não é dado
 * de campo) e tudo em `/vitoria` (o assistente de ajuda — `vitoria.md`, seção 2.1 — só consulta o manual e o manifesto
 * de destinos, nunca lê nem grava dado de OS, por isso funciona igual dentro e fora do Campo de treino).
 */
export function rotaSempreReal(metodo: string, caminho: string): boolean {
  const limpo = caminho.split("?")[0]!.replace(/^\/+|\/+$/g, "");
  if (limpo === "vitoria" || limpo.startsWith("vitoria/")) return true;
  return metodo.toUpperCase() === "PUT" && limpo === "me/treinamento";
}
