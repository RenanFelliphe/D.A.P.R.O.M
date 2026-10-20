import { NextResponse } from "next/server";

/**
 * Redireciona para um caminho do próprio painel ("/app/lista?treino=livre") com o `Location` relativo. Numa rota do
 * servidor (route handler), o `req.url` traz o endereço interno do Next atrás do proxy da hospedagem
 * (`http://localhost:3000`), e `new URL(caminho, req.url)` mandaria o navegador para lá; relativo, ele fica no domínio em
 * que está. O `proxy.ts` não precisa: o Next já torna relativo o redirecionamento que ele devolve.
 */
export function redirecionarNoPainel(caminho: string, consulta?: Record<string, string>) {
  const busca = consulta ? `?${new URLSearchParams(consulta)}` : "";
  return new NextResponse(null, { status: 307, headers: { Location: `${caminho}${busca}` } });
}
