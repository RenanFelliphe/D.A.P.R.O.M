import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { rotas } from "@/lib/rotas";

interface QuadroCabecalhoProps {
  /** Equipe, período e hora da consulta, já montados. */
  subtitulo: string;
  /** Só analista e admin importam planilha do SAP. */
  podeImportar: boolean;
}

/** Título do quadro e o atalho para importar a planilha do SAP. */
export function QuadroCabecalho({ subtitulo, podeImportar }: QuadroCabecalhoProps) {
  return (
    <div className="row between wrap" style={{ alignItems: "flex-end" }}>
      <div className="stack" style={{ gap: 2 }}>
        <h1>Quadro de OS</h1>
        <span className="muted" style={{ fontSize: 14 }}>
          {subtitulo}
        </span>
      </div>
      {podeImportar && (
        <div className="row g8">
          <Link className="btn btn-p btn-sm" href={rotas.web.importacao}>
            <Icon name="upload" size={16} />
            Importar planilha do SAP
          </Link>
        </div>
      )}
    </div>
  );
}
