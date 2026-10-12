import { maximoDoEixo, situacoes, totalDaEquipe, type SituacaoDaEquipe } from "@/data/indicadores";

/** Percentual com até 2 casas, sem zeros à direita (ex.: 76.67%, 30%). */
const percentual = (valor: number, maximo: number) => `${Number(((valor / maximo) * 100).toFixed(2))}%`;

/** Gráfico de barras empilhadas: uma barra por equipe, um segmento por situação. */
export function BarrasSituacao({ equipes }: { equipes: SituacaoDaEquipe[] }) {
  const maximo = maximoDoEixo(equipes.map(totalDaEquipe));
  const marcas = [0, maximo / 3, (maximo * 2) / 3, maximo];
  return (
    <div
      className="bars"
      role="img"
      aria-label="Barras empilhadas com a situação das preventivas por equipe; os valores estão na tabela abaixo"
    >
      {equipes.map((equipe) => {
        const total = totalDaEquipe(equipe);
        return (
          <div key={equipe.equipe_id} className="bar-row">
            <span className="nm">{equipe.equipe_nome}</span>
            <div className="tr">
              <div className="st" style={{ width: percentual(total, maximo) }}>
                {situacoes.map((s) =>
                  equipe[s.chave] > 0 ? (
                    <i key={s.chave} style={{ flex: equipe[s.chave], background: s.cor }} title={`${s.nome}: ${equipe[s.chave]}`}></i>
                  ) : null,
                )}
              </div>
            </div>
            <span className="tot">{total}</span>
          </div>
        );
      })}
      <div className="axis" aria-hidden="true">
        <span className="sp"></span>
        <div className="ax">
          {marcas.map((marca, i) => (
            <span key={i} style={{ left: i === 0 ? 0 : percentual(marca, maximo) }}>
              {Number(marca.toFixed(1))}
            </span>
          ))}
        </div>
        <span className="sp2"></span>
      </div>
    </div>
  );
}
