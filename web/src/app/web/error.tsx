"use client";

import { ErroDaPagina } from "@/components/erro/ErroDaPagina";
import { rotas } from "@/lib/rotas";

export default function ErroDoPainel({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErroDaPagina error={error} retry={retry} inicio={rotas.web.quadro} />;
}
