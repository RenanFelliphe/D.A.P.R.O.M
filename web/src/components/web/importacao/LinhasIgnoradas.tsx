import Link from "next/link";
import { Panel, TableWrap } from "@/components/web/Panel";
import { rotas } from "@/lib/rotas";
import type { LinhaIgnorada } from "./tipos";

const link = { fontSize: 13.5, fontWeight: 600 } as const;
const SEM_EQUIPE = "Centro de trabalho sem equipe cadastrada";

/** Tabela das linhas (ou ordens) que não entraram, com o motivo de cada uma. */
export function TabelaIgnoradas({ ignoradas }: { ignoradas: LinhaIgnorada[] }) {
  return (
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
          {ignoradas.map((l, i) => (
            <tr key={i}>
              <td className="mono">{l.linha ?? "—"}</td>
              <td className="mono">{l.numero_ordem ?? "—"}</td>
              <td className="mono">{l.centro_trabalho ?? "—"}</td>
              <td>{l.motivo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

/** Painel com as linhas da planilha que não entraram e o motivo. */
export function LinhasIgnoradas({ ignoradas, podeCadastrarEquipe }: { ignoradas: LinhaIgnorada[]; podeCadastrarEquipe: boolean }) {
  const centrosSemEquipe = [...new Set(ignoradas.filter((l) => l.motivo === SEM_EQUIPE && l.centro_trabalho).map((l) => l.centro_trabalho!))];
  return (
    <Panel>
      <div className="row between wrap">
        <h2>Linhas ignoradas · {ignoradas.length}</h2>
        {podeCadastrarEquipe && centrosSemEquipe.length > 0 && (
          <Link href={rotas.web.usuarios} style={link}>
            Cadastrar equipe para {centrosSemEquipe.join(", ")}
          </Link>
        )}
      </div>
      <TabelaIgnoradas ignoradas={ignoradas} />
    </Panel>
  );
}
