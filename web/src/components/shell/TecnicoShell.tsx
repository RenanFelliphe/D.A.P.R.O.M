import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AcessoRecusado } from "@/components/aguardando/AcessoRecusado";
import { usuarioAtual } from "@/lib/api";
import { FaixaDoTreino } from "@/components/treino/FaixaDoTreino";
import { TreinoRaiz } from "@/components/treino/TreinoRaiz";
import { rotas } from "@/lib/rotas";
import { CABECALHO_ENDERECO } from "@/lib/sessao-comum";
import { ehAdmin, ehSupervisor, estaPendente, foiRecusado, iniciaisDe } from "@/lib/tipos";
import { COOKIE_TREINO_ADIADO } from "@/lib/treino-comum";
import { emTreino } from "@/lib/treino-modo";
import { BarraTecnico } from "./Barras";
import { MenuLateral, type ItemMenu } from "./MenuLateral";
import { Shell } from "./Shell";

const itens: ItemMenu[] = [
  { href: rotas.app.lista, icone: "list", rotulo: "OS da equipe", prefixos: ["/app/os"], chave: "menu-lista" },
  { href: rotas.app.perfil, icone: "user", rotulo: "Perfil e histórico", chave: "menu-perfil" },
  // Sempre disponível, também para quem já concluiu ou pulou o treinamento: refaz a qualquer hora.
  { href: rotas.app.treino, icone: "layers", rotulo: "Campo de treino", chave: "menu-treino" },
];

/** Menu de quem ainda espera a liberação, fora do treino: só o que a `api` real permite a ele. */
const itensDoPendente: ItemMenu[] = [
  { href: rotas.app.treino, icone: "layers", rotulo: "Campo de treino", chave: "menu-treino" },
  { href: rotas.app.aguardando, icone: "clock", rotulo: "Aguardando liberação" },
];

/** Telas que o técnico pendente alcança fora do treino. Qualquer outra volta para "Aguardando liberação" (que está na lista: sem laço). */
const livresParaPendente = [rotas.app.aguardando, rotas.app.treino, rotas.app.trocarSenha, rotas.app.entrar];
const ehLivre = (endereco: string) => livresParaPendente.some((r) => endereco === r || endereco.startsWith(`${r}/`));

/**
 * Casca da área do técnico em campo (OS, APR e execução). Todo técnico, inclusive o supervisor, aplica APR e executa OS;
 * o admin é só gestão e segue para o painel.
 */
export async function TecnicoShell({ children }: { children: ReactNode }) {
  const { usuario, equipe } = await usuarioAtual();
  if (ehAdmin(usuario)) redirect(rotas.web.quadro);
  // Cadastro recusado com a sessão ainda aberta: só o motivo e o botão de sair.
  if (foiRecusado(usuario)) return <AcessoRecusado motivo={usuario.recusa_motivo ?? null} />;
  // Quem supervisiona uma equipe segue executando OS aqui e ganha o atalho para o painel de supervisão.
  const painel = ehSupervisor(usuario) ? { href: rotas.web.quadro, icone: "grid" as const, rotulo: "Painel de supervisão" } : undefined;
  // Campo de treino: o cookie `treino` só vale para técnico (o admin já foi mandado ao painel acima).
  const treino = await emTreino();
  // Técnico pendente: fora do treino a `api` real só aceita o `/me`, a troca de senha e o treino; o resto volta à tela de espera.
  // O `proxy.ts` informa o endereço; sem ele (não deve ocorrer) não redireciona, e o `403 aguardando_liberacao` cobre o resto.
  const pendente = estaPendente(usuario);
  const restrito = pendente && !treino;
  const endereco = (await headers()).get(CABECALHO_ENDERECO) ?? "";
  if (restrito && endereco && !ehLivre(endereco)) redirect(rotas.app.aguardando);
  // No treino o pendente usa o menu completo (o tutorial aponta para ele) e ganha o atalho para a tela de espera.
  const itensDoMenu = restrito ? itensDoPendente : pendente ? [...itens, itensDoPendente[1]!] : itens;
  // Primeiro acesso: abre as boas-vindas, a menos que a pessoa tenha escolhido "Fazer depois" nesta sessão (cookie de sessão).
  const adiado = (await cookies()).get(COOKIE_TREINO_ADIADO)?.value === "1";
  const primeiroAcesso = !treino && !adiado && usuario.treinamento?.estado === "nao_iniciado";
  const cargo = [usuario.cargo ?? "Técnico", `mat. ${usuario.matricula}`, equipe?.nome].filter(Boolean).join(" · ");

  return (
    <Shell
      faixa={treino ? <FaixaDoTreino /> : undefined}
      topbar={<BarraTecnico usuario={{ iniciais: iniciaisDe(usuario.nome), nome: usuario.nome, cargo }} treino={treino} semBusca={restrito} />}
      menu={<MenuLateral titulo="Menu do técnico" itens={itensDoMenu} outraArea={restrito ? undefined : painel} rodape={equipe ? `Equipe ${equipe.nome}` : "Sem equipe"} />}
    >
      {children}
      <TreinoRaiz emTreino={treino} primeiroAcesso={primeiroAcesso} pendente={pendente} />
    </Shell>
  );
}
