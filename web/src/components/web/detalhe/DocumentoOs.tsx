import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/web/Panel";
import type { OsDetalhe } from "@/data/detalhe";
import { dataHora } from "@/lib/formatar";
import { rotas, urlDoPdf, urlDoRelatorio } from "@/lib/rotas";

/**
 * Painel lateral com o PDF da OS: pronto (abrir e baixar), pendente ou ainda indisponível. O PDF (a APR e a folha do SAP, como o
 * papel) só existe depois da assinatura final do supervisor; antes disso, quem pode vê o relatório da execução, que é o que o
 * supervisor lê para assinar.
 */
export function DocumentoOs({ os, podeVerRelatorio }: { os: OsDetalhe; podeVerRelatorio: boolean }) {
  const nome = `OS-${os.numero_ordem ?? os.id.slice(0, 8)}.pdf`;
  const relatorio = podeVerRelatorio && (
    <div className="stack g8">
      <span className="small" style={{ color: "var(--ink4)" }}>
        Relatório da execução (tempos, pausas, localização, fotos e assinaturas da APR)
      </span>
      <div className="row g8">
        <Link className="btn btn-line btn-sm" href={`${rotas.app.os(os.id)}?aba=relatorio`} style={{ flex: 1 }}>
          Ver na tela
        </Link>
        <a className="btn btn-line btn-sm" href={urlDoRelatorio(os.id)} target="_blank" rel="noreferrer" style={{ flex: 1 }}>
          Abrir o PDF
        </a>
      </div>
    </div>
  );
  return (
    <Panel>
      <h2>Documento</h2>
      {os.status !== "encerrada" ? (
        <>
          <p className="muted">
            {os.status === "aguardando_supervisor"
              ? "O PDF da OS (a APR e a folha do SAP) é gerado depois da assinatura final do supervisor. Por enquanto, leia o relatório da execução."
              : "O PDF da OS (a APR e a folha do SAP) fica disponível depois da assinatura final do supervisor, quando a OS é concluída."}
          </p>
          {relatorio}
        </>
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
          {relatorio}
        </>
      )}
    </Panel>
  );
}
