import type { AbaDaSecao } from "@/components/web/AbasSecao";
import { rotas } from "@/lib/rotas";
import type { Perfil } from "@/lib/tipos";

/**
 * Quem cria, edita, publica e exclui modelos e mantém a tabela de atividades: a Segurança do Trabalho, dona do conteúdo,
 * e o administrador do sistema (a `api` recusa os demais com `403`). Os outros perfis de gestão leem.
 */
export const editaModelos = (perfil: Perfil) => perfil === "seguranca" || perfil === "admin";

/** Onde o modelo é usado (OS abertas de todas as equipes): de quem enxerga todas as OS. */
export const veTodasAsEquipes = (perfil: Perfil) => perfil === "analista" || editaModelos(perfil);

/** As abas da seção APR, também listadas como dropdown no menu. */
export const abasApr: AbaDaSecao[] = [
  { href: rotas.web.modelos, rotulo: "Modelos", icone: "layers" },
  { href: rotas.web.atividades, rotulo: "Atividades", icone: "list" },
];
