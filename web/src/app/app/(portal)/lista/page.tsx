import type { Metadata } from "next";
import { FaixaDeAssinaturas } from "@/components/app/FaixaDeAssinaturas";
import { FaixaDeConferencias } from "@/components/app/FaixaDeConferencias";
import { AtualizacaoAutomatica } from "@/components/ui/AtualizacaoAutomatica";
import { Screen } from "@/components/ui/Screen";
import { CabecalhoSecaoOs } from "@/components/web/os/CabecalhoSecaoOs";
import { PaginaQuadro } from "@/components/web/quadro/PaginaQuadro";

export const metadata: Metadata = { title: "Quadro de OS" };

/**
 * Quadro de OS: um endereço só para admin, supervisor e técnico (a `api` entrega a cada um o que ele enxerga). O título e as
 * abas da seção (Quadro, Importação e Mapa de Calor, conforme o perfil) ficam com `CabecalhoSecaoOs`. Acima do quadro, a
 * faixa "APR aguardando a sua assinatura" aparece só para quem tem APR pendente. Atualiza sozinho.
 */
export default async function ListaPage({ searchParams }: PageProps<"/app/lista">) {
  return (
    <Screen>
      <CabecalhoSecaoOs />
      <FaixaDeAssinaturas />
      <FaixaDeConferencias />
      <PaginaQuadro searchParams={searchParams} />
      <AtualizacaoAutomatica />
    </Screen>
  );
}
