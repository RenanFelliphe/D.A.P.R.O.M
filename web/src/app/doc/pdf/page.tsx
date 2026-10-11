import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/app/AppChrome";
import { PdfPaginaApr } from "@/components/pdf/PdfPaginaApr";
import { PdfPaginaOs } from "@/components/pdf/PdfPaginaOs";
import { PdfAbas, PdfPaginasProvider } from "@/components/pdf/PdfPaginas";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { rotas } from "@/lib/telas";

export const metadata: Metadata = { title: "PDF da OS executada" };

export default function PdfPage() {
  return (
    <Screen>
      <CabecalhoPagina
        trilha={[
          { rotulo: "Quadro de OS", href: rotas.web.quadro },
          { rotulo: <span className="mono">OS 4031187</span>, href: rotas.web.detalhe },
          { rotulo: "PDF" },
        ]}
        acoes={
          <Button variant="p" sm aviso="Baixaria o PDF da OS 4031187.">
            <Icon name="download" size={16} />
            Baixar PDF
          </Button>
        }
      >
        <h1>PDF da OS executada</h1>
        <span className="muted">Documento de 2 páginas · gerado em 13/10/2026 às 12:41</span>
      </CabecalhoPagina>
      <PdfPaginasProvider>
        <div className="pdf-view">
          <PdfAbas />
          <PdfPaginaApr />
          <PdfPaginaOs />
        </div>
      </PdfPaginasProvider>
    </Screen>
  );
}
