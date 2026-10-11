import type { Pae } from "@/data/modelos";

/** Grade de contatos de emergência (PAE) em leitura: o rótulo da linha e as células, na ordem da coluna. */
export function PaeGrade({ pae }: { pae: Pae | null }) {
  const linhas = pae?.linhas ?? [];
  if (!pae || linhas.length === 0) return <p className="small">Este modelo não tem plano de atendimento a emergências (PAE).</p>;
  return (
    <div className="stack g8">
      <div className="stack" style={{ lineHeight: 1.35 }}>
        {pae.titulo ? <strong style={{ fontSize: 14 }}>{pae.titulo}</strong> : null}
        {pae.subtitulo ? <span className="small">{pae.subtitulo}</span> : null}
        {pae.fluxo ? <span className="small">{pae.fluxo}</span> : null}
      </div>
      <div className="tbw" style={{ overflowX: "auto" }}>
        <table className="pae-grade">
          <tbody>
            {linhas.map((linha, i) => (
              <tr key={i}>
                <th scope="row">{linha.rotulo ?? ""}</th>
                <td>
                  {[...linha.celulas]
                    .sort((a, b) => a.coluna - b.coluna)
                    .map((celula, j) => (
                      <span key={j} className="cel">
                        {celula.texto}
                      </span>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
