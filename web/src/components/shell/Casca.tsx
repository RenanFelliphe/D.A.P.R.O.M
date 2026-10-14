import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AcessoRecusado } from "@/components/aguardando/AcessoRecusado";
import { FaixaDoTreino } from "@/components/treino/FaixaDoTreino";
import { TreinoRaiz } from "@/components/treino/TreinoRaiz";
import type { Alerta } from "@/components/web/alertas/tipos";
import { AvisoConquista } from "@/components/web/gamificacao/AvisoConquista";
import { api, usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import { CABECALHO_ENDERECO } from "@/lib/sessao-comum";
import { ehAdmin, ehSupervisor, estaPendente, foiRecusado, iniciaisDe, nomesDasEquipesDoSupervisor, rotuloDoPerfil } from "@/lib/tipos";
import { COOKIE_TREINO_ADIADO } from "@/lib/treino-comum";
import { emTreino } from "@/lib/treino-modo";
import { Barra } from "./Barras";
import { itemDoTreino, itensDeCampo, itensDeNavegacao } from "./itensDoMenu";
import { MenuLateral, type ItemMenu, type SecaoMenu } from "./MenuLateral";
import { Shell } from "./Shell";

/** Menu de quem ainda espera a liberação, fora do treino: só o que a `api` real permite a ele. */
const itensDoPendente: ItemMenu[] = [
  { href: rotas.app.treino, icone: "layers", rotulo: "Campo de treino", chave: "menu-treino" },
  { href: rotas.app.aguardando, icone: "clock", rotulo: "Aguardando liberação" },
];

/** Telas que o técnico pendente alcança fora do treino. Qualquer outra volta para "Aguardando liberação" (que está na lista: sem laço). */
const livresParaPendente = [rotas.app.aguardando, rotas.app.treino, rotas.app.trocarSenha, rotas.app.entrar];
const ehLivre = (endereco: string) => livresParaPendente.some((r) => endereco === r || endereco.startsWith(`${r}/`));

/** Telas de quem executa em campo (treino, espera, APR e execução): o admin é só gestão e não tem o que fazer nelas. */
const SO_DO_CAMPO = /^\/app\/(treino|aguardando)(\/|$)|^\/app\/os\/[^/]+\/(apr|execucao)(\/|$)/;

/** Telas só de gestão (`/web`, `/doc`: APR, auditoria, alertas, importação, PDF): o técnico que não supervisiona nenhuma equipe segue para a lista de OS. */
export async function exigirGestao() {
  const { usuario } = await usuarioAtual();
  if (!ehAdmin(usuario) && !ehSupervisor(usuario)) redirect(rotas.app.lista);
}

/**
 * Casca única das áreas logadas (barra superior, menu lateral e conteúdo) para admin, supervisor e técnico. O que muda por
 * perfil é a estrutura: o admin vê o menu de gestão (OS, APR, equipes e usuários, auditoria, Dashboard); supervisor e técnico veem
 * OS, Minha equipe e Dashboard (o supervisor com cadastro de técnicos, o técnico só consultando) e o Campo de treino num grupo à
 * parte, no fim. As telas compartilhadas têm um endereço só.
 */
export async function Casca({ children }: { children: ReactNode }) {
  const { usuario, equipe } = await usuarioAtual();
  const admin = ehAdmin(usuario);
  const supervisor = ehSupervisor(usuario);
  // Cadastro recusado com a sessão ainda aberta: só o motivo e o botão de sair.
  if (foiRecusado(usuario)) return <AcessoRecusado motivo={usuario.recusa_motivo ?? null} />;
  const endereco = (await headers()).get(CABECALHO_ENDERECO) ?? "";
  if (admin && SO_DO_CAMPO.test(endereco)) redirect(rotas.app.lista);

  // Campo de treino: o cookie `treino` só vale para técnico e na área `/app` (as telas de gestão seguem na `api` real; ver `lib/api.ts`).
  const treino = !admin && (!endereco || endereco.startsWith("/app")) && (await emTreino());
  // Técnico pendente: fora do treino a `api` real só aceita o `/me`, a troca de senha e o treino; o resto volta à tela de espera.
  // O `proxy.ts` informa o endereço; sem ele (não deve ocorrer) não redireciona, e o `403 aguardando_liberacao` cobre o resto.
  const pendente = estaPendente(usuario);
  const restrito = pendente && !treino;
  if (restrito && endereco && !ehLivre(endereco)) redirect(rotas.app.aguardando);

  // Sistema real e acesso liberado: o menu completo do papel. No campo de treino e para quem espera a liberação, o enxuto.
  const liberado = !restrito && !treino;

  // Alertas não lidos das equipes do supervisor ou de todas (admin); o selo do menu do admin conta os cadastros de supervisores que esperam.
  const comAlertas = (admin || supervisor) && liberado;
  const [alertas, recentes, pendentes] = comAlertas
    ? await Promise.all([
        api<{ total: number }>("/alertas", { consulta: { lido: false, tamanho: 1 } }),
        api<{ alertas: Alerta[] }>("/alertas", { consulta: { tamanho: 5 } }),
        // Falha aqui não derruba o painel.
        admin ? api<{ total: number }>("/usuarios", { consulta: { liberacao: "pendente", tamanho: 1 } }).catch(() => ({ total: 0 })) : null,
      ])
    : [null, null, null];

  // Menu: o campo de treino mostra o menu do técnico (o tutorial aponta para ele) e o atalho para a tela de espera. Fora dele,
  // todos veem Ordem de Serviço, equipe e Dashboard (cada um com o seu escopo); o admin tem ainda APR e Auditoria.
  const itensDoCampo = restrito ? itensDoPendente : pendente ? [...itensDeCampo, itensDoPendente[1]!] : itensDeCampo;
  const itens = liberado ? [...itensDeNavegacao(usuario, pendentes?.total), ...(admin ? [] : [itemDoTreino])] : itensDoCampo;
  // O Campo de treino fica sempre num grupo separado, no fim (o perfil está no menu do usuário, na barra superior).
  const secoes: SecaoMenu[] | undefined = admin
    ? undefined
    : [{ itens: itens.filter((i) => i.href !== rotas.app.treino) }, { itens: itens.filter((i) => i.href === rotas.app.treino) }].filter((g) => g.itens.length > 0);

  // Gamificação: o selo da patente e os pontos da temporada na barra, e o aviso de conquista ou patente nova. Só para quem joga no
  // sistema real (o admin não joga; no campo de treino e na espera de liberação a `api` fictícia não tem pontos).
  const gamificacao = !admin && liberado ? (usuario.gamificacao ?? null) : null;

  // Primeiro acesso: abre as boas-vindas, a menos que a pessoa tenha escolhido "Fazer depois" nesta sessão (cookie de sessão).
  const adiado = (await cookies()).get(COOKIE_TREINO_ADIADO)?.value === "1";
  const primeiroAcesso = !admin && !treino && !adiado && usuario.treinamento?.estado === "nao_iniciado";
  // O supervisor é técnico: o cargo mostra de quais equipes.
  const cargo = admin
    ? rotuloDoPerfil.admin
    : supervisor
      ? `${rotuloDoPerfil.tecnico} · Supervisor de ${nomesDasEquipesDoSupervisor(usuario)}`
      : [usuario.cargo ?? "Técnico", `mat. ${usuario.matricula}`, equipe?.nome].filter(Boolean).join(" · ");
  const subtitulo = treino ? "Campo de treino" : admin ? "Painel de gestão" : supervisor ? "Supervisão e campo" : "Técnico em campo";
  const rodape = admin || !equipe ? `${rotuloDoPerfil[usuario.perfil]} · mat. ${usuario.matricula}` : `Equipe ${equipe.nome}`;

  return (
    <Shell
      faixa={treino ? <FaixaDoTreino /> : undefined}
      topbar={
        <Barra
          usuario={{ iniciais: iniciaisDe(usuario.nome), nome: usuario.nome, cargo }}
          subtitulo={subtitulo}
          alertas={comAlertas && alertas && recentes ? { naoLidos: alertas.total, recentes: recentes.alertas } : undefined}
          treino={treino}
          semBusca={restrito}
          gamificacao={gamificacao ?? undefined}
        />
      }
      menu={<MenuLateral titulo="Menu principal" itens={itens} secoes={secoes} rodape={rodape} />}
    >
      {children}
      {gamificacao && gamificacao.avisos_pendentes > 0 && <AvisoConquista />}
      {!admin && <TreinoRaiz emTreino={treino} primeiroAcesso={primeiroAcesso} pendente={pendente} />}
    </Shell>
  );
}
