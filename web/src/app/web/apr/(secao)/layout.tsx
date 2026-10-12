import type { ReactNode } from "react";
import { Screen } from "@/components/ui/Screen";
import { AbasSecao } from "@/components/web/AbasSecao";
import { abasApr } from "@/components/web/apr/secao";

/**
 * Seção APR (Análise Preliminar de Risco): o título e as abas Modelos e Atividades. O modelo aberto
 * (`/web/apr/modelos/{codigo}`) e o cadastro de um modelo novo ficam fora, como o detalhe da OS.
 */
export default function SecaoAprLayout({ children }: { children: ReactNode }) {
  return (
    <Screen>
      <h1>Análise Preliminar de Risco (APR)</h1>
      <AbasSecao rotulo="Seções de APR" abas={abasApr} />
      {children}
    </Screen>
  );
}
