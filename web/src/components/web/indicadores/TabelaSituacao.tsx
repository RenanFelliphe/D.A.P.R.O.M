import { TableWrap } from "@/components/web/Panel";
import { totalDaEquipe, type IndicadoresDoMes } from "@/data/indicadores";

/** Valores do gráfico em formato de tabela (alternativa acessível), com a linha de total. */
export function TabelaSituacao({ equipes, mes, rotuloDoMes }: { equipes: IndicadoresDoMes["por_equipe"]; mes: IndicadoresDoMes; rotuloDoMes: string }) {
  return (
    <TableWrap>
      <table className="tb">
        <caption className="sr">Preventivas de {rotuloDoMes} por equipe e situação</caption>
        <thead>
          <tr>
            <th>Equipe</th>
            <th className="r">Encerradas</th>
            <th className="r">Atrasadas com just.</th>
            <th className="r">Atrasadas sem just.</th>
            <th className="r">Total</th>
          </tr>
        </thead>
        <tbody>
          {equipes.map((e) => (
            <tr key={e.equipe_id}>
              <th scope="row" style={{ fontWeight: 500 }}>
                {e.equipe_nome}
              </th>
              <td className="r">{e.encerradas}</td>
              <td className="r">{e.atrasadas_justificadas}</td>
              <td className="r" style={{ fontWeight: 600 }}>
                {e.atrasadas_sem_justificativa}
              </td>
              <td className="r" style={{ fontWeight: 600 }}>
                {totalDaEquipe(e)}
              </td>
            </tr>
          ))}
          {equipes.length > 1 && (
            <tr>
              <th scope="row" style={{ fontWeight: 600 }}>
                Todas
              </th>
              <td className="r" style={{ fontWeight: 600 }}>
                {mes.encerradas}
              </td>
              <td className="r" style={{ fontWeight: 600 }}>
                {mes.atrasadas_justificadas}
              </td>
              <td className="r" style={{ fontWeight: 600 }}>
                {mes.atrasadas_sem_justificativa}
              </td>
              <td className="r" style={{ fontWeight: 600 }}>
                {totalDaEquipe(mes)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </TableWrap>
  );
}
