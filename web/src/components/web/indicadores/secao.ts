import type { AbaDaSecao } from "@/components/web/AbasSecao";
import { rotas } from "@/lib/rotas";

/**
 * Os quatro dashboards da seção Indicadores e exportação. Todo perfil de gestão vê os quatro (o supervisor, só com a
 * própria equipe); dentro deles, a entrada de OS e a baixa no SAP e o cadastro, são do admin.
 */
export const abasDeIndicadores: AbaDaSecao[] = [
  { href: rotas.web.indicadores, rotulo: "Geral", icone: "bars" },
  { href: rotas.web.indicadoresEquipes, rotulo: "Equipes e usuários", icone: "users" },
  { href: rotas.web.indicadoresOs, rotulo: "OS", icone: "grid" },
  { href: rotas.web.indicadoresApr, rotulo: "APR", icone: "clip" },
];
