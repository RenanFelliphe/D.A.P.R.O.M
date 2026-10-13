import type { ReactNode } from "react";
import { Screen } from "@/components/ui/Screen";
import { AbasSecao } from "@/components/web/AbasSecao";
import { abasDoCatalogo } from "@/components/web/catalogo/secao";

/**
 * Seção Catálogo de serviço, a mesma para todos os perfis: o título e as abas Serviços (o que cada serviço usa) e
 * Materiais (o cadastro de materiais, ferramentas e EPIs). Só o admin edita; os demais consultam.
 */
export default function SecaoCatalogoLayout({ children }: { children: ReactNode }) {
  return (
    <Screen>
      <h1>Catálogo de serviço</h1>
      <AbasSecao rotulo="Seções do catálogo" abas={abasDoCatalogo} />
      {children}
    </Screen>
  );
}
