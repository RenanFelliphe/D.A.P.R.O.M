import type { ReactNode } from "react";
import { AtualizacaoAutomatica } from "@/components/ui/AtualizacaoAutomatica";
import { Screen } from "@/components/ui/Screen";
import { AbasSecao } from "@/components/web/AbasSecao";
import { CHAVES_DO_FILTRO } from "@/components/web/indicadores/filtro";
import { usuarioAtual } from "@/lib/api";
import { abasDoDashboard } from "@/components/web/indicadores/secao";

/**
 * Seção Dashboard, a mesma tela para todos os perfis: o título e as abas dos dashboards (geral, equipes, OS e APR; mais "Meus
 * resultados" para quem executa OS). O filtro (período e equipe) acompanha a troca de aba. Os números atualizam sozinhos.
 */
export default async function SecaoIndicadoresLayout({ children }: { children: ReactNode }) {
  const { usuario } = await usuarioAtual();
  return (
    <Screen>
      <h1>Dashboard</h1>
      <AbasSecao rotulo="Seções do Dashboard" abas={abasDoDashboard(usuario)} manterConsulta={[...CHAVES_DO_FILTRO]} />
      {children}
      <AtualizacaoAutomatica />
    </Screen>
  );
}
