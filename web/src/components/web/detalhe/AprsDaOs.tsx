import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/web/Panel";

/** Aviso da primeira APR da OS, bloqueada por impedimento. */
export function AprsDaOs() {
  return (
    <Panel>
      <div className="stack" style={{ gap: 2 }}>
        <h2>APRs desta OS · 2</h2>
        <span className="muted">
          Cada tentativa tem a própria APR. A primeira foi bloqueada e a OS ficou pendente; a segunda foi aprovada.
        </span>
      </div>
      <div
        className="row g12"
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          background: "#FDF3F1",
          border: "1px solid #F0C9C3",
          alignItems: "flex-start",
        }}
      >
        <Badge tone="blq" style={{ flex: "none" }}>
          Bloqueada
        </Badge>
        <span className="stack" style={{ lineHeight: 1.4, flex: 1 }}>
          <strong style={{ fontSize: 14 }}>
            <span className="mono">#A-2198</span> · 12/10 às 14:05 · Paulo Ribeiro (responsável) e Marcelo Dias
          </strong>
          <span style={{ fontSize: 13.5 }}>
            Item 9 · Existe algum impedimento para realizar a atividade? <b>Sim</b> — “Portão da casa de válvulas
            trancado e sem responsável no local.”
          </span>
          <span className="small">Evidência: 1 foto · supervisor avisado às 14:07</span>
        </span>
      </div>
    </Panel>
  );
}
