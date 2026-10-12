"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ErroDaApi, api } from "./api";
import { COOKIE_ACESSO, COOKIE_RENOVACAO, apiUrl, opcoesDoCookie, validadeDaRenovacao } from "./sessao-comum";
import { rotas } from "./rotas";
import { inicioDoUsuario } from "./inicio";
import { COOKIE_TREINO_ADIADO } from "./treino-comum";
import { COOKIE_TREINO } from "./treino-modo";
import { ehAdmin, estaPendente, type Liberacao, type Perfil } from "./tipos";

export interface EstadoDoFormulario {
  erro?: string;
  /** E-mail digitado, devolvido junto do erro para o campo não ser apagado. */
  email?: string;
}

/** Login pelo e-mail institucional: confere na `api`, guarda os tokens em cookies `httpOnly` e leva ao início do papel. */
export async function entrar(_anterior: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const senha = String(form.get("senha") ?? "");
  if (!email || !senha) return { erro: "Informe o e-mail e a senha.", email };

  let resposta: Response;
  try {
    resposta = await fetch(`${apiUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
      cache: "no-store",
    });
  } catch {
    return { erro: "Servidor indisponível. Tente de novo em instantes.", email };
  }
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const codigo = dados?.erro?.codigo;
    // `acesso_recusado`: a mensagem da `api` traz o motivo informado pelo administrador. `aguardando_liberacao` não deve vir no login.
    const padrao = codigo === "acesso_recusado" ? "Seu cadastro foi recusado. Procure o seu supervisor." : codigo === "aguardando_liberacao" ? "Seu acesso está aguardando liberação de um administrador." : "Não foi possível entrar.";
    return { erro: dados?.erro?.mensagem ?? padrao, email };
  }

  const jar = await cookies();
  jar.set(COOKIE_ACESSO, dados.access_token, opcoesDoCookie(new Date(dados.expira_em)));
  jar.set(COOKIE_RENOVACAO, dados.refresh_token, opcoesDoCookie(validadeDaRenovacao()));
  // O técnico passa pela raiz: se supervisiona equipes, ela o leva ao painel de gestão (o login não devolve as equipes).
  redirect(dados.senha_provisoria ? rotas.app.trocarSenha : ehAdmin(dados.usuario) ? rotas.web.quadro : estaPendente(dados.usuario ?? {}) ? rotas.app.aguardando : "/");
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
  const eu = await api<{ usuario: { perfil: Perfil; liberacao?: Liberacao }; equipes_supervisionadas?: { id: string; nome: string }[] }>("/me");
  redirect(inicioDoUsuario({ ...eu.usuario, equipes_supervisionadas: eu.equipes_supervisionadas }));
}

/** Encerra a sessão neste navegador. */
export async function sair() {
  const jar = await cookies();
  jar.delete(COOKIE_ACESSO);
  jar.delete(COOKIE_RENOVACAO);
  // O campo de treino vale só na sessão: ao sair o modo treino acaba e as boas-vindas voltam no próximo login.
  jar.delete(COOKIE_TREINO);
  jar.delete(COOKIE_TREINO_ADIADO);
  redirect(rotas.app.entrar);
}
