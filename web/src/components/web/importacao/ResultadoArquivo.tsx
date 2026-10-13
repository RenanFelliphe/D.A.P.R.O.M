import { Panel, TableWrap } from "@/components/web/Panel";
import { ArquivoProcessado } from "./ArquivoProcessado";
import { LinhasIgnoradas } from "./LinhasIgnoradas";
import type { ResultadoDaImportacao } from "./tipos";

interface ResultadoArquivoProps {
  nome: string;
  /** Planilha (as ordens são linhas) ou PDF da OS (as ordens são as OS conferidas). */
  formato: "planilha" | "pdf";
  dados: ResultadoDaImportacao;
  podeCadastrarEquipe: boolean;
}

/** O que a importação do arquivo fez: criadas, atualizadas e ignoradas, os avisos e o que ficou de fora. */
export function ResultadoArquivo({ nome, formato, dados, podeCadastrarEquipe }: ResultadoArquivoProps) {
  const comLinha = dados.avisos.some((a) => a.linha !== undefined);
  return (
    <>
      <ArquivoProcessado
        nome={nome}
        formato={formato}
        detalhe={formato === "pdf" ? "registrado agora" : "processada agora"}
        criadas={dados.criadas}
        atualizadas={dados.atualizadas}
        ignoradas={dados.ignoradas.length}
      />
      {dados.avisos.length > 0 && (
        <Panel>
          <h2>Avisos · {dados.avisos.length}</h2>
          <p className="muted">Estas ordens entraram, mas merecem atenção.</p>
          <TableWrap>
            <table className="tb">
              <thead>
                <tr>
                  {comLinha && <th style={{ width: 70 }}>Linha</th>}
                  <th style={{ width: 110 }}>Ordem</th>
                  <th>Aviso</th>
                </tr>
              </thead>
              <tbody>
                {dados.avisos.map((a, i) => (
                  <tr key={i}>
                    {comLinha && <td className="mono">{a.linha ?? "—"}</td>}
                    <td className="mono">{a.numero_ordem}</td>
                    <td>{a.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      )}
      {dados.ignoradas.length > 0 && <LinhasIgnoradas ignoradas={dados.ignoradas} podeCadastrarEquipe={podeCadastrarEquipe} titulo={formato === "pdf" ? "OS ignoradas" : "Linhas ignoradas"} />}
    </>
  );
}
