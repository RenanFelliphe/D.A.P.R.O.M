import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import { iniciaisDe } from "@/lib/tipos";
import { BarraTecnico } from "./Barras";
import { MenuLateral, type ItemMenu } from "./MenuLateral";
import { Shell } from "./Shell";

const itens: ItemMenu[] = [
  { href: rotas.app.lista, icone: "list", rotulo: "OS da equipe", prefixos: ["/app/os"] },
  { href: rotas.app.perfil, icone: "user", rotulo: "Perfil e histórico" },
];

/**
 * Casca da área do técnico em campo (OS, APR e execução). Só o perfil `tecnico` aplica APR e executa OS; os demais
 * perfis seguem para o painel de gestão.
 */
export async function TecnicoShell({ children }: { children: ReactNode }) {
  const { usuario, equipe } = await usuarioAtual();
  if (usuario.perfil !== "tecnico") redirect(rotas.web.quadro);
  const cargo = [usuario.cargo ?? "Técnico", `mat. ${usuario.matricula}`, equipe?.nome].filter(Boolean).join(" · ");

  return (
    <Shell
      topbar={<BarraTecnico usuario={{ iniciais: iniciaisDe(usuario.nome), nome: usuario.nome, cargo }} />}
      menu={<MenuLateral titulo="Menu do técnico" itens={itens} rodape={equipe ? `Equipe ${equipe.nome}` : "Sem equipe"} />}
    >
      {children}
    </Shell>
  );
}
