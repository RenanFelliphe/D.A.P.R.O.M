"use client";

import { createContext, useContext, type ReactNode } from "react";

const AssinaturaContext = createContext<string | null>(null);

/** Guarda a assinatura do perfil de quem está logado (a imagem que as ações assinadas usam), para as telas não precisarem repassá-la. */
export function ProvedorDeAssinatura({ assinaturaPath, children }: { assinaturaPath: string | null; children: ReactNode }) {
  return <AssinaturaContext value={assinaturaPath}>{children}</AssinaturaContext>;
}

/** A assinatura do perfil de quem está logado; `null` = ainda não cadastrou (a casca já leva ao cadastro antes de qualquer tela). */
export function useMinhaAssinatura(): string | null {
  return useContext(AssinaturaContext);
}
