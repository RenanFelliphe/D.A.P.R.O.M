import type { AbaDaSecao } from "@/components/web/AbasSecao";
import { rotas } from "@/lib/rotas";
import { ehAdmin, type Usuario } from "@/lib/tipos";

/**
 * Quem cria, edita, publica e exclui modelos e mantém a tabela de atividades: o administrador (a `api` recusa os demais
 * com `403`). O supervisor lê.
 */
export const editaModelos = (u: Pick<Usuario, "perfil">) => ehAdmin(u);

/** Onde o modelo é usado (APRs de todas as equipes): de quem enxerga todas as OS. */
export const veTodasAsEquipes = (u: Pick<Usuario, "perfil">) => ehAdmin(u);

/** As abas da seção APR, também listadas como dropdown no menu. */
export const abasApr: AbaDaSecao[] = [
  { href: rotas.web.modelos, rotulo: "Modelos", icone: "layers" },
  { href: rotas.web.atividades, rotulo: "Atividades", icone: "list" },
];
