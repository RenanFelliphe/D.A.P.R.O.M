import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import type { AbaDaSecao } from "@/components/web/AbasSecao";
import type { Alerta } from "@/components/web/alertas/tipos";
import { abasApr } from "@/components/web/apr/secao";
import { abasDeIndicadores } from "@/components/web/indicadores/secao";
import { abasDoPerfil } from "@/components/web/os/secao";
import { api, usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import { ehAdmin, ehSupervisor, iniciaisDe, nomesDasEquipesDoSupervisor, rotuloDoPerfil } from "@/lib/tipos";
import { BarraGestao } from "./Barras";
import { MenuLateral, type ItemMenu } from "./MenuLateral";
import { Shell } from "./Shell";

/**
 * O que cada papel de gestão vê no menu (tabela de perfis da especificação). "Ordem de Serviço" reúne Quadro
 * e Importação em abas, "APR" reúne Modelos e Atividades, e "Indicadores e exportação" reúne os dashboards
 * geral, de equipes e usuários, de OS e de APR; o menu também lista as abas como dropdown. Quais abas aparecem fica com cada seção
 * (`secao.ts` em `components/web/os`, `apr` e `indicadores`).
 */
const itensDoSupervisor: string[] = [rotas.web.quadro, rotas.web.indicadores, rotas.web.minhaEquipe];
const itensDoAdmin: string[] = [rotas.web.quadro, rotas.web.modelos, rotas.web.indicadores, rotas.web.usuarios];

const todos: ItemMenu[] = [
  { href: rotas.web.quadro, icone: "grid", rotulo: "Ordem de Serviço", prefixos: ["/web/os", "/doc"] },
  { href: rotas.web.modelos, icone: "clip", rotulo: "APR", prefixos: ["/web/apr"] },
  { href: rotas.web.indicadores, icone: "bars", rotulo: "Indicadores e exportação", prefixos: ["/web/indicadores"] },
  { href: rotas.web.usuarios, icone: "users", rotulo: "Equipes e usuários" },
  // Supervisor: as telas de usuários em modo restrito (técnicos das equipes dele e cadastro de novos técnicos).
  { href: rotas.web.minhaEquipe, icone: "users", rotulo: "Minha equipe" },
];

/** Casca do painel de gestão: o admin e o supervisor (técnico que supervisiona equipes). O técnico comum segue para a área de campo. */
export async function GestaoShell({ children }: { children: ReactNode }) {
  const { usuario } = await usuarioAtual();
  const admin = ehAdmin(usuario);
  // Técnico sem equipe para supervisionar segue para a área de campo.
  if (!admin && !ehSupervisor(usuario)) redirect(rotas.app.lista);

  // Alertas não lidos das equipes do supervisor ou de todas (admin).
  const [alertas, recentes, pendentes] = await Promise.all([
    api<{ total: number }>("/alertas", { consulta: { lido: false, tamanho: 1 } }),
    api<{ alertas: Alerta[] }>("/alertas", { consulta: { tamanho: 5 } }),
    // Só o admin libera: o selo do menu conta os cadastros de supervisores que esperam. Falha aqui não derruba o painel.
    admin ? api<{ total: number }>("/usuarios", { consulta: { liberacao: "pendente", tamanho: 1 } }).catch(() => ({ total: 0 })) : null,
  ]);
  const permitidos = admin ? itensDoAdmin : itensDoSupervisor;
  // As abas de cada seção viram o dropdown do item; quem só tem o Quadro fica com o link simples.
  const abasDoItem: Record<string, AbaDaSecao[]> = {
    [rotas.web.quadro]: abasDoPerfil(usuario),
    [rotas.web.modelos]: abasApr,
    [rotas.web.indicadores]: abasDeIndicadores,
  };
  const itens: ItemMenu[] = todos
    .filter((i) => permitidos.includes(i.href))
    .map((i) => ((abasDoItem[i.href]?.length ?? 0) > 1 ? { ...i, subitens: abasDoItem[i.href] } : i))
    .map((i) => (i.href === rotas.web.usuarios && pendentes ? { ...i, contador: pendentes.total, rotuloDoContador: `${pendentes.total} pendentes de liberação` } : i));
  // O supervisor também é técnico e executa OS: o atalho "Outra área" leva ao campo. O admin é só gestão.
  // O supervisor é técnico: o cargo mostra de quais equipes.
  const cargo = admin ? rotuloDoPerfil.admin : `${rotuloDoPerfil.tecnico} · Supervisor de ${nomesDasEquipesDoSupervisor(usuario)}`;

  return (
    <Shell
      topbar={<BarraGestao usuario={{ iniciais: iniciaisDe(usuario.nome), nome: usuario.nome, cargo }} naoLidos={alertas.total} recentes={recentes.alertas} />}
      menu={<MenuLateral titulo="Menu do painel" itens={itens} outraArea={admin ? undefined : { href: rotas.app.lista, icone: "list", rotulo: "Minhas OS (campo)" }} rodape={`${rotuloDoPerfil[usuario.perfil]} · mat. ${usuario.matricula}`} />}
    >
      {children}
    </Shell>
  );
}
