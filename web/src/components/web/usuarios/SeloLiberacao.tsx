import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { rotuloDaLiberacao, type Liberacao } from "@/lib/tipos";

const tons: Record<Liberacao, BadgeTone> = { liberado: "enc", pendente: "al", recusado: "blq" };

/** Selo da situação do acesso (Pendente, Liberado ou Recusado); o recusado mostra o motivo embaixo. Sem `liberacao` (API antiga) vale liberado. */
export function SeloLiberacao({ liberacao = "liberado", motivo }: { liberacao?: Liberacao; motivo?: string | null }) {
  return (
    <span className="stack g4" style={{ alignItems: "flex-start" }}>
      <Badge tone={tons[liberacao]} style={{ padding: "1px 8px" }}>
        {rotuloDaLiberacao[liberacao]}
      </Badge>
      {liberacao === "recusado" && motivo && (
        <span className="small" style={{ whiteSpace: "normal", maxWidth: 260 }}>
          Motivo: {motivo}
        </span>
      )}
    </span>
  );
}
