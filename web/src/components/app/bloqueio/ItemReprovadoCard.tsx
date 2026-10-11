import { Badge } from "@/components/ui/Badge";
import type { ItemReprovado } from "@/data/bloqueio";

/** Card de um item eliminatório reprovado, com a resposta e a evidência. */
export function ItemReprovadoCard({ item }: { item: ItemReprovado }) {
  return (
    <div className="card stack g6">
      <span className="mono small">{item.label}</span>
      <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{item.pergunta}</p>
      <div className="row between wrap">
        <Badge tone="dark" style={{ background: "var(--blq)" }}>
          {item.resposta}
        </Badge>
        <span className="small">{item.comFoto ? "Evidência: observação e foto" : "Evidência: observação"}</span>
      </div>
      <p className="muted" style={{ fontSize: 13.5 }}>
        “{item.observacao}”
      </p>
    </div>
  );
}
