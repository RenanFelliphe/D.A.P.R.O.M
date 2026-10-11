import { importacoesAnteriores } from "@/data/importacao";
import { Panel, TableWrap } from "@/components/web/Panel";

/** Histórico das planilhas já importadas. */
export function ImportacoesAnteriores() {
  return (
    <Panel>
      <h2>Importações anteriores</h2>
      <TableWrap>
        <table className="tb">
          <thead>
            <tr>
              <th>Data</th>
              <th>Arquivo</th>
              <th>Responsável</th>
              <th className="r">Criadas</th>
              <th className="r">Atualizadas</th>
              <th className="r">Ignoradas</th>
            </tr>
          </thead>
          <tbody>
            {importacoesAnteriores.map((i) => (
              <tr key={i.arquivo}>
                <td>{i.data}</td>
                <td className="mono" style={{ fontSize: 12.5 }}>
                  {i.arquivo}
                </td>
                <td>{i.responsavel}</td>
                <td className="r">{i.criadas}</td>
                <td className="r">{i.atualizadas}</td>
                <td className="r">{i.ignoradas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Panel>
  );
}
