import type { Metadata } from "next";
import { CabecalhoDoPainel } from "@/components/web/indicadores/CabecalhoDoPainel";
import { prepararDashboard } from "@/components/web/indicadores/carregar";
import { DashboardGeral } from "@/components/web/indicadores/DashboardGeral";
import type { DashboardGeral as Dados } from "@/data/dashboards";
import { api } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import { ehAdmin } from "@/lib/tipos";

export const metadata: Metadata = { title: "Dashboard geral" };

/** Dashboard geral: o resumo dos principais dados, com atalhos para os dashboards de cada área. */
export default async function GeralPage({ searchParams }: PageProps<"/app/dashboard/geral">) {
  const painel = await prepararDashboard(searchParams);
  // Os alertas são de quem acompanha a equipe (admin e supervisor); o técnico não os recebe.
  const [dados, alertas] = await Promise.all([
    api<Dados>("/indicadores/geral", { consulta: painel.consulta }),
    painel.acompanha ? api<{ total: number }>("/alertas", { consulta: { lido: false, tamanho: 1 } }) : null,
  ]);
  return (
    <>
      <CabecalhoDoPainel acao={rotas.app.dashboard} filtro={painel.filtro} de={dados.de} ate={dados.ate} equipes={painel.equipes} nomeDaEquipe={painel.nomeDaEquipe} />
      <DashboardGeral
        dados={dados}
        rotuloAnterior={painel.rotuloAnterior}
        alertasNaoLidos={alertas?.total ?? null}
        verExportacao={ehAdmin(painel.usuario)}
        acompanha={painel.acompanha}
        consulta={painel.consultaDaUrl}
      />
    </>
  );
}
