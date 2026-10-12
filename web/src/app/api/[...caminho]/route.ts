import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_ACESSO, apiUrl } from "@/lib/sessao-comum";
import { reiniciarTreino } from "@/treino/armazem";
import { arquivoDoTreino, emResponse, responderTreino } from "@/treino/api-ficticia";
import { rotaSempreReal, usuarioDoTreino, usuarioReal } from "@/treino/sessao";

/**
 * Ponte entre o navegador e a `api`: o JavaScript do cliente chama `/api/...` (mesma origem) e este handler junta o
 * token do cookie `httpOnly` antes de repassar. O corpo é repassado como veio (JSON, multipart de fotos, etc.) e a
 * resposta (JSON, PDF, .xlsx) volta com os cabeçalhos que importam. Quem autoriza continua sendo a `api`.
 *
 * Campo de treino: com o cookie `treino=1` e um usuário `tecnico`, a `api` real NÃO é chamada; o pedido é respondido pela
 * API fictícia (`treino/api-ficticia.ts`). Endereços próprios do treino, atendidos aqui: `POST /api/treino/reiniciar`
 * (recomeça o treino do usuário) e `GET /api/treino/arquivos/{id}` (imagens das fotos e assinaturas fictícias).
 */
async function encaminhar(req: NextRequest, contexto: { params: Promise<{ caminho: string[] }> }) {
  const { caminho } = await contexto.params;
  if (caminho[0] === "sap-simulado") return NextResponse.json({ erro: { codigo: "proibido", mensagem: "Rota indisponível" } }, { status: 403 });

  const token = (await cookies()).get(COOKIE_ACESSO)?.value;
  if (!token) return NextResponse.json({ erro: { codigo: "nao_autenticado", mensagem: "Sessão inválida ou expirada" } }, { status: 401 });

  if (caminho[0] === "treino") return atenderTreino(req, token, caminho.slice(1));

  const noTreino = await deveSerTreino(req, token, caminho.join("/"));
  if (noTreino) {
    const corpo = await lerCorpoParaTreino(req);
    return emResponse(await responderTreino(noTreino, req.method, `/${caminho.join("/")}`, req.nextUrl.searchParams, corpo));
  }

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

/**
 * O pedido é do Campo de treino? Sim com o cookie `treino=1` e técnico, salvo as chamadas que seguem na `api` real
 * (`rotaSempreReal`) e os pedidos feitos de dentro do painel de gestão (`Referer` em `/web`): um supervisor com o cookie
 * ligado continua vendo dados reais lá.
 */
async function deveSerTreino(req: NextRequest, token: string, caminho: string) {
  if (rotaSempreReal(req.method, caminho)) return null;
  const referencia = req.headers.get("referer");
  if (referencia) {
    try {
      const { pathname } = new URL(referencia);
      if (pathname.startsWith("/web") || pathname.startsWith("/doc")) return null;
    } catch {
      /* referência inválida: ignora */
    }
  }
  return usuarioDoTreino(token);
}

/** Lê o corpo do pedido como a API fictícia espera: JSON, ou `{arquivo, tipo}` no envio multipart de fotos e assinaturas. */
async function lerCorpoParaTreino(req: NextRequest): Promise<unknown> {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const tipo = req.headers.get("content-type") ?? "";
  try {
    if (tipo.includes("multipart/form-data")) return Object.fromEntries((await req.formData()).entries());
    const texto = await req.text();
    return texto ? JSON.parse(texto) : undefined;
  } catch {
    return undefined;
  }
}

/** `POST /api/treino/reiniciar` e `GET /api/treino/arquivos/{id}`. */
async function atenderTreino(req: NextRequest, token: string, resto: string[]) {
  const usuario = await usuarioReal(token);
  if (!usuario) return NextResponse.json({ erro: { codigo: "nao_autenticado", mensagem: "Sessão inválida ou expirada" } }, { status: 401 });

  if (resto.length === 1 && resto[0] === "reiniciar" && req.method === "POST") {
    reiniciarTreino(usuario.id);
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "private, no-store" } });
  }
  if (resto.length === 2 && resto[0] === "arquivos" && req.method === "GET") {
    const arquivo = arquivoDoTreino(usuario, decodeURIComponent(resto[1]!));
    if (!arquivo) return NextResponse.json({ erro: { codigo: "nao_encontrado", mensagem: "Arquivo não encontrado" } }, { status: 404 });
    return new Response(arquivo.bytes as unknown as BodyInit, { headers: { "content-type": arquivo.tipo, "cache-control": "private, max-age=60" } });
  }
  return NextResponse.json({ erro: { codigo: "nao_encontrado", mensagem: "Recurso do treino inexistente" } }, { status: 404 });
}

export { encaminhar as GET, encaminhar as POST, encaminhar as PUT, encaminhar as PATCH, encaminhar as DELETE };
