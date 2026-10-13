import { Icon } from "@/components/ui/Icon";
import { Kpi, Panel } from "@/components/web/Panel";
import type { DashboardMeus as Dados } from "@/data/dashboards";
import { duracao } from "@/lib/formatar";
import { CabecalhoDoBloco, comparacao, Medidor, plural, porcentagem, Secao } from "./blocos";
import { COR_EM_DIA } from "./cores";
import { Interrupcoes, Locais, nomeDaUnidade, SERIES_POR_TIPO } from "./DashboardOs";
import { GraficoColunas } from "./GraficoColunas";
import { fracao, OsComMaisPausaNoPeriodo, PausasPorMotivo, TempoDoPeriodo } from "./TempoDeExecucao";

/**
 * Meus resultados: o dashboard da própria pessoa (técnico e supervisor). Só o que ela fez no período: as OS que encerrou, as
 * APRs que preencheu, o tempo das execuções dela e as que interrompeu. Não compara com colegas.
 */
export function DashboardMeus({ dados, rotuloAnterior }: { dados: Dados; rotuloAnterior: string }) {
  const { encerradas: e, aprs: a, tempo: t, interrupcoes } = dados;
  const unidade = nomeDaUnidade[dados.agrupamento];
  const pontos = dados.serie.map((p) => ({ inicio: p.inicio, fim: p.fim, valores: { corretivas: p.corretivas, preventivas: p.preventivas } }));

  return (
    <Secao id="meus-periodo-t" titulo="No período" descricao="O que você fez no período: as execuções que encerrou, as APRs que preencheu e as que interrompeu.">
      <div className="kpis k4">
        <Kpi label="OS encerradas por você" marker={<Icon name="check" size={13} style={{ color: "var(--ink3)" }} />} value={e.total} sub={comparacao(e.total, e.anterior, rotuloAnterior)} />
        <Kpi
          label="APRs preenchidas"
          marker={<Icon name="clip" size={13} style={{ color: "var(--ink3)" }} />}
          value={a.total}
          sub={a.total === 0 ? comparacao(0, a.anterior, rotuloAnterior) : `${porcentagem(a.bloqueadas, a.total)}% bloqueadas (${a.bloqueadas})`}
          subStyle={a.bloqueadas > 0 ? { color: "var(--blq)", fontWeight: 500 } : undefined}
        />
        <Kpi
          label="Tempo líquido médio"
          marker={<Icon name="clock" size={13} style={{ color: "var(--ink3)" }} />}
          value={t.tempo_liquido_medio_min === null ? "—" : duracao(t.tempo_liquido_medio_min)}
          sub={t.execucoes === 0 ? "nenhuma execução encerrada" : `${plural(t.execucoes, "execução encerrada", "execuções encerradas")} · ${fracao(t.proporcao_pausa)} em pausa`}
        />
        <Kpi
          label="Interrupções por risco"
          marker={<Icon name="octagon" size={13} style={{ color: interrupcoes.total > 0 ? "var(--blq)" : "var(--ink3)" }} />}
          value={interrupcoes.total}
          sub="execuções suas paradas por risco"
        />
      </div>
      <Panel>
        <CabecalhoDoBloco
          titulo={`OS encerradas por ${unidade}`}
          descricao={e.total === 0 ? "Corretivas e preventivas, pelo fim da execução" : `${e.corretivas} corretivas e ${e.preventivas} preventivas, pelo fim da execução`}
        />
        <GraficoColunas pontos={pontos} series={SERIES_POR_TIPO} agrupamento={dados.agrupamento} medida="OS encerradas" vazio="Você não encerrou nenhuma OS neste período." />
      </Panel>
      <div className="two eq">
        <TempoDoPeriodo tempo={t} />
        <Panel>
          <CabecalhoDoBloco titulo="APRs aprovadas" descricao="Das APRs que você preencheu no período" />
          <ul className="lista-barras">
            <Medidor
              rotulo={
                <span className="row g6">
                  <Icon name="check" size={13} style={{ color: "var(--enc)" }} />
                  Aprovadas
                </span>
              }
              parte={a.total - a.bloqueadas}
              todo={a.total}
              cor={COR_EM_DIA}
              detalhe={`${a.total - a.bloqueadas} de ${a.total}`}
              vazio="nenhuma APR no período"
            />
          </ul>
        </Panel>
      </div>
      <div className="two eq">
        <PausasPorMotivo motivos={t.por_motivo} />
        <OsComMaisPausaNoPeriodo lista={t.os_com_mais_pausa} descricao="Suas execuções encerradas com mais tempo em pausa" />
      </div>
      <div className="two eq">
        {/* O nome seria o da própria pessoa: não se repete. */}
        <Interrupcoes interrupcoes={{ ...interrupcoes, recentes: interrupcoes.recentes.map((r) => ({ ...r, executor: null })) }} />
        <Locais locais={dados.locais} descricao="Onde você mais trabalhou no período" />
      </div>
    </Secao>
  );
}
