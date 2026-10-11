import { Icon } from "@/components/ui/Icon";
import type { LocalDaOs } from "@/lib/os-app";

/** Card com o local da OS (código, endereço e plus code) e o link "Mapa". */
export function LocalCard({ local }: { local: LocalDaOs }) {
  const consulta = local.plus_code ?? local.endereco ?? local.codigo;
  return (
    <div className="card row" style={{ alignItems: "flex-start", gap: 12 }}>
      <Icon name="pin" size={22} style={{ color: "var(--brand)", marginTop: 2 }} />
      <div className="grow stack" style={{ gap: 2 }}>
        <strong>{local.codigo}</strong>
        {local.cliente && <span style={{ fontSize: 14, color: "var(--ink3)" }}>{local.cliente}</span>}
        {local.endereco && <span style={{ fontSize: 14, color: "var(--ink3)" }}>{local.endereco}</span>}
        {local.plus_code && <span className="mono small">Plus code {local.plus_code}</span>}
      </div>
      <a
        className="btn btn-line btn-sm"
        style={{ color: "var(--brand)" }}
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`}
        target="_blank"
        rel="noreferrer"
      >
        Mapa
      </a>
    </div>
  );
}
