import type { Metadata } from "next";
import { CabecalhoDoPainel } from "@/components/web/indicadores/CabecalhoDoPainel";
import { prepararDashboard } from "@/components/web/indicadores/carregar";
import { DashboardOs } from "@/components/web/indicadores/DashboardOs";
import { lerSituacaoDoMapa, TODAS_AS_SITUACOES } from "@/components/web/indicadores/MapaDoDashboard";
import type { ResumoDasImportacoes } from "@/components/web/importacao/tipos";
import { veImportacao } from "@/components/web/os/secao";
import type { DashboardOs as Dados, MapaDeCalorDoPeriodo } from "@/data/dashboards";
import { carregarPreviaDaExportacao } from "@/data/indicadores-carga";
import { api } from "@/lib/api";
import type { ListaDePreventivas } from "@/lib/preventivas";
import { rotas } from "@/lib/rotas";

export const metadata: Metadata = { title: "Dashboard de OS" };

/**
 * Dashboard de OS: o que precisa de atenção, o mapa de calor (o destaque), as preventivas (o ciclo dos planos e as programadas),
 * os resultados do período (encerradas, tempo e interrupções); para o admin, também a entrada de OS (que
 * não depende da equipe) e a baixa no SAP. É a primeira aba do Dashboard de quem não executa OS (o admin).
 */
export default async function OsPage({ searchParams }: PageProps<"/app/dashboard/os">) {
  const painel = await prepararDashboard(searchParams);
  const completo = veImportacao(painel.usuario);
  const situacao = lerSituacaoDoMapa((await searchParams).status);
  const [dados, mapa, entrada, previa, ciclos, alertas] = await Promise.all([
    api<Dados>("/indicadores/os", { consulta: painel.consulta }),
    // O mesmo período e a mesma equipe do painel; a `api` já limita ao escopo de quem pede.
    api<MapaDeCalorDoPeriodo>("/os/mapa-calor", { consulta: { ...painel.consulta, status: situacao === TODAS_AS_SITUACOES ? undefined : situacao } }),
    completo ? api<ResumoDasImportacoes>("/importacoes/resumo", { consulta: { periodo: painel.filtro.periodo } }) : Promise.resolve(null),
    completo ? carregarPreviaDaExportacao() : Promise.resolve(null),
    // O ciclo das preventivas é de agora (não depende do período); só a equipe filtra.
    api<ListaDePreventivas>("/preventivas", { consulta: { equipe_id: painel.consulta.equipe_id } })
      .then((r) => r.contagem)
      .catch(() => null),
    // Os alertas são de quem acompanha a equipe (admin e supervisor); o técnico não os recebe.
    painel.acompanha ? api<{ total: number }>("/alertas", { consulta: { lido: false, tamanho: 1 } }) : null,
  ]);
  return (
    <>
      <CabecalhoDoPainel acao={rotas.app.dashboardOs} filtro={painel.filtro} de={dados.de} ate={dados.ate} equipes={painel.equipes} nomeDaEquipe={painel.nomeDaEquipe} />
      <DashboardOs
        dados={dados}
        rotuloAnterior={painel.rotuloAnterior}
        mapa={mapa}
        situacaoDoMapa={situacao}
        filtro={painel.filtro}
        entrada={entrada}
        exportacao={previa ? { total: previa.total, os: previa.os } : null}
        porTecnico={painel.acompanha}
        ciclos={ciclos}
        alertasNaoLidos={alertas?.total ?? null}
      />
    </>
  );
}
