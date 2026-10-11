import { LinkAviso } from "@/components/ui/Aviso";
import { linhasIgnoradas } from "@/data/importacao";
import { Panel, TableWrap } from "@/components/web/Panel";

const link = { fontSize: 13.5, fontWeight: 600 } as const;

/** Tabela com as linhas da planilha que não entraram e o motivo. */
export function LinhasIgnoradas() {
  return (
    <Panel>
      <div className="row between">
        <h2>Linhas ignoradas · 7</h2>
        <LinkAviso aviso="Abriria o cadastro de equipe para o centro LAB_QUI." style={link}>
          Cadastrar equipe para LAB_QUI
        </LinkAviso>
      </div>
      <TableWrap>
        <table className="tb">
          <thead>
            <tr>
              <th style={{ width: 70 }}>Linha</th>
              <th style={{ width: 110 }}>Ordem</th>
              <th style={{ width: 160 }}>Centro de trabalho</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {linhasIgnoradas.map((l) => (
              <tr key={l.linha}>
                <td className="mono">{l.linha}</td>
                <td className="mono">{l.ordem}</td>
                <td className="mono">{l.centro}</td>
                <td>{l.motivo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <LinkAviso aviso="Mostraria as 7 linhas." style={link}>
        Mostrar as 7 linhas
      </LinkAviso>
    </Panel>
  );
}
