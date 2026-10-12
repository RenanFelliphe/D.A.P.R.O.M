import type { Metadata } from "next";
import { CabecalhoDoPainel } from "@/components/web/indicadores/CabecalhoDoPainel";
import { prepararDashboard } from "@/components/web/indicadores/carregar";
import { DashboardApr } from "@/components/web/indicadores/DashboardApr";
import type { ResumoDasAprs } from "@/data/modelos";
import { api } from "@/lib/api";
import { rotas } from "@/lib/rotas";

export const metadata: Metadata = { title: "Dashboard de APR" };

/** Dashboard de APR: quanto bloqueia, por quê e onde, no período e na equipe do filtro. */
export default async function AprPage({ searchParams }: PageProps<"/app/dashboard/apr">) {
  const painel = await prepararDashboard(searchParams);
  const resumo = await api<ResumoDasAprs>("/aprs/resumo", { consulta: painel.consulta });
  return (
    <>
      <CabecalhoDoPainel acao={rotas.app.dashboardApr} filtro={painel.filtro} de={resumo.de} ate={resumo.ate} equipes={painel.equipes} nomeDaEquipe={painel.nomeDaEquipe} />
      <DashboardApr resumo={resumo} rotuloAnterior={painel.rotuloAnterior} />
    </>
  );
}
