import { Fragment } from "react";
import { Panel, TableWrap } from "@/components/web/Panel";
import { dataHora } from "@/lib/formatar";
import { TabelaIgnoradas } from "./LinhasIgnoradas";
import { nomeDoArquivo, type Importacao } from "./tipos";

/** Histórico das leituras do SAP e das planilhas importadas, com o detalhe das linhas ignoradas. */
export function ImportacoesAnteriores({ importacoes }: { importacoes: Importacao[] }) {
  return (
    <Panel>
      <h2>Importações anteriores</h2>
      {importacoes.length === 0 ? (
        <p className="muted">Nenhuma leitura ou planilha ainda.</p>
      ) : (
        <TableWrap>
          <table className="tb">
            <thead>
              <tr>
                <th>Data</th>
                <th>Origem</th>
                <th>Responsável</th>
                <th className="r">Criadas</th>
                <th className="r">Atualizadas</th>
                <th className="r">Ignoradas</th>
              </tr>
            </thead>
            <tbody>
              {importacoes.map((i) => (
                <Fragment key={i.id}>
                  <tr>
                    <td>{dataHora(i.criada_em)}</td>
                    <td>
                      {i.origem === "api" ? (
                        "API do SAP"
                      ) : (
                        <span className="mono" style={{ fontSize: 12.5, overflowWrap: "anywhere" }}>
                          {nomeDoArquivo(i.arquivo)}
                        </span>
                      )}
                    </td>
                    <td>{i.usuario_nome ?? "Leitura automática"}</td>
                    <td className="r">{i.criadas}</td>
                    <td className="r">{i.atualizadas}</td>
                    <td className="r">{i.ignoradas}</td>
                  </tr>
                  {(i.erro || (i.detalhe_ignoradas?.length ?? 0) > 0) && (
                    <tr>
                      <td colSpan={6} style={{ paddingTop: 0 }}>
                        {i.erro && (
                          <div role="alert" style={{ color: "var(--blq)", fontSize: 13.5, fontWeight: 600 }}>
                            Falha na leitura: {i.erro}
                          </div>
                        )}
                        {(i.detalhe_ignoradas?.length ?? 0) > 0 && (
                          <details>
                            <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 600 }}>
                              Ver {i.detalhe_ignoradas!.length} {i.detalhe_ignoradas!.length === 1 ? "linha ignorada" : "linhas ignoradas"}
                            </summary>
                            <div style={{ marginTop: 8 }}>
                              <TabelaIgnoradas ignoradas={i.detalhe_ignoradas!} />
                            </div>
                          </details>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </Panel>
  );
}
