import Link from "next/link";
import { Panel, TableWrap } from "@/components/web/Panel";
import type { GrupoModelo } from "@/data/modelos";
import { data } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { RestaurarModelo } from "./RestaurarModelo";

/**
 * Modelos excluídos depois de publicados: saíram das listas e das APRs novas, mas as versões ficam guardadas porque
 * APRs e PDFs apontam para elas. Fechado por padrão; quem edita pode restaurar.
 */
export function ModelosExcluidos({ grupos, podeEditar }: { grupos: GrupoModelo[]; podeEditar: boolean }) {
  return (
    <details className="excluidos">
      <summary>{`Modelos excluídos (${grupos.length})`}</summary>
      <Panel style={{ gap: 12 }}>
        <span className="muted" style={{ fontSize: 13.5 }}>
          Não aparecem para o técnico nem recebem atividades. As versões continuam guardadas para o histórico das APRs e dos PDFs.
        </span>
        <TableWrap>
          <table className="tb">
            <caption className="sr">Modelos de APR excluídos</caption>
            <thead>
              <tr>
                <th style={{ width: 110 }}>Código</th>
                <th>Título</th>
                <th style={{ width: 90 }}>Versões</th>
                <th style={{ width: 90 }}>APRs</th>
                <th style={{ width: 120 }}>Excluído em</th>
                {podeEditar && <th style={{ width: 120 }} />}
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={g.codigo} className="off">
                  <td className="mono">
                    <Link href={rotas.web.modelo(g.codigo)}>{g.codigo}</Link>
                  </td>
                  <td>{g.titulo}</td>
                  <td>{g.versoes.length}</td>
                  <td>{g.aprsTotal}</td>
                  <td>{data(g.arquivadoEm)}</td>
                  {podeEditar && (
                    <td className="acoes-linha">
                      <RestaurarModelo codigo={g.codigo} compacto />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Panel>
    </details>
  );
}
