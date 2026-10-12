import type { Metadata } from "next";
import { CabecalhoDoPainel } from "@/components/web/indicadores/CabecalhoDoPainel";
import { prepararDashboard } from "@/components/web/indicadores/carregar";
import { DashboardEquipes } from "@/components/web/indicadores/DashboardEquipes";
import type { DashboardEquipes as Dados } from "@/data/dashboards";
import { api } from "@/lib/api";
import { rotas } from "@/lib/rotas";

export const metadata: Metadata = { title: "Dashboard de equipes e usuários" };

/** Dashboard de equipes e usuários: por equipe e por técnico; o estado do cadastro só para o admin. */
export default async function EquipesPage({ searchParams }: PageProps<"/web/indicadores/equipes">) {
  const painel = await prepararDashboard(searchParams);
  const dados = await api<Dados>("/indicadores/equipes", { consulta: painel.consulta });
  return (
    <>
      <CabecalhoDoPainel acao={rotas.web.indicadoresEquipes} filtro={painel.filtro} de={dados.de} ate={dados.ate} equipes={painel.equipes} nomeDaEquipe={painel.nomeDaEquipe} />
      <DashboardEquipes dados={dados} />
    </>
  );
}
