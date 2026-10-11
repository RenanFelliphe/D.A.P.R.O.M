import { Panel } from "@/components/web/Panel";
import { situacoes, type IndicadoresDoMes } from "@/data/indicadores";
import { BarrasSituacao } from "./BarrasSituacao";
import { TabelaSituacao } from "./TabelaSituacao";

/** Painel com legenda, gráfico de barras empilhadas e tabela de valores. */
export function SituacaoPorEquipe({ mes, rotuloDoMes }: { mes: IndicadoresDoMes; rotuloDoMes: string }) {
  return (
    <Panel style={{ padding: 20 }}>
      <div className="row between wrap" style={{ alignItems: "baseline" }}>
        <div className="stack" style={{ gap: 2 }}>
          <h2>Situação das preventivas por equipe</h2>
          <span className="muted">Quantidade de OS preventivas de {rotuloDoMes}, por situação</span>
        </div>
        <ul className="legend" aria-label="Legenda">
          {situacoes.map((s) => (
            <li key={s.chave}>
              <i style={{ background: s.cor }}></i>
              {s.nome}
            </li>
          ))}
        </ul>
      </div>
      {mes.por_equipe.length === 0 ? (
        <p className="muted">Nenhuma preventiva encerrada ou atrasada neste mês e nesta seleção.</p>
      ) : (
        <>
          <BarrasSituacao equipes={mes.por_equipe} />
          <TabelaSituacao equipes={mes.por_equipe} mes={mes} rotuloDoMes={rotuloDoMes} />
        </>
      )}
    </Panel>
  );
}
