import Link from "next/link";
import { PaginacaoLista } from "@/components/web/PaginacaoLista";
import { Panel, TableWrap } from "@/components/web/Panel";
import { SeletorTemporada } from "@/components/web/gamificacao/SeletorTemporada";
import { dataHora } from "@/lib/formatar";
import { numero, pontos, type Extrato, type TemporadaDaLista } from "@/lib/gamificacao";
import { rotas } from "@/lib/rotas";

interface ExtratoPontosProps {
  extrato: Extrato;
  temporadas: TemporadaDaLista[];
  /** Endereço da página, para o filtro e a paginação. */
  caminho: string;
}

/** O extrato de pontos da pessoa, com o filtro por temporada: cada linha diz de onde veio o ponto ("APR completa da OS 4019821"). */
export function ExtratoPontos({ extrato, temporadas, caminho }: ExtratoPontosProps) {
  const geral = extrato.temporada === "geral";
  const temporada = temporadas.find((t) => t.codigo === extrato.temporada);
  return (
    <Panel className="gam-extrato" style={{ gap: 12 }}>
      <div className="row between wrap" style={{ alignItems: "flex-end" }}>
        <div className="stack g4">
          <h2>Extrato de pontos</h2>
          <span className="muted small">
            {geral ? "Todas as temporadas" : (temporada?.nome ?? extrato.temporada)}: {pontos(extrato.pontos)} em {numero(extrato.total)} {extrato.total === 1 ? "lançamento" : "lançamentos"}.
          </span>
        </div>
        <SeletorTemporada caminho={caminho} temporadas={temporadas} valor={extrato.temporada} id="temporada-extrato" />
      </div>
      <TableWrap>
        <table className="tb">
          <caption className="sr">Lançamentos de pontos</caption>
          <thead>
            <tr>
              <th style={{ width: 150 }}>Quando</th>
              <th>Pontos de</th>
              <th className="pts" style={{ width: 100 }}>
                Pontos
              </th>
            </tr>
          </thead>
          <tbody>
            {extrato.lancamentos.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">
                  Nenhum ponto {geral ? "ainda" : "nesta temporada"}. Os pontos chegam com a APR, a execução e as outras tarefas que pontuam (veja “Como pontuar”).
                </td>
              </tr>
            ) : (
              extrato.lancamentos.map((l) => (
                <tr key={l.id}>
                  <td className="muted">{dataHora(l.ocorrido_em)}</td>
                  <td>{l.os_id ? <Link href={rotas.app.os(l.os_id)}>{l.descricao}</Link> : l.descricao}</td>
                  <td className="pts">+{numero(l.pontos)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableWrap>
      <PaginacaoLista caminho={caminho} consulta={{ temporada: extrato.temporada }} pagina={extrato.pagina} tamanho={extrato.tamanho} total={extrato.total} />
    </Panel>
  );
}
