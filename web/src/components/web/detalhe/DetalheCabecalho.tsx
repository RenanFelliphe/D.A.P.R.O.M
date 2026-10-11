import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { rotas } from "@/lib/telas";

/** Breadcrumb, identificação da OS e ações de histórico e PDF. */
export function DetalheCabecalho() {
  return (
    <>
      <div className="crumb">
        <Link href={rotas.web.quadro} style={{ fontWeight: 500 }}>
          Quadro de OS
        </Link>{" "}
        / <span className="mono">OS 4031187</span>
      </div>
      <div className="row between wrap" style={{ alignItems: "flex-end" }}>
        <div className="stack g6">
          <div className="row wrap g8">
            <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
              OS 4031187
            </span>
            <Badge tone="enc">
              <Icon name="check" size={13} />
              Encerrada
            </Badge>
            <Badge tone="neu">Preventiva · YBA2</Badge>
            <Badge tone="crit">Local crítico</Badge>
          </div>
          <h1>Inspeção de corrosão em válvulas da ERP</h1>
          <span className="muted" style={{ fontSize: 14 }}>
            ERP Serra — Rod. BR-101, km 262, Serra/ES · Serviços Especiais
          </span>
        </div>
        <div className="row g8">
          <Button variant="line" sm aviso="Mostraria as execuções anteriores deste local e equipamento.">
            Histórico do local
          </Button>
          <LinkButton variant="p" sm href={rotas.doc.pdf}>
            <Icon name="download" size={16} />
            Ver PDF
          </LinkButton>
        </div>
      </div>
    </>
  );
}
