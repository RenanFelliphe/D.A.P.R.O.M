import type { ReactNode } from "react";
import { rotas } from "@/lib/telas";
import { BarraTecnico } from "./Barras";
import { MenuLateral, type ItemMenu } from "./MenuLateral";
import { Shell } from "./Shell";

const itens: ItemMenu[] = [
  { href: rotas.app.lista, icone: "list", rotulo: "OS da equipe" },
  { href: rotas.app.sync, icone: "layers", rotulo: "Fila e sincronização", contador: "fila" },
  { href: rotas.app.perfil, icone: "user", rotulo: "Perfil e histórico" },
];

/** Casca da área do técnico em campo (OS, APR, execução e fila). */
export function TecnicoShell({ children }: { children: ReactNode }) {
  return (
    <Shell
      topbar={<BarraTecnico />}
      menu={
        <MenuLateral
          titulo="Menu do técnico"
          itens={itens}
          outraArea={{ href: rotas.web.quadro, icone: "grid", rotulo: "Painel de gestão" }}
          rodape="Dados fictícios · protótipo visual"
        />
      }
    >
      {children}
    </Shell>
  );
}
