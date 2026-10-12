import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CabecalhoDoPainel } from "@/components/web/indicadores/CabecalhoDoPainel";
import { prepararDashboard } from "@/components/web/indicadores/carregar";
import { DashboardMeus } from "@/components/web/indicadores/DashboardMeus";
import type { DashboardMeus as Dados } from "@/data/dashboards";
import { api } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import { ehAdmin } from "@/lib/tipos";

export const metadata: Metadata = { title: "Meus resultados" };

/** Meus resultados: o dashboard da própria pessoa (técnico e supervisor). O admin não executa OS e volta ao geral. */
export default async function MeusResultadosPage({ searchParams }: PageProps<"/app/dashboard/meus">) {
  const painel = await prepararDashboard(searchParams);
  if (ehAdmin(painel.usuario)) redirect(rotas.app.dashboard);
  const dados = await api<Dados>("/indicadores/meus", { consulta: { periodo: painel.filtro.periodo } });
  return (
    <>
      <CabecalhoDoPainel
        acao={rotas.app.dashboardMeus}
        filtro={painel.filtro}
        de={dados.de}
        ate={dados.ate}
        equipes={null}
        nomeDaEquipe={painel.usuario.nome}
      />
      <DashboardMeus dados={dados} rotuloAnterior={painel.rotuloAnterior} />
    </>
  );
}
