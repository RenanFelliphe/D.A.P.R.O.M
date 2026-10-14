import { ImagemArquivo } from "@/components/ui/ImagemArquivo";
import { faltouComprovar, rotuloDaCategoria, type MaterialDaApr } from "@/lib/catalogo";
import { hora } from "@/lib/formatar";

/** O que o item mostra do que o técnico respondeu. */
function situacaoDoItem(m: MaterialDaApr) {
  if (!m.levou) return { texto: "Não levou", cor: m.obrigatorio ? "var(--blq)" : "var(--ink3)" };
  if (m.obrigatorio && !m.foto) return { texto: "Levou, sem foto", cor: "var(--blq)" };
  return { texto: "Levou", cor: "var(--enc)" };
}

/**
 * A conferência dos materiais do serviço numa APR já registrada: o que o técnico disse que levou e a foto do item
 * obrigatório. O obrigatório sem comprovação (não levado, ou levado sem a foto) é o que bloqueou a APR e vem em destaque.
 * Serve ao técnico (APR bloqueada), ao histórico da OS e ao alerta do supervisor.
 */
export function MateriaisDaApr({ materiais }: { materiais: MaterialDaApr[] }) {
  if (materiais.length === 0) return null;
  const faltando = materiais.filter(faltouComprovar);
  const levados = materiais.filter((m) => m.levou).length;

  return (
    <div className="stack g8" data-treino="apr-materiais">
      {faltando.length > 0 && (
        <div className="stack g6" style={{ padding: "10px 12px", borderRadius: 10, background: "#fff", border: "1px solid #F0C9C3" }}>
          <b style={{ fontSize: 13.5 }}>{faltando.length === 1 ? "Material obrigatório sem comprovação" : "Materiais obrigatórios sem comprovação"}</b>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5 }}>
            {faltando.map((m) => (
              <li key={m.material_id}>
                {m.descricao} · <b style={{ color: "var(--blq)" }}>{m.levou ? "levou, mas sem a foto do item" : "não levou"}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
      <details>
        <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: "var(--brand)" }}>
          Materiais do serviço · {levados} de {materiais.length} levados
        </summary>
        <ul className="stack g8" style={{ margin: "10px 0 0", padding: 0, listStyle: "none" }}>
          {materiais.map((m) => {
            const situacao = situacaoDoItem(m);
            return (
              <li key={m.material_id} className="row g12" style={{ alignItems: "center", fontSize: 13.5 }}>
                {m.foto ? (
                  <ImagemArquivo
                    id={m.foto.foto_path}
                    alt={`Foto de ${m.descricao} às ${hora(m.foto.capturada_em)}`}
                    style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, background: "#CED6D8", display: "block", flex: "none" }}
                  />
                ) : null}
                <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                  <span>
                    {m.descricao}
                    {m.obrigatorio && <span className="small"> · obrigatório</span>}
                  </span>
                  <span className="small">
                    {rotuloDaCategoria[m.categoria]} · <b style={{ color: situacao.cor }}>{situacao.texto}</b>
                    {m.foto ? ` · foto às ${hora(m.foto.capturada_em)}` : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
}
