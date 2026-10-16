import { Badge } from "@/components/ui/Badge";
import type { AusenciaDaPessoa } from "@/lib/ausencia";

/**
 * Selo das listas de pessoas: "Ausente até 03/11/2026" (em curso) ou "Ausência vencida desde 03/11/2026" (o retorno não foi
 * confirmado). Quem não está ausente não leva selo.
 */
export function SeloDeAusencia({ ausencia, className }: { ausencia?: AusenciaDaPessoa | null; className?: string }) {
  if (!ausencia) return null;
  return (
    <Badge tone={ausencia.situacao === "vencida" ? "blq" : "al"} className={className} style={{ padding: "1px 8px", fontSize: 11 }}>
      {ausencia.rotulo}
    </Badge>
  );
}
