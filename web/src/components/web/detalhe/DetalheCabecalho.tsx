import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { aparenciaDoStatus } from "@/components/web/quadro/ColunaQuadro";
import type { OsDetalhe } from "@/data/detalhe";
import { rotas } from "@/lib/rotas";
import { rotuloDoStatus } from "@/lib/tipos";

/** Trilha, identificação da OS (número, status, tipo, criticidade, atraso) e o atalho para o PDF. */
export function DetalheCabecalho({ os }: { os: OsDetalhe }) {
  const numero = os.numero_ordem ?? "sem número";
  const a = aparenciaDoStatus[os.status];
  return (
    <>
      <div className="crumb">
        <Link href={rotas.web.quadro} style={{ fontWeight: 500 }}>
          Quadro de OS
        </Link>{" "}
        / <span className="mono">OS {numero}</span>
      </div>
      <div className="row between wrap" style={{ alignItems: "flex-end" }}>
        <div className="stack g6">
          <div className="row wrap g8">
            <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
              OS {numero}
            </span>
            <Badge tone={a.tom}>
              {os.status === "encerrada" && <Icon name="check" size={13} />}
              {rotuloDoStatus[os.status]}
            </Badge>
            <Badge tone="neu">
              {os.tipo === "preventiva" ? "Preventiva" : "Corretiva"}
              {os.tipo_atividade ? ` · ${os.tipo_atividade}` : ""}
            </Badge>
            {os.origem === "manual" && <Badge tone="neu">OS manual</Badge>}
            {os.local_instalacao.critico && <Badge tone="crit">Local crítico</Badge>}
            {os.atrasada && <Badge tone="blq">Atrasada</Badge>}
          </div>
          <h1>{os.titulo}</h1>
          <span className="muted" style={{ fontSize: 14 }}>
            {os.local_instalacao.codigo}
            {os.local_instalacao.endereco ? ` — ${os.local_instalacao.endereco}` : ""} · {os.equipe.nome}
          </span>
        </div>
        {os.status === "encerrada" && (
          <div className="row g8">
            <Link className="btn btn-p btn-sm" href={rotas.doc.os(os.id)}>
              <Icon name="file" size={16} />
              Ver PDF
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
