import type { AbaDaSecao } from "@/components/web/AbasSecao";
import { abasApr } from "@/components/web/apr/secao";
import { abasDoDashboard } from "@/components/web/indicadores/secao";
import { abasDoPerfil } from "@/components/web/os/secao";
import { rotas } from "@/lib/rotas";
import { ehAdmin, ehSupervisor, type Usuario } from "@/lib/tipos";
import type { ItemMenu } from "./MenuLateral";

/**
 * Itens do menu de quem usa o sistema já liberado (fora do campo de treino). "Ordem de Serviço" reúne Quadro e Importação em
 * abas, "APR" reúne Modelos e Atividades, e "Dashboard" reúne os dashboards; o menu também lista as abas como dropdown.
 * Quais abas aparecem fica com cada seção (`secao.ts` em `components/web/os`, `apr` e `indicadores`).
 * - Admin: Ordem de Serviço, APR, Equipes e usuários, Auditoria e Dashboard.
 * - Supervisor e técnico: Ordem de Serviço (o técnico, "OS da equipe"), Minha equipe e Dashboard; o supervisor com cadastro de
 *   técnicos e o técnico só para consulta.
 * O Dashboard é sempre o último; o Campo de treino vem depois, num grupo à parte (ver `Casca`).
 */
export function itensDeNavegacao(usuario: Usuario, pendentes?: number): ItemMenu[] {
  const admin = ehAdmin(usuario);
  // As abas de cada seção viram o dropdown do item; quem só tem uma fica com o link simples.
  const comAbas = (item: ItemMenu, abas: AbaDaSecao[]): ItemMenu => (abas.length > 1 ? { ...item, subitens: abas } : item);
  const quadro = comAbas(
    { href: rotas.app.lista, icone: "grid", rotulo: admin || ehSupervisor(usuario) ? "Ordem de Serviço" : "OS da equipe", prefixos: ["/app/os", "/web/os", "/doc"], chave: "menu-lista" },
    abasDoPerfil(usuario),
  );
  const dashboard = comAbas({ href: rotas.app.dashboard, icone: "bars", rotulo: "Dashboard", prefixos: ["/app/dashboard"] }, abasDoDashboard(usuario));
  if (!admin) return [quadro, { href: rotas.app.usuarios, icone: "users", rotulo: "Minha equipe" }, dashboard];
  return [
    quadro,
    comAbas({ href: rotas.web.modelos, icone: "clip", rotulo: "APR", prefixos: ["/web/apr"] }, abasApr),
    {
      href: rotas.app.usuarios,
      icone: "users",
      rotulo: "Equipes e usuários",
      ...(pendentes === undefined ? {} : { contador: pendentes, rotuloDoContador: `${pendentes} pendentes de liberação` }),
    },
    // Só o admin: quem fez o quê nas telas de gestão.
    { href: rotas.web.auditoria, icone: "shield", rotulo: "Auditoria" },
    // O Dashboard é sempre o último item antes do campo.
    dashboard,
  ];
}

/** O Campo de treino: sempre disponível, também para quem já concluiu ou pulou o treinamento (refaz a qualquer hora). */
export const itemDoTreino: ItemMenu = { href: rotas.app.treino, icone: "layers", rotulo: "Campo de treino", chave: "menu-treino" };

/** Menu enxuto do campo de treino e de quem ainda espera a liberação: só o que a `api` (real ou fictícia) atende a ele. */
export const itensDeCampo: ItemMenu[] = [
  { href: rotas.app.lista, icone: "list", rotulo: "OS da equipe", prefixos: ["/app/os"], chave: "menu-lista" },
  itemDoTreino,
];
