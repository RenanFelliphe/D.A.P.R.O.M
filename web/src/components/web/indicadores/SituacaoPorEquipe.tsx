import { Panel } from "@/components/web/Panel";
import { situacoes } from "@/data/indicadores";
import { BarrasSituacao } from "./BarrasSituacao";
import { TabelaSituacao } from "./TabelaSituacao";

/** Painel com legenda, gráfico de barras empilhadas e tabela de valores. */
export function SituacaoPorEquipe() {
  return (
    <Panel style={{ padding: 20 }}>
      <div className="row between wrap" style={{ alignItems: "baseline" }}>
        <div className="stack" style={{ gap: 2 }}>
          <h2>Situação das preventivas por equipe</h2>
          <span className="muted">Quantidade de OS preventivas de outubro, por situação</span>
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
      <BarrasSituacao />
      <TabelaSituacao />
    </Panel>
  );
}
