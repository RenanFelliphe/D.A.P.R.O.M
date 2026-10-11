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
  semModelo: boolean;
  /** Códigos de modelo com versão publicada. */
  modelos: string[];
  podeEditar: boolean;
}

/** Tabela "atividade (código do plano do SAP) → modelo de APR", com busca, filtro "sem modelo" e edição pela Segurança. */
export function TabelaAtividades({ atividades, pagina, tamanho, total, busca, semModelo, modelos, podeEditar }: TabelaAtividadesProps) {
  const consulta = { aba: "atividades", busca, sem_modelo: semModelo ? "true" : undefined };
  return (
    <div className="stack g16">
      <Notice tone="al" icon="info">
        Os códigos e o critério de bloqueio da carga inicial são provisórios até a Segurança do Trabalho validar: o plano de manutenção está em revisão e os
        códigos vão mudar. Atividades que o SAP trouxe e ainda não têm modelo aparecem em destaque.
      </Notice>
      <div className="row between wrap" style={{ alignItems: "flex-end" }}>
        <form method="get" action={rotas.web.modelos} className="filtros-lista">
          <input type="hidden" name="aba" value="atividades" />
          <div className="field">
            <label htmlFor="busca-atividade">Buscar</label>
            <input id="busca-atividade" name="busca" className="input" defaultValue={busca} placeholder="Código ou descrição" style={{ width: 240 }} />
          </div>
          <label className="row g6 small" style={{ height: 36 }}>
            <input type="checkbox" name="sem_modelo" value="true" defaultChecked={semModelo} />
            Só sem modelo
          </label>
          <button type="submit" className="btn btn-line btn-sm" style={{ height: 36 }}>
            Filtrar
          </button>
        </form>
        {podeEditar && <NovaAtividade modelos={modelos} />}
      </div>
      <Panel style={{ gap: 12 }}>
        <TableWrap>
          <table className="tb">
            <caption className="sr">Atividades e o modelo de APR de cada uma</caption>
            <thead>
              <tr>
                <th style={{ width: 200 }}>Código do plano</th>
                <th>Descrição</th>
                <th style={{ width: 150 }}>Modelo de APR</th>
                {podeEditar && <th style={{ width: 170 }} />}
              </tr>
            </thead>
            <tbody>
              {atividades.length === 0 ? (
                <tr>
                  <td colSpan={podeEditar ? 4 : 3} className="muted">
                    {semModelo ? "Nenhuma atividade sem modelo." : "Nenhuma atividade encontrada."}
                  </td>
                </tr>
              ) : (
                atividades.map((a) => <LinhaAtividade key={a.codigo} atividade={a} modelos={modelos} podeEditar={podeEditar} />)
              )}
            </tbody>
          </table>
        </TableWrap>
        <PaginacaoLista caminho={rotas.web.modelos} consulta={consulta} pagina={pagina} tamanho={tamanho} total={total} />
      </Panel>
    </div>
  );
}
