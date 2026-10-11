import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { api, usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import { iniciaisDe, rotuloDoPerfil, type Perfil } from "@/lib/tipos";
import { BarraGestao } from "./Barras";
import { MenuLateral, type ItemMenu } from "./MenuLateral";
import { Shell } from "./Shell";

/** O que cada perfil de gestão vê no menu (tabela de perfis da especificação). */
const itensPorPerfil: Record<Exclude<Perfil, "tecnico">, string[]> = {
  supervisor: [rotas.web.quadro, rotas.web.alertas, rotas.web.indicadores],
  analista: [rotas.web.quadro, rotas.web.alertas, rotas.web.importacao, rotas.web.indicadores],
  seguranca: [rotas.web.quadro, rotas.web.alertas, rotas.web.indicadores, rotas.web.modelos],
  admin: [rotas.web.quadro, rotas.web.alertas, rotas.web.importacao, rotas.web.indicadores, rotas.web.usuarios],
};

const todos: ItemMenu[] = [
  { href: rotas.web.quadro, icone: "grid", rotulo: "Quadro de OS", prefixos: ["/web/os", "/doc"] },
  { href: rotas.web.alertas, icone: "bell", rotulo: "Alertas" },
  { href: rotas.web.importacao, icone: "upload", rotulo: "Importação SAP" },
  { href: rotas.web.indicadores, icone: "bars", rotulo: "Indicadores e exportação" },
  { href: rotas.web.modelos, icone: "clip", rotulo: "Modelos de APR" },
  { href: rotas.web.usuarios, icone: "users", rotulo: "Equipes e usuários" },
];

/** Casca do painel de gestão (supervisor, analista, Segurança do Trabalho e admin). O técnico segue para a área de campo. */
export async function GestaoShell({ children }: { children: ReactNode }) {
  const { usuario, equipe } = await usuarioAtual();
  if (usuario.perfil === "tecnico") redirect(rotas.app.lista);

  // Alertas não lidos do próprio usuário (supervisor e analista) ou de todos (admin e Segurança, em leitura).
  const alertas = await api<{ total: number }>("/alertas", { consulta: { lido: false, tamanho: 1 } });
  const permitidos = itensPorPerfil[usuario.perfil];
  const itens = todos.filter((i) => permitidos.includes(i.href)).map((i) => (i.href === rotas.web.alertas ? { ...i, contador: alertas.total } : i));
  const cargo = [rotuloDoPerfil[usuario.perfil], usuario.perfil === "supervisor" ? equipe?.nome : undefined].filter(Boolean).join(" · ");

  return (
    <Shell
      topbar={<BarraGestao usuario={{ iniciais: iniciaisDe(usuario.nome), nome: usuario.nome, cargo }} naoLidos={alertas.total} />}
      menu={<MenuLateral titulo="Menu do painel" itens={itens} rodape={`${rotuloDoPerfil[usuario.perfil]} · mat. ${usuario.matricula}`} />}
    >
      {children}
    </Shell>
  );
}
