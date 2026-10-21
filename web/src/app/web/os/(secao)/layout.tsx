import type { ReactNode } from "react";
import { Screen } from "@/components/ui/Screen";
import { CabecalhoSecaoOs } from "@/components/web/os/CabecalhoSecaoOs";

/** Abas Importação e Mapa de Calor da seção Ordem de Serviço: o título e as abas em volta delas (o Quadro fica em `/app/lista`). */
export default function SecaoOsLayout({ children }: { children: ReactNode }) {
  return (
    <Screen>
      <CabecalhoSecaoOs />
      {children}
    </Screen>
  );
}
