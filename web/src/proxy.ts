import { NextResponse, type NextRequest } from "next/server";
import {
  CABECALHO_ENDERECO,
  COOKIE_ACESSO,
  COOKIE_RENOVACAO,
  apiUrl,
  chegouPorHttps,
  destinoInterno,
  expiracaoDoJwt,
  opcoesDoCookie,
  validadeDaRenovacao,
} from "@/lib/sessao-comum";

/** Renova o token quando falta menos que isto para vencer. */
const MARGEM_MS = 60_000;

const ENTRAR = "/app/entrar";
/** O pedido de conta, aberto a quem ainda não tem login (como a própria entrada). */
const SOLICITAR_CONTA = "/app/entrar/solicitar";

/** Acrescenta à requisição o endereço pedido (o Campo de treino só vale na área de campo, `/app`; ver `lib/api.ts`). */
const comEndereco = (req: NextRequest, base: Headers = new Headers(req.headers)) => {
  base.set(CABECALHO_ENDERECO, req.nextUrl.pathname);
  return base;
};

/** A tela de entrada, lembrando o endereço pedido (o link do e-mail de alerta, por exemplo) para voltar a ele depois do login. */
function telaDeEntrada(req: NextRequest) {
  const url = new URL(ENTRAR, req.url);
  const pedido = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  if (destinoInterno(pedido)) url.searchParams.set("para", pedido);
  return url;
}

function semSessao(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const resposta = pathname.startsWith("/api/")
    ? NextResponse.json({ erro: { codigo: "nao_autenticado", mensagem: "Sessão inválida ou expirada" } }, { status: 401 })
    : NextResponse.redirect(telaDeEntrada(req));
  resposta.cookies.delete(COOKIE_ACESSO);
  resposta.cookies.delete(COOKIE_RENOVACAO);
  return resposta;
}

/**
 * Porteiro das áreas logadas: sem sessão vai para a tela de entrada, e o token que está para vencer é renovado aqui
 * (é o único lugar que pode gravar cookies antes da renderização). A tela de entrada e os arquivos estáticos passam.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === ENTRAR || pathname === SOLICITAR_CONTA) return NextResponse.next();

  const acesso = req.cookies.get(COOKIE_ACESSO)?.value;
  const renovacao = req.cookies.get(COOKIE_RENOVACAO)?.value;
  if (!acesso && !renovacao) return semSessao(req);

  const expira = acesso ? expiracaoDoJwt(acesso) : null;
  if (acesso && expira && expira - Date.now() > MARGEM_MS) return NextResponse.next({ request: { headers: comEndereco(req) } });
  if (!renovacao) return semSessao(req);

  let novos: { accessToken: string; refreshToken: string; expiraEm: string } | null = null;
  try {
    const r = await fetch(`${apiUrl()}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: renovacao }),
      cache: "no-store",
    });
    if (r.ok) {
      const j = await r.json();
      novos = { accessToken: j.access_token, refreshToken: j.refresh_token ?? renovacao, expiraEm: j.expira_em };
    } else if (r.status === 401) {
      return semSessao(req);
    }
  } catch {
    /* api fora do ar: segue com o token atual; a página mostra o erro */
  }
  if (!novos) return NextResponse.next({ request: { headers: comEndereco(req) } });

  // A renderização desta mesma requisição precisa enxergar os cookies novos: reescreve o cabeçalho `cookie` da requisição.
  const cabecalhos = comEndereco(req);
  const outros = (req.headers.get("cookie") ?? "")
    .split(/;\s*/)
    .filter((c) => c && !c.startsWith(`${COOKIE_ACESSO}=`) && !c.startsWith(`${COOKIE_RENOVACAO}=`));
  cabecalhos.set("cookie", [...outros, `${COOKIE_ACESSO}=${novos.accessToken}`, `${COOKIE_RENOVACAO}=${novos.refreshToken}`].join("; "));
  const resposta = NextResponse.next({ request: { headers: cabecalhos } });
  const https = chegouPorHttps(req.headers, req.nextUrl);
  resposta.cookies.set(COOKIE_ACESSO, novos.accessToken, opcoesDoCookie(new Date(novos.expiraEm), https));
  resposta.cookies.set(COOKIE_RENOVACAO, novos.refreshToken, opcoesDoCookie(validadeDaRenovacao(), https));
  return resposta;
}

export const config = {
  matcher: ["/app/:path*", "/web/:path*", "/doc/:path*", "/simulador/:path*", "/api/:path*"],
};
