import type { Metadata } from "next";
import { CabecalhoDoPainel } from "@/components/web/indicadores/CabecalhoDoPainel";
import { prepararDashboard } from "@/components/web/indicadores/carregar";
import { DashboardOs } from "@/components/web/indicadores/DashboardOs";
import type { ResumoDasImportacoes } from "@/components/web/importacao/tipos";
import { veImportacao } from "@/components/web/os/secao";
import type { DashboardOs as Dados } from "@/data/dashboards";
import { carregarPreviaDaExportacao } from "@/data/indicadores-carga";
import { api } from "@/lib/api";
import type { ListaDePreventivas } from "@/lib/preventivas";
import { rotas } from "@/lib/rotas";

export const metadata: Metadata = { title: "Dashboard de OS" };

/**
 * Dashboard de OS: carteira (com o ciclo das preventivas), programadas e encerradas, preventivas, tempo, interrupções e locais; para o admin,
 * também a entrada de OS (que não depende da equipe) e a baixa no SAP.
 */
export default async function OsPage({ searchParams }: PageProps<"/app/dashboard/os">) {
  const painel = await prepararDashboard(searchParams);
  const completo = veImportacao(painel.usuario);
  const [dados, entrada, previa, ciclos] = await Promise.all([
    api<Dados>("/indicadores/os", { consulta: painel.consulta }),
    completo ? api<ResumoDasImportacoes>("/importacoes/resumo", { consulta: { periodo: painel.filtro.periodo } }) : Promise.resolve(null),
    completo ? carregarPreviaDaExportacao() : Promise.resolve(null),
    // O ciclo das preventivas é de agora (não depende do período); só a equipe filtra.
    api<ListaDePreventivas>("/preventivas", { consulta: { equipe_id: painel.consulta.equipe_id } })
      .then((r) => r.contagem)
      .catch(() => null),
  ]);
  return (
    <>
      <CabecalhoDoPainel acao={rotas.app.dashboardOs} filtro={painel.filtro} de={dados.de} ate={dados.ate} equipes={painel.equipes} nomeDaEquipe={painel.nomeDaEquipe} />
      <DashboardOs dados={dados} rotuloAnterior={painel.rotuloAnterior} entrada={entrada} exportacao={previa ? { total: previa.total, os: previa.os } : null} porTecnico={painel.acompanha} ciclos={ciclos} />
    </>
  );
}
