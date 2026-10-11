import { equipes, marcasEixo, percentualDoEixo, situacoes, totalEquipe } from "@/data/indicadores";

/** Gráfico de barras empilhadas: uma barra por equipe, um segmento por situação. */
export function BarrasSituacao() {
  return (
    <div
      className="bars"
      role="img"
      aria-label="Barras empilhadas com a situação das preventivas por equipe; os valores estão na tabela abaixo"
    >
      {equipes.map((equipe) => {
        const total = totalEquipe(equipe);
        return (
          <div key={equipe.nome} className="bar-row">
            <span className="nm">{equipe.nome}</span>
            <div className="tr">
              <div className="st" style={{ width: percentualDoEixo(total) }}>
                {situacoes.map((s) => (
                  <i
                    key={s.chave}
                    style={{ flex: equipe.situacao[s.chave], background: s.cor }}
                    title={`${s.nome}: ${equipe.situacao[s.chave]}`}
                  ></i>
                ))}
              </div>
            </div>
            <span className="tot">{total}</span>
          </div>
        );
      })}
      <div className="axis" aria-hidden="true">
        <span className="sp"></span>
        <div className="ax">
          {marcasEixo.map((marca) => (
            <span key={marca} style={{ left: marca === 0 ? 0 : percentualDoEixo(marca) }}>
              {marca}
            </span>
          ))}
        </div>
        <span className="sp2"></span>
      </div>
    </div>
  );
}
