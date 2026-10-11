import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/web/Panel";
import { atividadesModelo } from "@/data/modelos";

/** Relação entre o tipo de atividade (código do plano) e o modelo de APR. */
export function AtividadeModelo() {
  return (
    <Panel style={{ padding: 16, gap: 10 }}>
      <div className="row between">
        <h2 style={{ fontSize: 15 }}>Tipo de atividade → modelo</h2>
        <Badge tone="neu">Editável</Badge>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8, fontSize: 13.5 }}>
        {atividadesModelo.map((a) => (
          <li key={a.atividade} className="row between g8">
            <span>{a.atividade}</span>
            <b className="mono" style={{ color: "var(--brand)", whiteSpace: "nowrap" }}>
              {a.modelo}
            </b>
          </li>
        ))}
      </ul>
      <p className="small">
        Códigos do plano de manutenção listados nos modelos de APR. O plano está em revisão e os códigos vão mudar.
      </p>
    </Panel>
  );
}
