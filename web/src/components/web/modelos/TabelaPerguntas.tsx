import { Badge } from "@/components/ui/Badge";
import { TableWrap } from "@/components/web/Panel";
import { perguntasApr03, rotuloTipoPergunta } from "@/data/modelos";

/** Perguntas do rascunho aberto; a pergunta nova da v5 fica destacada. */
export function TabelaPerguntas() {
  return (
    <TableWrap>
      <table className="tb">
        <thead>
          <tr>
            <th style={{ width: 36 }}>#</th>
            <th>Pergunta</th>
            <th style={{ width: 130 }}>Seção</th>
            <th style={{ width: 130 }}>Resposta crítica</th>
            <th style={{ width: 130 }}>Tipo</th>
          </tr>
        </thead>
        <tbody>
          {perguntasApr03.map((p) => (
            <tr key={p.numero} className={p.novaNaV5 ? "nw" : undefined}>
              <td className="mono" style={{ color: "var(--ink4)" }}>
                {p.numero}
              </td>
              <td>
                {p.texto}
                {p.novaNaV5 && (
                  <>
                    {" "}
                    <Badge tone="brand" style={{ padding: "0 7px", fontSize: 11, marginLeft: 6 }}>
                      Novo na v5
                    </Badge>
                  </>
                )}
              </td>
              <td>{p.secao}</td>
              <td>
                <span className="pill line">{p.respostaCritica}</span>
              </td>
              <td>
                <span className={`pill ${p.tipo}`}>{rotuloTipoPergunta[p.tipo]}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
