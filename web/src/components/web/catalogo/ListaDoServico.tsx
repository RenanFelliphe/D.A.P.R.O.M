import { Badge } from "@/components/ui/Badge";
import { porCategoria, quantidadeDoItem, tituloDaCategoria, type MaterialDoServico } from "@/lib/catalogo";

/**
 * O que um serviço usa, agrupado em materiais, ferramentas e EPIs, com a quantidade prevista por execução e a
 * observação de cada item. Serve ao catálogo e ao detalhe da OS.
 */
export function ListaDoServico({ materiais }: { materiais: MaterialDoServico[] }) {
  return (
    <div className="stack g12">
      {porCategoria(materiais).map((grupo) => (
        <div key={grupo.categoria} className="stack g4">
          <span className="small" style={{ fontWeight: 600, color: "var(--ink3)" }}>
            {tituloDaCategoria[grupo.categoria]}
          </span>
          <ul className="lista-material">
            {grupo.itens.map((m) => (
              <li key={m.material_id}>
                <span>
                  {m.descricao}
                  {m.codigo && <span className="small mono"> · {m.codigo}</span>}
                  {!m.ativo && (
                    <>
                      {" "}
                      <Badge tone="neu" style={{ padding: "0 7px", fontSize: 11 }}>
                        Desativado
                      </Badge>
                    </>
                  )}
                </span>
                <span className="lm-qtd">{quantidadeDoItem(m)}</span>
                {m.observacao && <span className="small lm-obs">{m.observacao}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
