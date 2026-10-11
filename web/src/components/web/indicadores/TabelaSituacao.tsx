import { TableWrap } from "@/components/web/Panel";
import { equipes, totalEquipe } from "@/data/indicadores";

/** Valores do gráfico em formato de tabela (alternativa acessível). */
export function TabelaSituacao() {
  return (
    <TableWrap>
      <table className="tb">
        <caption className="sr">Preventivas de outubro por equipe e situação</caption>
        <thead>
          <tr>
            <th>Equipe</th>
            <th className="r">Encerradas</th>
            <th className="r">Abertas no prazo</th>
            <th className="r">Atrasadas com just.</th>
            <th className="r">Atrasadas sem just.</th>
            <th className="r">Total</th>
          </tr>
        </thead>
        <tbody>
          {equipes.map((e) => (
            <tr key={e.nome}>
              <th scope="row" style={{ fontWeight: 500 }}>
                {e.nome}
              </th>
              <td className="r">{e.situacao.encerradas}</td>
              <td className="r">{e.situacao.abertas}</td>
              <td className="r">{e.situacao.comJustificativa}</td>
              <td className="r" style={{ fontWeight: 600 }}>
                {e.situacao.semJustificativa}
              </td>
              <td className="r" style={{ fontWeight: 600 }}>
                {totalEquipe(e)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
