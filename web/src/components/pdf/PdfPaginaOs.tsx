import { Icon } from "@/components/ui/Icon";
import {
  osAssinaturas,
  osAtividadeRealizada,
  osCabecalho,
  osExecucao,
  osFotos,
  osNota,
  osObjetosTecnicos,
  osPlanejamento,
} from "@/data/pdf";
import { PdfAssinatura, PdfCabecalho, PdfCelulas, PdfRodape, PdfSecao } from "./PdfBlocos";
import { PdfFolha } from "./PdfPaginas";

/** Página 2 do PDF: registro da OS no formato de referência do SAP. */
export function PdfPaginaOs() {
  return (
    <PdfFolha pagina={2}>
      <PdfCabecalho subtitulo="Ordem de Manutenção · registro de execução" pagina={2} />
      <PdfSecao titulo="1 · Cabeçalho da ordem">
        <PdfCelulas celulas={osCabecalho} />
      </PdfSecao>
      <PdfSecao titulo="2 · Objetos técnicos">
        <PdfCelulas celulas={osObjetosTecnicos} style={{ gridTemplateColumns: "1fr 1fr" }} />
      </PdfSecao>
      <PdfSecao titulo="3 · Nota de manutenção">
        <div className="cell" style={{ border: "1px solid var(--line3)" }}>
          <span>{osNota.rotulo}</span>
          <span style={{ fontSize: 11.5, color: "var(--ink)", textTransform: "none", letterSpacing: 0 }}>{osNota.texto}</span>
        </div>
      </PdfSecao>
      <PdfSecao titulo="4 · Planejamento">
        <PdfCelulas celulas={osPlanejamento} />
      </PdfSecao>
      <PdfSecao titulo="5 · Execução">
        <PdfCelulas celulas={osExecucao}>
          <div className="cell" style={{ gridColumn: "span 2" }}>
            <span>Atividade realizada</span>
            <b style={{ fontWeight: 400 }}>{osAtividadeRealizada}</b>
          </div>
        </PdfCelulas>
      </PdfSecao>
      <PdfSecao titulo="6 · Assinaturas">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {osAssinaturas.map((assinatura) => (
            <PdfAssinatura key={assinatura.titulo} {...assinatura} />
          ))}
        </div>
      </PdfSecao>
      <PdfSecao titulo="7 · Evidências fotográficas">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          {osFotos.map((legenda) => (
            <figure key={legenda} className="stack g4" style={{ margin: 0 }}>
              <div className="ph" style={{ height: 64 }}>
                <Icon name="image" size={22} />
              </div>
              <figcaption style={{ fontSize: 10, color: "var(--ink3)" }}>{legenda}</figcaption>
            </figure>
          ))}
        </div>
      </PdfSecao>
      <PdfRodape />
    </PdfFolha>
  );
}
