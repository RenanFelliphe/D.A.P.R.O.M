import { Button, LinkButton } from "@/components/ui/Button";
import { Panel } from "@/components/web/Panel";
import { rotas } from "@/lib/telas";

/** Painel lateral com o PDF gerado da OS. */
export function DocumentoOs() {
  return (
    <Panel>
      <h2>Documento</h2>
      <div
        className="row g12"
        style={{ padding: 12, borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--line2)" }}
      >
        <span
          style={{
            width: 40,
            height: 48,
            flex: "none",
            borderRadius: 6,
            background: "var(--blq)",
            color: "#fff",
            display: "inline-flex",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: 6,
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          PDF
        </span>
        <span className="stack" style={{ lineHeight: 1.3 }}>
          <span className="mono" style={{ fontSize: 13.5, fontWeight: 600 }}>
            OS-4031187.pdf
          </span>
          <span className="small">2 páginas · gerado 13/10 às 12:41</span>
        </span>
      </div>
      <div className="row g8">
        <LinkButton variant="line" sm href={rotas.doc.pdf} style={{ flex: 1 }}>
          Abrir
        </LinkButton>
        <Button variant="line" sm aviso="Baixaria OS-4031187.pdf." style={{ flex: 1 }}>
          Baixar
        </Button>
      </div>
    </Panel>
  );
}
