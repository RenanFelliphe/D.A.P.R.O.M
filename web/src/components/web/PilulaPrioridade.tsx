import { Badge, type BadgeTone } from "@/components/ui/Badge";

/** Cor da pílula pela prioridade do SAP: muito alto em vermelho, alto em âmbar, o resto neutro. */
function tomDaPrioridade(prioridade: string): BadgeTone {
  const p = prioridade.trim().toLowerCase();
  if (p === "muito alto") return "blq";
  if (p === "alto") return "al";
  return "neu";
}

/** Pílula da prioridade da OS (vinda do SAP). `compacta` serve aos cartões do quadro. Sem prioridade, não aparece. */
export function PilulaPrioridade({ prioridade, compacta }: { prioridade: string | null; compacta?: boolean }) {
  if (!prioridade) return null;
  return (
    <Badge tone={tomDaPrioridade(prioridade)} style={compacta ? { padding: "0 7px", fontSize: 11 } : undefined}>
      {compacta ? prioridade : `Prioridade: ${prioridade}`}
    </Badge>
  );
}
