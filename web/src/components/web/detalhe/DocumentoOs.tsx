import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/web/Panel";
import type { OsDetalhe } from "@/data/detalhe";
import { dataHora } from "@/lib/formatar";
import { rotas, urlDoPdf } from "@/lib/rotas";

/** Painel lateral com o PDF da OS: pronto (abrir e baixar), pendente ou ainda indisponível. */
export function DocumentoOs({ os }: { os: OsDetalhe }) {
  const nome = `OS-${os.numero_ordem ?? os.id.slice(0, 8)}.pdf`;
  return (
    <Panel>
      <h2>Documento</h2>
      {os.status !== "encerrada" ? (
        <p className="muted">O PDF da APR e da OS fica disponível quando a OS for encerrada.</p>
      ) : (
        <>
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
                {nome}
              </span>
              <span className="small">{os.pdf_pronto ? `Gerado em ${dataHora(os.pdf_em)}` : "Ainda não gerado"}</span>
            </span>
          </div>
          {os.pdf_pronto ? (
            <Badge tone="enc" style={{ alignSelf: "flex-start", fontWeight: 600 }}>
              PDF pronto
            </Badge>
          ) : (
            <Badge tone="al" style={{ alignSelf: "flex-start", fontWeight: 600 }}>
              PDF pendente
            </Badge>
          )}
          {!os.pdf_pronto && (
            <p className="muted">A geração roda em segundo plano. Ao abrir, o PDF é gerado na hora se ainda não estiver pronto.</p>
          )}
          <div className="row g8">
            <Link className="btn btn-line btn-sm" href={rotas.doc.os(os.id)} style={{ flex: 1 }}>
              Abrir
            </Link>
            <a className="btn btn-line btn-sm" href={urlDoPdf(os.id)} download={nome} style={{ flex: 1 }}>
              Baixar
            </a>
          </div>
        </>
      )}
    </Panel>
  );
}
