import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/web/Panel";
import { rotas } from "@/lib/telas";

/** Situação da baixa da OS no SAP. */
export function BaixaSap() {
  return (
    <Panel style={{ gap: 8 }}>
      <h2>Baixa no SAP</h2>
      <Badge tone="neu" style={{ alignSelf: "flex-start", fontWeight: 600 }}>
        Ainda não exportada
      </Badge>
      <p className="muted">Entra na próxima planilha de OS encerradas, com o link deste PDF.</p>
      <Link href={rotas.web.indicadores} style={{ fontSize: 13.5, fontWeight: 600 }}>
        Ir para exportação
      </Link>
    </Panel>
  );
}
