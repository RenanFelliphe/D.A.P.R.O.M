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
export default async function GeralPage({ searchParams }: PageProps<"/web/indicadores/geral">) {
  const painel = await prepararDashboard(searchParams);
  const [dados, alertas] = await Promise.all([
    api<Dados>("/indicadores/geral", { consulta: painel.consulta }),
    api<{ total: number }>("/alertas", { consulta: { lido: false, tamanho: 1 } }),
  ]);
  return (
    <>
      <CabecalhoDoPainel acao={rotas.web.indicadores} filtro={painel.filtro} de={dados.de} ate={dados.ate} equipes={painel.equipes} nomeDaEquipe={painel.nomeDaEquipe} />
      <DashboardGeral
        dados={dados}
        rotuloAnterior={painel.rotuloAnterior}
        alertasNaoLidos={alertas.total}
        verExportacao={ehAdmin(painel.usuario)}
        consulta={painel.consultaDaUrl}
      />
    </>
  );
}
