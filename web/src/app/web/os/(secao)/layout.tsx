import type { ReactNode } from "react";
import { Screen } from "@/components/ui/Screen";
import { CabecalhoSecaoOs } from "@/components/web/os/CabecalhoSecaoOs";

/** Aba Importação da seção Ordem de Serviço (só o admin): o título e as abas em volta dela (o Quadro fica em `/app`). */
export default function SecaoOsLayout({ children }: { children: ReactNode }) {
  return (
    <Screen>
      <CabecalhoSecaoOs />
      {children}
    </Screen>
  );
}
