import { Panel, TableWrap } from "@/components/web/Panel";
import { ArquivoProcessado } from "./ArquivoProcessado";
import { LinhasIgnoradas } from "./LinhasIgnoradas";
import type { ResultadoDaPlanilha } from "./tipos";

/** O que a importação da planilha fez: criadas, atualizadas e ignoradas, os avisos e as linhas que ficaram de fora. */
export function ResultadoPlanilha({ nome, dados, podeCadastrarEquipe }: { nome: string; dados: ResultadoDaPlanilha; podeCadastrarEquipe: boolean }) {
  return (
    <>
      <ArquivoProcessado nome={nome} detalhe="processada agora" criadas={dados.criadas} atualizadas={dados.atualizadas} ignoradas={dados.ignoradas.length} />
      {dados.avisos.length > 0 && (
        <Panel>
          <h2>Avisos · {dados.avisos.length}</h2>
          <p className="muted">Estas ordens entraram, mas merecem atenção.</p>
          <TableWrap>
            <table className="tb">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>Linha</th>
                  <th style={{ width: 110 }}>Ordem</th>
                  <th>Aviso</th>
                </tr>
              </thead>
              <tbody>
                {dados.avisos.map((a, i) => (
                  <tr key={i}>
                    <td className="mono">{a.linha ?? "—"}</td>
                    <td className="mono">{a.numero_ordem}</td>
                    <td>{a.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      )}
      {dados.ignoradas.length > 0 && <LinhasIgnoradas ignoradas={dados.ignoradas} podeCadastrarEquipe={podeCadastrarEquipe} />}
    </>
  );
}
