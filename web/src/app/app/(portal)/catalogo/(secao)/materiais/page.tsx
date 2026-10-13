import type { Metadata } from "next";
import { Panel, TableWrap } from "@/components/web/Panel";
import { PaginacaoLista } from "@/components/web/PaginacaoLista";
import { LinhaMaterial } from "@/components/web/catalogo/LinhaMaterial";
import { NovoMaterial } from "@/components/web/catalogo/NovoMaterial";
import { editaCatalogo } from "@/components/web/catalogo/secao";
import { api, usuarioAtual } from "@/lib/api";
import { CATEGORIAS, UNIDADES_SUGERIDAS, rotuloDaCategoria, type CategoriaMaterial, type ListaDeMateriais } from "@/lib/catalogo";
import { rotas } from "@/lib/rotas";

export const metadata: Metadata = { title: "Materiais do catálogo" };

const um = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);
const TAMANHO = 50;

/**
 * Aba Materiais: o cadastro de materiais, ferramentas e EPIs que os serviços usam. Filtros: busca (descrição ou código do
 * SAP), categoria e situação. O admin cadastra, edita, desativa e exclui o que nenhum serviço usa.
 */
export default async function MateriaisDoCatalogoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { usuario } = await usuarioAtual();
  const podeEditar = editaCatalogo(usuario);
  const busca = um(params.busca)?.trim() || undefined;
  const categoriaPedida = um(params.categoria);
  const categoria = CATEGORIAS.includes(categoriaPedida as CategoriaMaterial) ? (categoriaPedida as CategoriaMaterial) : undefined;
  const situacao = um(params.situacao) === "ativos" || um(params.situacao) === "desativados" ? um(params.situacao) : undefined;
  const pagina = Math.max(1, Number.parseInt(um(params.pagina) ?? "1", 10) || 1);

  const lista = await api<ListaDeMateriais>("/catalogo/materiais", {
    consulta: { busca, categoria, ativo: situacao === "ativos" ? true : situacao === "desativados" ? false : undefined, pagina, tamanho: TAMANHO },
  });
  const consulta = { busca, categoria, situacao };
  const colunas = podeEditar ? 6 : 5;

  return (
    <div className="stack g16">
      <span className="muted" style={{ fontSize: 14, maxWidth: 820 }}>
        Materiais, ferramentas e EPIs que os serviços usam. Desativar tira o item das escolhas de novos serviços sem apagá-lo dos que já o listam.
      </span>
      <div className="row between wrap" style={{ alignItems: "flex-end", gap: 12 }}>
        <form method="get" action={rotas.app.catalogoMateriais} className="filtros-lista">
          <div className="field">
            <label htmlFor="busca-material">Buscar</label>
            <input id="busca-material" name="busca" className="input" defaultValue={busca} placeholder="Descrição ou código do SAP" />
          </div>
          <div className="field">
            <label htmlFor="categoria-material">Categoria</label>
            <select id="categoria-material" name="categoria" className="select" defaultValue={categoria ?? ""}>
              <option value="">Todas</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {rotuloDaCategoria[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="situacao-material">Situação</label>
            <select id="situacao-material" name="situacao" className="select" defaultValue={situacao ?? ""}>
              <option value="">Todos</option>
              <option value="ativos">Ativos</option>
              <option value="desativados">Desativados</option>
            </select>
          </div>
          <button type="submit" className="btn btn-line btn-sm" style={{ height: 36 }}>
            Filtrar
          </button>
        </form>
        {podeEditar && <NovoMaterial />}
      </div>
      <datalist id="unidades-material">
        {UNIDADES_SUGERIDAS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <Panel style={{ gap: 12 }}>
        <TableWrap>
          <table className="tb">
            <caption className="sr">Materiais, ferramentas e EPIs do catálogo</caption>
            <thead>
              <tr>
                <th>Descrição</th>
                <th style={{ width: 130 }}>Categoria</th>
                <th style={{ width: 90 }}>Unidade</th>
                <th style={{ width: 130 }}>Código SAP</th>
                <th style={{ width: 110 }}>Usado em</th>
                {podeEditar && <th style={{ width: 230 }} />}
              </tr>
            </thead>
            <tbody>
              {lista.materiais.length === 0 ? (
                <tr>
                  <td colSpan={colunas} className="muted">
                    {busca || categoria || situacao ? "Nenhum material com esses filtros." : "Nenhum material cadastrado ainda."}
                  </td>
                </tr>
              ) : (
                lista.materiais.map((m) => <LinhaMaterial key={m.id} material={m} podeEditar={podeEditar} />)
              )}
            </tbody>
          </table>
        </TableWrap>
        <PaginacaoLista caminho={rotas.app.catalogoMateriais} consulta={consulta} pagina={lista.pagina} tamanho={lista.tamanho} total={lista.total} />
      </Panel>
    </div>
  );
}
