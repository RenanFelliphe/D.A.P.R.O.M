import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_ACESSO, apiUrl } from "@/lib/sessao-comum";

/**
 * Ponte entre o navegador e a `api`: o JavaScript do cliente chama `/api/...` (mesma origem) e este handler junta o
 * token do cookie `httpOnly` antes de repassar. O corpo é repassado como veio (JSON, multipart de fotos, etc.) e a
 * resposta (JSON, PDF, .xlsx) volta com os cabeçalhos que importam. Quem autoriza continua sendo a `api`.
 */
async function encaminhar(req: NextRequest, contexto: { params: Promise<{ caminho: string[] }> }) {
  const { caminho } = await contexto.params;
  if (caminho[0] === "sap-simulado") return NextResponse.json({ erro: { codigo: "proibido", mensagem: "Rota indisponível" } }, { status: 403 });

  const token = (await cookies()).get(COOKIE_ACESSO)?.value;
  if (!token) return NextResponse.json({ erro: { codigo: "nao_autenticado", mensagem: "Sessão inválida ou expirada" } }, { status: 401 });

  const destino = new URL(`${apiUrl()}/${caminho.map(encodeURIComponent).join("/")}`);
  destino.search = req.nextUrl.search;

  const cabecalhos: Record<string, string> = { Authorization: `Bearer ${token}` };
  const tipo = req.headers.get("content-type");
  if (tipo) cabecalhos["Content-Type"] = tipo;
  const temCorpo = req.method !== "GET" && req.method !== "HEAD";

  let resposta: Response;
  try {
    resposta = await fetch(destino, { method: req.method, headers: cabecalhos, body: temCorpo ? await req.arrayBuffer() : undefined, redirect: "manual", cache: "no-store" });
  } catch {
    return NextResponse.json({ erro: { codigo: "api_indisponivel", mensagem: "Servidor indisponível. Tente de novo." } }, { status: 502 });
  }

  const saida = new Headers();
  for (const nome of ["content-type", "content-disposition", "x-mensagem", "content-length"]) {
    const valor = resposta.headers.get(nome);
    if (valor) saida.set(nome, valor);
  }
  saida.set("cache-control", "private, no-store");
  return new Response(resposta.body, { status: resposta.status, headers: saida });
}

export { encaminhar as GET, encaminhar as POST, encaminhar as PUT, encaminhar as PATCH, encaminhar as DELETE };
