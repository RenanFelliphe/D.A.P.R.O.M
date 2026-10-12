"use client";

import { ErroDaPagina } from "@/components/erro/ErroDaPagina";
import { rotas } from "@/lib/rotas";

/** Erro numa tela do portal: aparece dentro da casca (menu e barra continuam), como no painel de gestão. */
export default function ErroDoPortal({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErroDaPagina error={error} retry={retry} inicio={rotas.app.lista} />;
}
