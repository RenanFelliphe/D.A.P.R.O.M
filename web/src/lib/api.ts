import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { emResponse, responderTreino } from "../treino/api-ficticia";
import { rotaSempreReal, usuarioDoTreino } from "../treino/sessao";
import { CABECALHO_ENDERECO, COOKIE_ACESSO, apiUrl } from "./sessao-comum";
import type { MinhaAusencia } from "./ausencia";
import type { ResumoDaBarra } from "./gamificacao";
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
 *
 * No Campo de treino (cookie `treino=1` e usuário `tecnico`) a `api` real NÃO é chamada: quem responde é a API fictícia
 * (`treino/api-ficticia.ts`), com a mesma forma de resposta.
 */
export async function chamarApi(caminho: string, opcoes: OpcoesApi = {}): Promise<Response> {
  const token = (await cookies()).get(COOKIE_ACESSO)?.value;
  if (!token) redirect("/app/entrar");
  const metodo = opcoes.metodo ?? (opcoes.corpo === undefined ? "GET" : "POST");
  // O treino só vale na área de campo: o `proxy.ts` informa o endereço; `/web` e `/doc` seguem na `api` real.
  const endereco = (await headers()).get(CABECALHO_ENDERECO) ?? "";
  const noTreino = endereco.startsWith("/web") || endereco.startsWith("/doc") ? null : await usuarioDoTreino(token);
  if (noTreino && !rotaSempreReal(metodo, caminho)) {
    return emResponse(await responderTreino(noTreino, metodo, caminho, opcoes.consulta, opcoes.corpo));
  }
  const resposta = await fetch(montarUrl(caminho, opcoes.consulta), {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, ...(opcoes.corpo === undefined ? {} : { "Content-Type": "application/json" }) },
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
    cache: "no-store",
  });
  if (resposta.status === 401) redirect("/app/entrar");
  if (resposta.status === 403) {
    // Com a senha inicial só a troca de senha está liberada: leva à tela "Defina sua senha".
    const corpo = await resposta.clone().json().catch(() => null);
    if (corpo?.erro?.codigo === "senha_provisoria") redirect("/app/trocar-senha");
    // Cadastro ainda não liberado por um admin: só o Campo de treino e a tela de espera funcionam (ela não chama nada que a `api` trave).
    if (corpo?.erro?.codigo === "aguardando_liberacao" && endereco !== "/app/aguardando") redirect("/app/aguardando");
    // Cadastro recusado com a sessão ainda aberta: volta à entrada, onde o login mostra o motivo.
    if (corpo?.erro?.codigo === "acesso_recusado") redirect("/app/entrar");
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
export const usuarioAtual = cache(async () => {
  const eu = await api<{ usuario: Usuario; equipe: Equipe | null; equipes_supervisionadas: { id: string; nome: string }[]; gamificacao?: ResumoDaBarra | null; ausencia?: MinhaAusencia | null }>("/me");
  // O resumo da gamificação não vem no campo de treino (a `api` fictícia não o conhece): sem ele a barra não mostra o selo.
  // A ausência (em curso ou vencida) vem à parte, com o motivo e o pedido de fim antecipado: a faixa e a tela de retorno a usam.
  return { usuario: { ...eu.usuario, equipes_supervisionadas: eu.equipes_supervisionadas, gamificacao: eu.gamificacao ?? null }, equipe: eu.equipe, ausencia: eu.ausencia ?? null };
});
