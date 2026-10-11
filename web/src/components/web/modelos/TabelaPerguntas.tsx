import { Badge } from "@/components/ui/Badge";
import { TableWrap } from "@/components/web/Panel";
import { rotuloEvidencia, rotuloResposta, rotuloTipoItem, type ItemModelo, type RiscoModelo } from "@/data/modelos";

function LinhaItem({ item }: { item: ItemModelo }) {
  return (
    <tr>
      <td className="mono" style={{ color: "var(--ink4)" }}>
        {item.ordem}
      </td>
      <td>
        {item.texto}
        {item.permite_na && (
          <>
            {" "}
            <Badge tone="neu" style={{ padding: "0 7px", fontSize: 11, marginLeft: 6 }}>
              NA permitido
            </Badge>
          </>
        )}
      </td>
      <td>
        <span className="pill line">{item.resposta_bloqueante ? rotuloResposta[item.resposta_bloqueante] : "—"}</span>
      </td>
      <td>
        <span className={`pill ${item.tipo === "eliminatorio" ? "elim" : "alt"}`}>{rotuloTipoItem[item.tipo]}</span>
      </td>
      <td>{rotuloEvidencia[item.evidencia]}</td>
    </tr>
  );
}

function Tabela({ itens }: { itens: ItemModelo[] }) {
  return (
    <TableWrap>
      <table className="tb">
        <thead>
          <tr>
            <th style={{ width: 36 }}>#</th>
            <th>Texto</th>
            <th style={{ width: 120 }}>Resposta que bloqueia</th>
            <th style={{ width: 120 }}>Tipo</th>
            <th style={{ width: 80 }}>Evidência</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((i) => (
            <LinhaItem key={i.id} item={i} />
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

/** Itens de uma versão publicada, em leitura: a verificação e, por risco, as medidas preventivas. */
export function TabelaPerguntas({ itens, riscos }: { itens: ItemModelo[]; riscos: RiscoModelo[] }) {
  const verificacao = itens.filter((i) => i.secao === "verificacao");
  const medidas = itens.filter((i) => i.secao === "medida_preventiva");
  return (
    <div className="stack g16">
      <div className="stack g8">
        <h3 style={{ fontSize: 15 }}>{`Verificação (${verificacao.length})`}</h3>
        <Tabela itens={verificacao} />
      </div>
      <div className="stack g8">
        <h3 style={{ fontSize: 15 }}>{`Riscos e medidas preventivas (${riscos.length} riscos)`}</h3>
        {riscos.map((r) => {
          const deste = medidas.filter((m) => m.risco_ordem === r.ordem);
          return (
            <div key={r.id} className="stack g4">
              <span style={{ fontSize: 13.5 }}>
                <span className="small">{`${r.classificacao} · `}</span>
                <b>{r.nome}</b>
              </span>
              {deste.length > 0 ? <Tabela itens={deste} /> : <span className="small">Sem medidas preventivas.</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
