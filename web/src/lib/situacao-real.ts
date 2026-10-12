import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_ACESSO, apiUrl } from "./sessao-comum";
import type { Equipe, Usuario } from "./tipos";

/**
 * `GET /me` da `api` REAL, mesmo com o Campo de treino ligado (`usuarioAtual` responderia a API fictícia, com a liberação
 * guardada por até um minuto). É a única consulta da tela "Aguardando liberação": o `/me` é liberado para o técnico pendente,
 * então nada aqui esbarra em `403 aguardando_liberacao`. Sem sessão ou com a sessão recusada, leva à entrada.
 */
export async function usuarioRealAgora(): Promise<{ usuario: Usuario; equipe: Equipe | null }> {
  const token = (await cookies()).get(COOKIE_ACESSO)?.value;
  if (!token) redirect("/app/entrar");
  let resposta: Response;
  try {
    resposta = await fetch(`${apiUrl()}/me`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  } catch {
    throw new Error("Servidor indisponível. Tente de novo em instantes.");
  }
  if (resposta.status === 401 || resposta.status === 403) redirect("/app/entrar");
  if (!resposta.ok) throw new Error("Não foi possível consultar a situação do seu acesso.");
  const eu = (await resposta.json()) as { usuario: Usuario; equipe: Equipe | null };
  return { usuario: eu.usuario, equipe: eu.equipe ?? null };
}
