import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_ACESSO, apiUrl } from "@/lib/sessao-comum";

const ESTADOS = ["nao_iniciado", "concluido", "pulado"];

/**
 * Grava o estado do treinamento na `api` REAL (`PUT /me/treinamento`), mesmo com o modo treino ligado: o progresso
 * da pessoa é dado do sistema real, e a `api` fictícia (`/api/*` em treino) não o guarda.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_ACESSO)?.value;
  if (!token) return NextResponse.json({ erro: { codigo: "nao_autenticado", mensagem: "Sessão inválida ou expirada" } }, { status: 401 });

  const corpo = (await req.json().catch(() => null)) as { estado?: string } | null;
  if (!corpo?.estado || !ESTADOS.includes(corpo.estado)) {
    return NextResponse.json({ erro: { codigo: "invalido", mensagem: "Estado de treinamento inválido" } }, { status: 400 });
  }
  try {
    const resposta = await fetch(`${apiUrl()}/me/treinamento`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ estado: corpo.estado }),
      cache: "no-store",
    });
    if (!resposta.ok) return NextResponse.json({ erro: { codigo: "falhou", mensagem: "Não foi possível salvar agora. Tente de novo." } }, { status: 502 });
  } catch {
    return NextResponse.json({ erro: { codigo: "api_indisponivel", mensagem: "Servidor indisponível. Tente de novo." } }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
