import type { ReactNode } from "react";
import { Screen } from "@/components/ui/Screen";
import { AbasSecao } from "@/components/web/AbasSecao";
import { abasDoPerfil } from "@/components/web/os/secao";
import { usuarioAtual } from "@/lib/api";

/**
 * Seção Ordem de Serviço: o título e as abas Quadro e Importação em volta das duas telas (os gráficos da entrada de OS
 * ficam no dashboard de OS, em Indicadores e exportação). Quem só vê o
 * Quadro (supervisor) fica sem a barra de abas. O detalhe da OS (`/web/os/{id}`) fica fora.
 */
export default async function SecaoOsLayout({ children }: { children: ReactNode }) {
  const { usuario } = await usuarioAtual();
  const abas = abasDoPerfil(usuario);
  return (
    <Screen>
      <h1>Ordem de Serviço</h1>
      {abas.length > 1 && <AbasSecao rotulo="Seções de Ordem de Serviço" abas={abas} />}
      {children}
    </Screen>
  );
}
