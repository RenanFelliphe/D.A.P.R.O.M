"use server";

import { apiUrl } from "./sessao-comum";

export type ResultadoDoPedido = { ok: true } | { ok: false; erro: string };

/**
 * O pedido de conta da tela de entrada (`POST /solicitacoes-conta`), sem login. A `api` responde igual se o e-mail já tem conta ou
 * já pediu, para a tela não revelar nada disso; só os erros do próprio pedido voltam (dado inválido, muitos pedidos agora).
 */
export async function solicitarConta(dados: { nome: string; email: string; equipe_id: string | null }): Promise<ResultadoDoPedido> {
  let resposta: Response;
  try {
    resposta = await fetch(`${apiUrl()}/solicitacoes-conta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: dados.nome.trim(), email: dados.email.trim().toLowerCase(), equipe_id: dados.equipe_id || null }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, erro: "Servidor indisponível. Tente de novo em instantes." };
  }
  if (resposta.ok) return { ok: true };
  const corpo = (await resposta.json().catch(() => null)) as { erro?: { mensagem?: string } } | null;
  return { ok: false, erro: corpo?.erro?.mensagem ?? "Não foi possível enviar o pedido. Tente de novo." };
}
