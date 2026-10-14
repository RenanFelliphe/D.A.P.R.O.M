import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { rotuloDaSituacaoRegistro, type SituacaoRegistro } from "@/lib/tipos";

const tons: Record<Exclude<SituacaoRegistro, "ativo">, BadgeTone> = { afastado: "al", desligado: "blq", fora_do_registro: "blq" };

/**
 * Selo do que o registro de funcionários diz da pessoa: só aparece quando há algo a avisar ("Desligado no registro", "Afastado",
 * "Fora do registro"). Quem está ativo no registro, ou ainda não foi conferido, não leva selo.
 */
export function SeloRegistro({ situacao, className }: { situacao?: SituacaoRegistro | null; className?: string }) {
  if (!situacao || situacao === "ativo") return null;
  return (
    <Badge tone={tons[situacao]} className={className} style={{ padding: "1px 8px", fontSize: 11 }}>
      {rotuloDaSituacaoRegistro[situacao]}
    </Badge>
  );
}
