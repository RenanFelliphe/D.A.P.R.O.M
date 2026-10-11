import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { COOKIE_ACESSO, apiUrl } from "./sessao-comum";
import type { Equipe, Usuario } from "./tipos";

/** Erro de uma resposta da `api` (`{erro: {codigo, mensagem}}`). */
export class ErroDaApi extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export interface OpcoesApi {
  metodo?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Corpo JSON. */
  corpo?: unknown;
  /** Query string; valores `undefined`, `null` e vazios são omitidos. */
  consulta?: Record<string, string | number | boolean | null | undefined>;
}

function montarUrl(caminho: string, consulta: OpcoesApi["consulta"]) {
  const url = new URL(`${apiUrl()}${caminho.startsWith("/") ? caminho : `/${caminho}`}`);
  for (const [chave, valor] of Object.entries(consulta ?? {})) {
    if (valor !== undefined && valor !== null && valor !== "") url.searchParams.set(chave, String(valor));
  }
  return url;
}

/**
 * Chama a `api` com o token da sessão (cookie `httpOnly`). Só roda no servidor: componentes de servidor e ações. Sem
 * sessão ou com a sessão recusada (`401`), leva o usuário para a tela de entrada; o `proxy.ts` já renova o token que está
 * perto de vencer, então um `401` aqui é sessão revogada. Respostas de erro viram `ErroDaApi`.
 */
export async function chamarApi(caminho: string, opcoes: OpcoesApi = {}): Promise<Response> {
  const token = (await cookies()).get(COOKIE_ACESSO)?.value;
  if (!token) redirect("/app/entrar");
  const resposta = await fetch(montarUrl(caminho, opcoes.consulta), {
    method: opcoes.metodo ?? (opcoes.corpo === undefined ? "GET" : "POST"),
    headers: { Authorization: `Bearer ${token}`, ...(opcoes.corpo === undefined ? {} : { "Content-Type": "application/json" }) },
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
    cache: "no-store",
  });
  if (resposta.status === 401) redirect("/app/entrar");
  if (resposta.status === 403) {
    // Com a senha inicial só a troca de senha está liberada: leva à tela "Defina sua senha".
    const corpo = await resposta.clone().json().catch(() => null);
    if (corpo?.erro?.codigo === "senha_provisoria") redirect("/app/trocar-senha");
  }
  return resposta;
}

/** Como `chamarApi`, devolvendo o JSON; qualquer status fora de 2xx lança `ErroDaApi` com a mensagem da `api`. */
export async function api<T = unknown>(caminho: string, opcoes: OpcoesApi = {}): Promise<T> {
  const resposta = await chamarApi(caminho, opcoes);
  const texto = await resposta.text();
  const dados = texto ? JSON.parse(texto) : {};
  if (!resposta.ok) {
    throw new ErroDaApi(resposta.status, dados?.erro?.codigo ?? "erro", dados?.erro?.mensagem ?? "Erro ao falar com o servidor");
  }
  return dados as T;
}

/** Como `api`, mas `404` vira `null` (registro que não existe ou que o usuário não pode ver). */
export async function apiOuNulo<T = unknown>(caminho: string, opcoes: OpcoesApi = {}): Promise<T | null> {
  try {
    return await api<T>(caminho, opcoes);
  } catch (erro) {
    if (erro instanceof ErroDaApi && erro.status === 404) return null;
    throw erro;
  }
}

/** Usuário logado e a equipe dele (`GET /me`), lido uma vez por requisição. */
export const usuarioAtual = cache(() => api<{ usuario: Usuario; equipe: Equipe | null }>("/me"));
