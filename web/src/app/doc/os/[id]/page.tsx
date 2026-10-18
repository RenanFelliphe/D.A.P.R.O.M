import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { carregarDetalhe } from "@/data/detalhe";
import { dataHora } from "@/lib/formatar";
import { rotas, urlDoPdf } from "@/lib/rotas";

export const metadata: Metadata = { title: "PDF da OS executada" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O PDF real da OS, gerado pela `api`, dentro do painel. */
export default async function PdfDaOsPage({ params }: PageProps<"/doc/os/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const detalhe = await carregarDetalhe(id);
  if (!detalhe) notFound();
  const { os } = detalhe;

  const numero = os.numero_ordem ?? "sem número";
  const nome = `OS-${os.numero_ordem ?? os.id.slice(0, 8)}.pdf`;
  const encerrada = os.status === "encerrada";

  return (
    <Screen>
      <nav className="crumb" aria-label="Você está em">
        <Link href={rotas.app.lista} style={{ fontWeight: 500 }}>
          Ordem de Serviço
        </Link>{" "}
        /{" "}
        <Link href={rotas.app.os(os.id)} className="mono" style={{ fontWeight: 500 }}>
          OS {numero}
        </Link>{" "}
        / PDF
      </nav>
      <div className="row between wrap" style={{ alignItems: "flex-end" }}>
        <div className="stack g6">
          <h1>PDF da OS executada</h1>
          <span className="muted">
            OS {numero} · {os.titulo}
            {encerrada && (os.pdf_pronto ? ` · gerado em ${dataHora(os.pdf_em)}` : " · gerado agora, ao abrir")}
          </span>
        </div>
        <div className="row g8">
          <Link className="btn btn-line btn-sm" href={rotas.app.os(os.id)}>
            <Icon name="left" size={16} />
            Voltar ao detalhe
          </Link>
          {encerrada && (
            <a className="btn btn-p btn-sm" href={urlDoPdf(os.id)} download={nome}>
              <Icon name="download" size={16} />
              Baixar
            </a>
          )}
        </div>
      </div>
      {encerrada ? (
        <iframe
          title={`PDF da OS ${numero}`}
          src={urlDoPdf(os.id)}
          style={{ width: "100%", height: "calc(100vh - 230px)", minHeight: 620, border: "1px solid var(--line)", borderRadius: 10, background: "#fff" }}
        />
      ) : (
        <Notice tone="info" icon="info">
          <strong>A OS ainda não foi concluída.</strong> O PDF com a APR e a folha do SAP é gerado depois da assinatura final do supervisor.{" "}
          <Link href={rotas.app.os(os.id)} style={{ fontWeight: 600 }}>
            Voltar ao detalhe
          </Link>
        </Notice>
      )}
    </Screen>
  );
}
