import { Panel, TableWrap } from "@/components/web/Panel";
import { equipes } from "@/data/indicadores";

/** Tempo médio de execução por equipe (líquido, sem as pausas). */
export function TempoExecucao() {
  return (
    <Panel style={{ padding: 20 }}>
      <div className="stack" style={{ gap: 2 }}>
        <h2>Tempo de execução</h2>
        <span className="muted">Média por preventiva encerrada em outubro. O tempo líquido não conta as pausas.</span>
      </div>
      <TableWrap>
        <table className="tb">
          <caption className="sr">Tempo médio de execução por equipe</caption>
          <thead>
            <tr>
              <th>Equipe</th>
              <th className="r">Encerradas</th>
              <th className="r">Tempo líquido médio</th>
              <th className="r">Pausa média</th>
              <th className="r">Pausa no total</th>
            </tr>
          </thead>
          <tbody>
            {equipes.map((e) => (
              <tr key={e.nome}>
                <th scope="row" style={{ fontWeight: 500 }}>
                  {e.nome}
                </th>
                <td className="r">{e.situacao.encerradas}</td>
                <td className="r" style={{ fontWeight: 600 }}>
                  {e.tempo.liquidoMedio}
                </td>
                <td className="r">{e.tempo.pausaMedia}</td>
                <td className="r">{e.tempo.pausaNoTotal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Panel>
  );
}
