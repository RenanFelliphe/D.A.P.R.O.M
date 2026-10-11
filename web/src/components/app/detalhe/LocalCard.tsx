import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/** Card com o endereço do local da OS e o botão "Mapa". */
export function LocalCard() {
  return (
    <div className="card row" style={{ alignItems: "flex-start", gap: 12 }}>
      <Icon name="pin" size={22} style={{ color: "var(--brand)", marginTop: 2 }} />
      <div className="grow stack" style={{ gap: 2 }}>
        <strong>ERP Serra — Estação de Redução Primária</strong>
        <span style={{ fontSize: 14, color: "var(--ink3)" }}>Rod. BR-101, km 262 — Serra/ES</span>
        <span className="mono small">Plus code M4R7+QG Serra</span>
      </div>
      <Button variant="line" sm aviso="Abriria o mapa com a rota até o local." style={{ color: "var(--brand)" }}>
        Mapa
      </Button>
    </div>
  );
}
