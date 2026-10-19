import { Badge } from "@/components/ui/Badge";
import { tomDaPrioridade } from "@/lib/os-app";

/** Pílula da prioridade da OS (vinda do SAP). `compacta` serve aos cartões do quadro. Sem prioridade, não aparece. */
export function PilulaPrioridade({ prioridade, compacta }: { prioridade: string | null; compacta?: boolean }) {
  if (!prioridade) return null;
  return (
    <Badge tone={tomDaPrioridade(prioridade)} style={compacta ? { padding: "0 7px", fontSize: 11 } : undefined}>
      {compacta ? prioridade : `Prioridade: ${prioridade}`}
    </Badge>
  );
}
