import type { AbaDaSecao } from "@/components/web/AbasSecao";
import { rotas } from "@/lib/rotas";
import { ehAdmin, type Usuario } from "@/lib/tipos";

/**
 * Quem cadastra as tarefas (pontos), as patentes e as conquistas: o administrador (a `api` recusa os demais com `403`). Todos
 * os perfis leem as mesmas páginas.
 */
export const editaGamificacao = (u: Pick<Usuario, "perfil">) => ehAdmin(u);

/** O admin não joga: não tem pontuação própria nem aparece no ranking. */
export const jogaNaGamificacao = (u: Pick<Usuario, "perfil">) => !ehAdmin(u);

/**
 * As abas da seção Gamificação, também listadas como dropdown no menu. "Minha pontuação" é de quem joga (técnico, supervisor
 * incluso); o admin começa pelo Ranking.
 */
export function abasDaGamificacao(u: Pick<Usuario, "perfil">): AbaDaSecao[] {
  const abas: AbaDaSecao[] = [
    { href: rotas.app.gamificacaoRanking, rotulo: "Ranking", icone: "bars" },
    { href: rotas.app.gamificacaoConquistas, rotulo: "Conquistas", icone: "trophy" },
    { href: rotas.app.gamificacaoPatentes, rotulo: "Patentes", icone: "star" },
    { href: rotas.app.gamificacaoPontos, rotulo: "Como pontuar", icone: "list" },
  ];
  return jogaNaGamificacao(u) ? [{ href: rotas.app.gamificacaoMinha, rotulo: "Minha pontuação", icone: "user" }, ...abas] : abas;
}
