"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ConfigDaAssinaturaJuridica } from "@/lib/assinatura-juridica";

const AssinaturaContext = createContext<string | null>(null);
const SEM_PROVEDOR: ConfigDaAssinaturaJuridica = { ligada: false, simulada: false };
const JuridicaContext = createContext<ConfigDaAssinaturaJuridica>(SEM_PROVEDOR);

/**
 * Guarda a assinatura do perfil de quem está logado (a imagem que as ações assinadas usam) e se os atos assinados passam pelo provedor
 * de assinatura com validade jurídica (`GET /me`), para as telas não precisarem repassá-los. No Campo de treino o provedor fica desligado.
 */
export function ProvedorDeAssinatura({ assinaturaPath, juridica = SEM_PROVEDOR, children }: { assinaturaPath: string | null; juridica?: ConfigDaAssinaturaJuridica; children: ReactNode }) {
  return (
    <AssinaturaContext value={assinaturaPath}>
      <JuridicaContext value={juridica}>{children}</JuridicaContext>
    </AssinaturaContext>
  );
}

/** A assinatura do perfil de quem está logado; `null` = ainda não cadastrou (a casca já leva ao cadastro antes de qualquer tela). */
export function useMinhaAssinatura(): string | null {
  return useContext(AssinaturaContext);
}

/** Os atos assinados passam pelo provedor de assinatura com validade jurídica (`ligada`) e ele é o simulado, sem validade (`simulada`)? */
export function useConfigDaAssinaturaJuridica(): ConfigDaAssinaturaJuridica {
  return useContext(JuridicaContext);
}
