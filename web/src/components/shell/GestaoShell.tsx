import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import type { AbaDaSecao } from "@/components/web/AbasSecao";
import type { Alerta } from "@/components/web/alertas/tipos";
import { abasApr } from "@/components/web/apr/secao";
import { abasDeIndicadores } from "@/components/web/indicadores/secao";
import { abasDoPerfil } from "@/components/web/os/secao";
import { api, usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import { iniciaisDe, rotuloDoPerfil, type Perfil } from "@/lib/tipos";
import { BarraGestao } from "./Barras";
import { MenuLateral, type ItemMenu } from "./MenuLateral";
import { Shell } from "./Shell";

/**
 * O que cada perfil de gestão vê no menu (tabela de perfis da especificação). "Ordem de Serviço" reúne Quadro
 * e Importação em abas, "APR" reúne Modelos e Atividades, e "Indicadores e exportação" reúne os dashboards
 * geral, de equipes e usuários, de OS e de APR; o menu também lista as abas como dropdown. Quais abas aparecem fica com cada seção
 * (`secao.ts` em `components/web/os`, `apr` e `indicadores`).
 */
const itensPorPerfil: Record<Exclude<Perfil, "tecnico">, string[]> = {
  supervisor: [rotas.web.quadro, rotas.web.indicadores],
  analista: [rotas.web.quadro, rotas.web.indicadores],
  seguranca: [rotas.web.quadro, rotas.web.modelos, rotas.web.indicadores],
  admin: [rotas.web.quadro, rotas.web.modelos, rotas.web.indicadores, rotas.web.usuarios],
};

const todos: ItemMenu[] = [
  { href: rotas.web.quadro, icone: "grid", rotulo: "Ordem de Serviço", prefixos: ["/web/os", "/doc"] },
  { href: rotas.web.modelos, icone: "clip", rotulo: "APR", prefixos: ["/web/apr"] },
  { href: rotas.web.indicadores, icone: "bars", rotulo: "Indicadores e exportação", prefixos: ["/web/indicadores"] },
  { href: rotas.web.usuarios, icone: "users", rotulo: "Equipes e usuários" },
];

/** Casca do painel de gestão (supervisor, analista, Segurança do Trabalho e admin). O técnico segue para a área de campo. */
export async function GestaoShell({ children }: { children: ReactNode }) {
  const { usuario, equipe } = await usuarioAtual();
  if (usuario.perfil === "tecnico") redirect(rotas.app.lista);

  // Alertas não lidos do próprio usuário (supervisor e analista) ou de todos (admin e Segurança, em leitura).
  const [alertas, recentes] = await Promise.all([
    api<{ total: number }>("/alertas", { consulta: { lido: false, tamanho: 1 } }),
    api<{ alertas: Alerta[] }>("/alertas", { consulta: { tamanho: 5 } }),
  ]);
  const permitidos = itensPorPerfil[usuario.perfil];
  // As abas de cada seção viram o dropdown do item; quem só tem o Quadro fica com o link simples.
  const abasDoItem: Record<string, AbaDaSecao[]> = {
    [rotas.web.quadro]: abasDoPerfil(usuario.perfil),
    [rotas.web.modelos]: abasApr,
    [rotas.web.indicadores]: abasDeIndicadores,
  };
  const itens = todos
    .filter((i) => permitidos.includes(i.href))
    .map((i) => ((abasDoItem[i.href]?.length ?? 0) > 1 ? { ...i, subitens: abasDoItem[i.href] } : i));
  const cargo = [rotuloDoPerfil[usuario.perfil], usuario.perfil === "supervisor" ? equipe?.nome : undefined].filter(Boolean).join(" · ");

  return (
    <Shell
      topbar={<BarraGestao usuario={{ iniciais: iniciaisDe(usuario.nome), nome: usuario.nome, cargo }} naoLidos={alertas.total} recentes={recentes.alertas} />}
      menu={<MenuLateral titulo="Menu do painel" itens={itens} rodape={`${rotuloDoPerfil[usuario.perfil]} · mat. ${usuario.matricula}`} />}
    >
      {children}
    </Shell>
  );
}
