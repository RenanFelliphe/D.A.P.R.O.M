import type { AbaDaSecao } from "@/components/web/AbasSecao";
import { rotas } from "@/lib/rotas";
import { ehAdmin, ehSupervisor, type Usuario } from "@/lib/tipos";

type QuemEstaVendo = Pick<Usuario, "perfil" | "equipes_supervisionadas">;

/**
 * As abas da seção Dashboard, as mesmas telas para todos os perfis. Cada uma mostra o escopo de quem olha: o admin vê todas
 * as equipes; supervisor e técnico, a própria (o técnico sem nada por pessoa). A entrada de OS, a baixa no SAP e o cadastro
 * são do admin. "Meus resultados", o dashboard da própria pessoa, é de quem executa OS (técnico e supervisor); o admin não tem.
 */
export function abasDoDashboard(u: QuemEstaVendo): AbaDaSecao[] {
  const acompanha = ehAdmin(u) || ehSupervisor(u);
  return [
    { href: rotas.app.dashboard, rotulo: "Geral", icone: "bars" },
    { href: rotas.app.dashboardEquipes, rotulo: acompanha ? "Equipes e usuários" : "Minha equipe", icone: "users" },
    { href: rotas.app.dashboardOs, rotulo: "OS", icone: "grid" },
    { href: rotas.app.dashboardApr, rotulo: "APR", icone: "clip" },
    ...(ehAdmin(u) ? [] : [{ href: rotas.app.dashboardMeus, rotulo: "Meus resultados", icone: "user" } satisfies AbaDaSecao]),
  ];
}
