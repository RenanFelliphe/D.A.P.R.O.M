import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Panel, TableWrap } from "@/components/web/Panel";
import { PaginacaoLista } from "@/components/web/PaginacaoLista";
import { entidadesDaAuditoria, rotuloDaEntidade, type RegistroDeAuditoria } from "@/data/auditoria";
import { dataHora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { DetalhesDoRegistro } from "./DetalhesDoRegistro";

export interface FiltrosAuditoria {
  busca?: string;
  entidade?: string;
  de?: string;
  ate?: string;
}

/** Para onde o alvo do registro leva, quando ainda existe uma tela dele. */
function enderecoDoAlvo(r: RegistroDeAuditoria): string | null {
  if (!r.entidade_id || r.acao.endsWith(".excluir")) return null;
  switch (r.entidade) {
    case "usuario":
      return rotas.app.perfilDe(r.entidade_id);
    case "equipe":
      return rotas.app.equipe(r.entidade_id);
    case "os":
      return r.acao.includes("local_critico") ? null : rotas.app.os(r.entidade_id);
    case "modelo_apr":
      return rotas.web.modelo(r.entidade_id);
    case "material":
      return r.alvo ? `${rotas.app.catalogoMateriais}?busca=${encodeURIComponent(r.alvo)}` : rotas.app.catalogoMateriais;
    case "atividade":
      // A troca da lista de materiais leva ao serviço no catálogo; as demais ações da atividade não têm tela própria.
      return r.acao === "atividade.materiais" ? `${rotas.app.catalogo}?busca=${encodeURIComponent(r.entidade_id)}` : null;
    case "plano_preventiva":
      return rotas.app.preventivas;
    default:
      return null;
  }
}

interface TabelaAuditoriaProps {
  registros: RegistroDeAuditoria[];
  filtros: FiltrosAuditoria;
  pagina: number;
  tamanho: number;
  total: number;
}

/** Painel da trilha de auditoria: filtros (texto, tipo e período) e a tabela, do registro mais novo ao mais antigo. */
export function TabelaAuditoria({ registros, filtros, pagina, tamanho, total }: TabelaAuditoriaProps) {
  return (
    <Panel>
      <h2>{`Registros · ${total}`}</h2>
      <form method="get" action={rotas.web.auditoria} className="filtros-lista">
        <div className="field">
          <label htmlFor="f-busca">Busca</label>
          <input id="f-busca" name="busca" type="search" className="input" placeholder="Quem, o quê ou em quê" defaultValue={filtros.busca ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="f-entidade">Tipo</label>
          <select id="f-entidade" name="entidade" className="select" defaultValue={filtros.entidade ?? ""}>
            <option value="">Todos</option>
            {entidadesDaAuditoria.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-de">De</label>
          <input id="f-de" name="de" type="date" className="input" defaultValue={filtros.de ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="f-ate">Até</label>
          <input id="f-ate" name="ate" type="date" className="input" defaultValue={filtros.ate ?? ""} />
        </div>
        <button type="submit" className="btn btn-line btn-sm" style={{ height: 36 }}>
          Filtrar
        </button>
      </form>
      <TableWrap>
        <table className="tb">
          <caption className="sr">Trilha de auditoria das ações de gestão</caption>
          <thead>
            <tr>
              <th style={{ width: 150 }}>Quando</th>
              <th style={{ width: 170 }}>Quem</th>
              <th style={{ width: 140 }}>Tipo</th>
              <th>O que foi feito</th>
              <th style={{ width: 130 }}>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {registros.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              registros.map((r) => {
                const alvo = enderecoDoAlvo(r);
                return (
                  <tr key={r.id}>
                    <td>{dataHora(r.em)}</td>
                    <td>
                      <Link href={rotas.app.perfilDe(r.ator_id)}>{r.ator_nome}</Link>
                    </td>
                    <td>
                      <Badge tone="neu">{rotuloDaEntidade[r.entidade]}</Badge>
                    </td>
                    <td>
                      {r.resumo}
                      {alvo && (
                        <div className="small">
                          <Link href={alvo}>Abrir {r.alvo ?? "registro"}</Link>
                        </div>
                      )}
                    </td>
                    <td>
                      <DetalhesDoRegistro detalhes={r.detalhes} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </TableWrap>
      <PaginacaoLista caminho={rotas.web.auditoria} consulta={{ ...filtros }} pagina={pagina} tamanho={tamanho} total={total} />
    </Panel>
  );
}
