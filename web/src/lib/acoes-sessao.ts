"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ErroDaApi, api } from "./api";
import { COOKIE_ACESSO, COOKIE_RENOVACAO, apiUrl, opcoesDoCookie, validadeDaRenovacao } from "./sessao-comum";
import { rotas } from "./rotas";
import { inicioDoPerfil } from "./inicio";
import type { Perfil } from "./tipos";

export interface EstadoDoFormulario {
  erro?: string;
}

/** Login por matrícula: confere na `api`, guarda os tokens em cookies `httpOnly` e leva ao início do perfil. */
export async function entrar(_anterior: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const matricula = String(form.get("matricula") ?? "").trim();
  const senha = String(form.get("senha") ?? "");
  if (!matricula || !senha) return { erro: "Informe a matrícula e a senha." };

  let resposta: Response;
  try {
    resposta = await fetch(`${apiUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matricula, senha }),
      cache: "no-store",
    });
  } catch {
    return { erro: "Servidor indisponível. Tente de novo em instantes." };
  }
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) return { erro: dados?.erro?.mensagem ?? "Não foi possível entrar." };

  const jar = await cookies();
  jar.set(COOKIE_ACESSO, dados.access_token, opcoesDoCookie(new Date(dados.expira_em)));
  jar.set(COOKIE_RENOVACAO, dados.refresh_token, opcoesDoCookie(validadeDaRenovacao()));
  redirect(dados.senha_provisoria ? rotas.app.trocarSenha : inicioDoPerfil(dados.usuario.perfil));
}

/** Troca da senha inicial (obrigatória no primeiro acesso) ou da senha atual. */
export async function trocarSenha(_anterior: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const atual = String(form.get("senha_atual") ?? "");
  const nova = String(form.get("senha_nova") ?? "");
  const confirmacao = String(form.get("confirmacao") ?? "");
  if (nova !== confirmacao) return { erro: "A confirmação não confere com a senha nova." };

  try {
    await api("/auth/trocar-senha", { corpo: { senha_atual: atual, senha_nova: nova } });
  } catch (erro) {
    if (erro instanceof ErroDaApi) return { erro: erro.message };
    throw erro;
  }
  const { usuario } = await api<{ usuario: { perfil: Perfil } }>("/me");
  redirect(inicioDoPerfil(usuario.perfil));
}

/** Encerra a sessão neste navegador. */
export async function sair() {
  const jar = await cookies();
  jar.delete(COOKIE_ACESSO);
  jar.delete(COOKIE_RENOVACAO);
  redirect(rotas.app.entrar);
}
