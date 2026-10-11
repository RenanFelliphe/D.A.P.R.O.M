import { TableWrap } from "@/components/web/Panel";
import { itensApr } from "@/data/detalhe";

/** Tabela com os itens de destaque da APR aprovada. */
export function ItensAprResumo() {
  return (
    <TableWrap>
      <table className="tb">
        <thead>
          <tr>
            <th style={{ width: 44 }}>#</th>
            <th>Item</th>
            <th style={{ width: 140 }}>Tipo</th>
            <th style={{ width: 110 }}>Resposta</th>
          </tr>
        </thead>
        <tbody>
          {itensApr.map((linha) => (
            <tr key={linha.numero} className={linha.alerta ? "al" : undefined}>
              <td className="mono" style={{ color: "var(--ink4)" }}>
                {linha.numero}
              </td>
              <td>{linha.item}</td>
              <td>{linha.tipo}</td>
              <td style={{ color: linha.alerta ? "var(--al)" : "var(--enc)", fontWeight: 600 }}>{linha.resposta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
