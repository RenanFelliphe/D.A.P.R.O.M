import type { AbaDaSecao } from "@/components/web/AbasSecao";
import { abasApr } from "@/components/web/apr/secao";
import { abasDoCatalogo } from "@/components/web/catalogo/secao";
import { abasDaGamificacao } from "@/components/web/gamificacao/secao";
import { abasDoDashboard } from "@/components/web/indicadores/secao";
import { abasDoPerfil } from "@/components/web/os/secao";
import { rotas } from "@/lib/rotas";
import { ehAdmin, ehSupervisor, type Usuario } from "@/lib/tipos";
import type { ItemMenu } from "./MenuLateral";

/**
 * Itens do menu de quem usa o sistema já liberado (fora do campo de treino). "Ordem de Serviço" reúne Quadro e Importação (só o
 * admin), "APR" reúne Modelos e Atividades, "Catálogo" reúne Serviços e Materiais,
 * "Gamificação" reúne Minha pontuação, Ranking,
 * Conquistas, Patentes e Como pontuar, e "Dashboard" reúne os dashboards; o menu também lista as abas como dropdown. Quais abas
 * aparecem fica com cada seção (`secao.ts` em `components/web/os`, `apr`, `catalogo`, `gamificacao` e `indicadores`).
 * - Admin: Ordem de Serviço, APR, Catálogo, Equipes e usuários, Auditoria, Vitória, Gamificação (sem Minha pontuação:
 *   o admin não joga) e Dashboard.
 * - Supervisor e técnico: Ordem de Serviço (o técnico, "OS da equipe"), Minha equipe, Catálogo (só para consulta), Gamificação e
 *   Dashboard; o supervisor com cadastro de técnicos e o técnico só para consulta, e mais "Validações" (tudo o que espera a decisão
 *   ou a assinatura do supervisor).
 * O Dashboard é sempre o último; o Campo de treino vem depois, num grupo à parte (ver `Casca`).
 */
export function itensDeNavegacao(usuario: Usuario, pendentes?: number, perguntasSemResposta?: number, paraValidar?: number): ItemMenu[] {
  const admin = ehAdmin(usuario);
  // As abas de cada seção viram o dropdown do item; quem só tem uma fica com o link simples.
  const comAbas = (item: ItemMenu, abas: AbaDaSecao[]): ItemMenu => (abas.length > 1 ? { ...item, subitens: abas } : item);
  const quadro = comAbas(
    { href: rotas.app.lista, icone: "grid", rotulo: admin || ehSupervisor(usuario) ? "Ordem de Serviço" : "OS da equipe", prefixos: ["/app/os", "/web/os", "/doc"], chave: "menu-lista" },
    abasDoPerfil(usuario),
  );
  const dashboard = comAbas({ href: rotas.app.dashboard, icone: "bars", rotulo: "Dashboard", prefixos: ["/app/dashboard"], chave: "menu-dashboard" }, abasDoDashboard(usuario));
  const catalogo = comAbas({ href: rotas.app.catalogo, icone: "box", rotulo: "Catálogo", prefixos: ["/app/catalogo"], chave: "menu-catalogo" }, abasDoCatalogo);
  // A gamificação é para todos; quem joga abre em "Minha pontuação" e o admin, no Ranking (a primeira aba de cada um).
  const abasDaGamificacaoDeQuem = abasDaGamificacao(usuario);
  const gamificacao = comAbas({ href: abasDaGamificacaoDeQuem[0]!.href, icone: "trophy", rotulo: "Gamificação", prefixos: ["/app/gamificacao"], chave: "menu-gamificacao" }, abasDaGamificacaoDeQuem);
  // O supervisor tem a página Validações: tudo o que espera a decisão ou a assinatura dele; o selo conta os itens da fila.
  const validar: ItemMenu[] = ehSupervisor(usuario)
    ? [
        {
          href: rotas.app.validacoes,
          icone: "check",
          rotulo: "Validações",
          chave: "menu-validar",
          ...(paraValidar ? { contador: paraValidar, rotuloDoContador: `${paraValidar} ${paraValidar === 1 ? "validação esperando" : "validações esperando"} você` } : {}),
        },
      ]
    : [];
  if (!admin) return [quadro, { href: rotas.app.usuarios, icone: "users", rotulo: "Minha equipe", chave: "menu-usuarios" }, catalogo, ...validar, gamificacao, dashboard];
  return [
    quadro,
    comAbas({ href: rotas.web.modelos, icone: "clip", rotulo: "APR", prefixos: ["/web/apr"], chave: "menu-apr" }, abasApr),
    catalogo,
    {
      href: rotas.app.usuarios,
      icone: "users",
      rotulo: "Equipes e usuários",
      chave: "menu-usuarios",
      ...(pendentes === undefined ? {} : { contador: pendentes, rotuloDoContador: `${pendentes} pendentes de liberação` }),
    },
    // Só o admin: quem fez o quê nas telas de gestão.
    { href: rotas.web.auditoria, icone: "shield", rotulo: "Auditoria", chave: "menu-auditoria" },
    // Só o admin: o que a Vitória não soube responder, para melhorar o manual; o selo conta as que ainda não foram tratadas.
    {
      href: rotas.app.vitoriaSemResposta,
      icone: "chat",
      rotulo: "Vitória",
      chave: "menu-vitoria",
      ...(perguntasSemResposta ? { contador: perguntasSemResposta, rotuloDoContador: `${perguntasSemResposta} perguntas sem resposta da Vitória` } : {}),
    },
    gamificacao,
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
