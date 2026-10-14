import { Notice } from "@/components/ui/Notice";
import { Panel, TableWrap } from "@/components/web/Panel";
import { PaginacaoLista } from "@/components/web/PaginacaoLista";
import type { Atividade } from "@/data/modelos";
import { rotas } from "@/lib/rotas";
import { LinhaAtividade } from "./LinhaAtividade";
import { NovaAtividade } from "./NovaAtividade";

interface TabelaAtividadesProps {
  atividades: Atividade[];
  pagina: number;
  tamanho: number;
  total: number;
  busca?: string;
  podeEditar: boolean;
}

/** Tabela das atividades (código do plano do SAP e descrição do serviço do catálogo), com busca e edição. */
export function TabelaAtividades({ atividades, pagina, tamanho, total, busca, podeEditar }: TabelaAtividadesProps) {
  const consulta = { busca };
  return (
    <div className="stack g16">
      <Notice tone="al" icon="info">
        Os códigos da carga inicial são provisórios até a Segurança do Trabalho validar: o plano de manutenção está em revisão e os códigos vão mudar.
      </Notice>
      <div className="row between wrap" style={{ alignItems: "flex-end" }}>
        <form method="get" action={rotas.web.atividades} className="filtros-lista">
          <div className="field">
            <label htmlFor="busca-atividade">Buscar</label>
            <input id="busca-atividade" name="busca" className="input" defaultValue={busca} placeholder="Código ou descrição" />
          </div>
          <button type="submit" className="btn btn-line btn-sm" style={{ height: 36 }}>
            Filtrar
          </button>
        </form>
        {podeEditar && <NovaAtividade />}
      </div>
      <Panel style={{ gap: 12 }}>
        <TableWrap>
          <table className="tb">
            <caption className="sr">Atividades do plano de manutenção</caption>
            <thead>
              <tr>
                <th style={{ width: 200 }}>Código do plano</th>
                <th>Descrição</th>
                {podeEditar && <th style={{ width: 170 }} />}
              </tr>
            </thead>
            <tbody>
              {atividades.length === 0 ? (
                <tr>
                  <td colSpan={podeEditar ? 3 : 2} className="muted">
                    Nenhuma atividade encontrada.
                  </td>
                </tr>
              ) : (
                atividades.map((a) => <LinhaAtividade key={a.codigo} atividade={a} podeEditar={podeEditar} />)
              )}
            </tbody>
          </table>
        </TableWrap>
        <PaginacaoLista caminho={rotas.web.atividades} consulta={consulta} pagina={pagina} tamanho={tamanho} total={total} />
      </Panel>
    </div>
  );
}
