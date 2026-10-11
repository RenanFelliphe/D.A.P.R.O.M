import type { Metadata } from "next";
import { Screen } from "@/components/ui/Screen";
import { CabecalhoUsuarios } from "@/components/web/usuarios/CabecalhoUsuarios";
import { ListaEquipes } from "@/components/web/usuarios/ListaEquipes";
import { ListaPerfis } from "@/components/web/usuarios/ListaPerfis";
import { TabelaUsuarios } from "@/components/web/usuarios/TabelaUsuarios";

export const metadata: Metadata = { title: "Equipes e usuários" };

export default function UsuariosPage() {
  return (
    <Screen>
      <CabecalhoUsuarios />
      <div className="two">
        <TabelaUsuarios />
        <aside className="stack g16">
          <ListaEquipes />
          <ListaPerfis />
        </aside>
      </div>
    </Screen>
  );
}
