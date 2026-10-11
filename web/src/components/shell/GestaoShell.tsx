import type { ReactNode } from "react";
import { rotas } from "@/lib/telas";
import { BarraGestao } from "./Barras";
import { MenuLateral, type ItemMenu } from "./MenuLateral";
import { Shell } from "./Shell";

const itens: ItemMenu[] = [
  { href: rotas.web.quadro, icone: "grid", rotulo: "Quadro de OS" },
  { href: rotas.web.alertas, icone: "bell", rotulo: "Alertas", contador: "alertas" },
  { href: rotas.web.importacao, icone: "upload", rotulo: "Importação SAP" },
  { href: rotas.web.indicadores, icone: "bars", rotulo: "Indicadores e exportação" },
  { href: rotas.web.modelos, icone: "clip", rotulo: "Modelos de APR" },
  { href: rotas.web.usuarios, icone: "users", rotulo: "Equipes e usuários" },
];

/** Casca do painel de gestão (supervisor, analista e Segurança do Trabalho). */
export function GestaoShell({ children }: { children: ReactNode }) {
  return (
    <Shell
      topbar={<BarraGestao />}
      menu={
        <MenuLateral
          titulo="Menu do painel"
          itens={itens}
          outraArea={{ href: rotas.app.lista, icone: "list", rotulo: "Área do técnico" }}
          rodape="Dados fictícios · protótipo visual"
        />
      }
    >
      {children}
    </Shell>
  );
}
