"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Panel, TableWrap } from "@/components/web/Panel";
import { osParaExportar, totalPendentesExportacao } from "@/data/indicadores";
import { rotas } from "@/lib/telas";
import { useExportacao } from "@/state/exportacao";

/** Lista das OS encerradas ainda não exportadas e botão para gerar a planilha de baixa. */
export function ExportacaoSap() {
  const { exportado, gerarPlanilha } = useExportacao();
  const pendentes = exportado ? 0 : totalPendentesExportacao;

  return (
    <Panel style={{ padding: 20 }}>
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack" style={{ gap: 2 }}>
          <h2>Exportação para baixa no SAP</h2>
          <span className="muted">
            <span>{pendentes}</span> OS encerradas ainda não exportadas · última exportação em 12/10 às 17:05 (29 OS)
          </span>
        </div>
        <Button variant="p" sm style={exportado ? { opacity: 0.6 } : undefined} onClick={gerarPlanilha}>
          <Icon name="download" size={16} />
          <span>{exportado ? "Nenhuma OS nova para exportar" : `Gerar planilha · ${totalPendentesExportacao} OS`}</span>
        </Button>
      </div>
      <TableWrap>
        <table className="tb">
          <thead>
            <tr>
              <th>Ordem</th>
              <th>Atividade</th>
              <th>Equipe</th>
              <th>Encerrada em</th>
              <th>PDF</th>
            </tr>
          </thead>
          <tbody>
            {exportado ? (
              <tr>
                <td colSpan={5} className="muted" style={{ padding: "18px 12px" }}>
                  Nenhuma OS encerrada pendente de exportação.
                </td>
              </tr>
            ) : (
              osParaExportar.map((os) => (
                <tr key={os.ordem}>
                  <td className="mono">{os.linkDetalhe ? <Link href={rotas.web.detalhe}>{os.ordem}</Link> : os.ordem}</td>
                  <td>{os.atividade}</td>
                  <td>{os.equipe}</td>
                  <td>{os.encerradaEm}</td>
                  <td>
                    <Link href={rotas.doc.pdf} style={{ fontWeight: 600 }}>
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableWrap>
      <span className="muted">
        Ao gerar a planilha, as OS são marcadas como exportadas. A baixa no SAP continua manual, usando o link do PDF de
        cada OS.
      </span>
    </Panel>
  );
}
