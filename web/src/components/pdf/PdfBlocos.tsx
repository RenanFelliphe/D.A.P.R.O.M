import type { CSSProperties, ReactNode } from "react";
import { Assinatura, type PessoaAssinatura } from "@/components/ui/Assinatura";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import type { CelulaPdf } from "@/data/pdf";

interface PdfCabecalhoProps {
  subtitulo: string;
  pagina: number;
}

/** Cabeçalho do PDF: marca, tipo do documento, nº da OS e página. */
export function PdfCabecalho({ subtitulo, pagina }: PdfCabecalhoProps) {
  return (
    <header className="pdf-h">
      <div className="row g12">
        <span className="logo" style={{ width: 30, height: 30, borderRadius: 7 }}>
          <Icon name="shield" size={16} />
        </span>
        <div className="stack" style={{ lineHeight: 1.25 }}>
          <strong style={{ fontSize: 13, letterSpacing: ".06em" }}>D.A.P.R.O.M</strong>
          <span style={{ fontSize: 12, color: "var(--ink3)" }}>{subtitulo}</span>
        </div>
      </div>
      <div className="stack" style={{ alignItems: "flex-end", lineHeight: 1.2 }}>
        <span className="mono" style={{ fontSize: 20, fontWeight: 600 }}>
          OS 4031187
        </span>
        <span style={{ fontSize: 10.5, color: "var(--ink3)" }}>Página {pagina} de 2</span>
      </div>
    </header>
  );
}

/** Seção numerada com título em faixa (.sec). */
export function PdfSecao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="sec">
      <h2>{titulo}</h2>
      {children}
    </div>
  );
}

interface PdfCelulasProps {
  celulas: CelulaPdf[];
  /** Grade de 3 colunas (.c3) em vez das 4 padrão. */
  tres?: boolean;
  style?: CSSProperties;
  children?: ReactNode;
}

/** Grade de células rótulo/valor (.cells). `children` entra após as células. */
export function PdfCelulas({ celulas, tres, style, children }: PdfCelulasProps) {
  return (
    <div className={cx("cells", tres && "c3")} style={style}>
      {celulas.map((celula) => (
        <div key={celula.rotulo} className="cell">
          <span>{celula.rotulo}</span>
          <b>{celula.valor}</b>
        </div>
      ))}
      {children}
    </div>
  );
}

interface PdfAssinaturaProps {
  pessoa?: PessoaAssinatura;
  titulo: string;
  detalhe: string;
}

/** Caixa de assinatura (.sigb); sem `pessoa`, deixa o espaço em branco. */
export function PdfAssinatura({ pessoa, titulo, detalhe }: PdfAssinaturaProps) {
  return (
    <div className="sigb">
      {pessoa ? <Assinatura pessoa={pessoa} espessura={2} width={170} height={40} /> : <div style={{ height: 40 }}></div>}
      <span style={{ borderTop: "1px solid var(--line3)", paddingTop: 3, fontWeight: 600 }}>{titulo}</span>
      <span style={{ fontSize: 10.5, color: "var(--ink3)" }}>{detalhe}</span>
    </div>
  );
}

/** Rodapé comum às duas páginas. */
export function PdfRodape() {
  return (
    <footer
      className="row between"
      style={{ marginTop: "auto", paddingTop: 8, borderTop: "1px solid var(--line3)", fontSize: 9.5, color: "var(--ink3)" }}
    >
      <span>Gerado automaticamente em 13/10/2026 às 12:41</span>
      <span>Dados fictícios · protótipo</span>
    </footer>
  );
}
