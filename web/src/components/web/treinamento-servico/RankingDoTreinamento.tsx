import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { formatarNota, type LinhaDoRankingDoTreinamento, type RankingDoTreinamento as Ranking } from "@/lib/treinamento-servico";

interface RankingDoTreinamentoProps {
  ranking: Ranking;
  className?: string;
}

/** A posição, com a medalha dos três primeiros (as mesmas cores do ranking da gamificação). */
function Posicao({ n }: { n: number }) {
  return n <= 3 ? <span className={cx("pos-medalha", `p${n}`)}>{n}</span> : <span className="ts-ranking-pos">{n}º</span>;
}

function Linha({ linha, ordem }: { linha: LinhaDoRankingDoTreinamento; ordem: number }) {
  return (
    <li data-voce={linha.voce || undefined} aria-current={linha.voce ? "true" : undefined} style={{ "--i": ordem } as CSSProperties}>
      <Posicao n={linha.posicao} />
      <span className="ts-ranking-nome">
        <span className={cx(!linha.usuario_id && "rank-anonimo")}>{linha.nome}</span>
        {linha.voce && <Badge tone="brand">Você</Badge>}
        {linha.equipe_nome && <small>{linha.equipe_nome}</small>}
      </span>
      <span className="ts-ranking-nota" aria-label={`Nota ${formatarNota(linha.nota)} de ${formatarNota(linha.nota_maxima)} (${linha.aproveitamento}%)`}>
        <span className="ts-ranking-barra" aria-hidden="true">
          <i style={{ width: `${linha.aproveitamento}%` }} />
        </span>
        <strong aria-hidden="true">{formatarNota(linha.nota)}</strong>
        <small aria-hidden="true">{linha.aproveitamento}%</small>
      </span>
    </li>
  );
}

/**
 * O ranking de um treinamento de serviço: quem já concluiu, pela melhor nota de cada um (acertos, tempo e fases). As
 * primeiras posições e, se a pessoa estiver mais abaixo, a linha dela no fim. Aparece no resultado do jogo e na capa `/treinar`.
 */
export function RankingDoTreinamento({ ranking, className }: RankingDoTreinamentoProps) {
  const { linhas, minha, participantes } = ranking;
  const minhaForaDasPrimeiras = minha && !linhas.some((l) => l.voce);

  return (
    <section className={cx("ts-ranking", className)} aria-label="Ranking deste treinamento">
      <header className="ts-ranking-cab">
        <span className="ts-ranking-icone" aria-hidden="true">
          <Icon name="trophy" size={18} />
        </span>
        <div className="ts-ranking-titulo">
          <h3>Ranking deste treinamento</h3>
          <span className="small">
            {participantes === 0 ? "Vale a melhor nota de cada pessoa" : `${participantes === 1 ? "1 pessoa concluiu" : `${participantes} pessoas concluíram`} · vale a melhor nota de cada um`}
          </span>
        </div>
        {minha && (
          <span className="ts-ranking-minha">
            Você está em
            <strong>{minha.posicao}º</strong>
          </span>
        )}
      </header>
      {linhas.length === 0 ? (
        <p className="ts-ranking-vazio">Ninguém concluiu ainda: quem concluir primeiro abre o ranking.</p>
      ) : (
        <ul className="ts-ranking-lista">
          {linhas.map((l, i) => (
            <Linha key={l.usuario_id ?? `anonimo-${l.posicao}`} linha={l} ordem={i} />
          ))}
          {minhaForaDasPrimeiras && (
            <>
              <li className="ts-ranking-reticencias" aria-hidden="true">
                ⋯
              </li>
              <Linha linha={minha} ordem={linhas.length + 1} />
            </>
          )}
        </ul>
      )}
    </section>
  );
}
