import type { Metadata } from "next";
import { CabecalhoDoPainel } from "@/components/web/indicadores/CabecalhoDoPainel";
import { prepararDashboard } from "@/components/web/indicadores/carregar";
import { DashboardOs } from "@/components/web/indicadores/DashboardOs";
import type { ResumoDasImportacoes } from "@/components/web/importacao/tipos";
import { veImportacao } from "@/components/web/os/secao";
import type { DashboardOs as Dados } from "@/data/dashboards";
import { carregarPreviaDaExportacao } from "@/data/indicadores-carga";
import { api } from "@/lib/api";
import { rotas } from "@/lib/rotas";

export const metadata: Metadata = { title: "Dashboard de OS" };

/**
 * Dashboard de OS: carteira, programadas e encerradas, preventivas, tempo, interrupções e locais; para analista e admin,
 * também a entrada de OS (que não depende da equipe) e a baixa no SAP.
 */
export default async function OsPage({ searchParams }: PageProps<"/web/indicadores/os">) {
  const painel = await prepararDashboard(searchParams);
  const completo = veImportacao(painel.usuario.perfil);
  const [dados, entrada, previa] = await Promise.all([
    api<Dados>("/indicadores/os", { consulta: painel.consulta }),
    completo ? api<ResumoDasImportacoes>("/importacoes/resumo", { consulta: { periodo: painel.filtro.periodo } }) : Promise.resolve(null),
    completo ? carregarPreviaDaExportacao() : Promise.resolve(null),
  ]);
  return (
    <>
      <CabecalhoDoPainel acao={rotas.web.indicadoresOs} filtro={painel.filtro} de={dados.de} ate={dados.ate} equipes={painel.equipes} nomeDaEquipe={painel.nomeDaEquipe} />
      <DashboardOs dados={dados} rotuloAnterior={painel.rotuloAnterior} entrada={entrada} exportacao={previa ? { total: previa.total, os: previa.os } : null} />
    </>
  );
}
