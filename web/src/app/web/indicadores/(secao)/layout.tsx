import type { ReactNode } from "react";
import { Screen } from "@/components/ui/Screen";
import { AbasSecao } from "@/components/web/AbasSecao";
import { CHAVES_DO_FILTRO } from "@/components/web/indicadores/filtro";
import { abasDeIndicadores } from "@/components/web/indicadores/secao";

/**
 * Seção Indicadores e exportação: o título e as abas dos quatro dashboards (geral, equipes e usuários, OS e APR). O
 * filtro (período e equipe) acompanha a troca de aba.
 */
export default function SecaoIndicadoresLayout({ children }: { children: ReactNode }) {
  return (
    <Screen>
      <h1>Indicadores e exportação</h1>
      <AbasSecao rotulo="Dashboards de Indicadores e exportação" abas={abasDeIndicadores} manterConsulta={[...CHAVES_DO_FILTRO]} />
      {children}
    </Screen>
  );
}
