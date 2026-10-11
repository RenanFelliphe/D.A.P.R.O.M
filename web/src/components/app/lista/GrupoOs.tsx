import { Badge } from "@/components/ui/Badge";
import type { GrupoOsApp } from "@/data/os-app";
import { OsCard } from "./OsCard";

/** Grupo de OS de um mesmo local/cliente, com cabeçalho e cards em grade. */
export function GrupoOs({ grupo }: { grupo: GrupoOsApp }) {
  return (
    <section className="stack g12">
      <div className="group-h">
        <div className="row">
          <h2>{grupo.nome}</h2>
          {grupo.criticidade && <Badge tone="crit">{grupo.criticidade}</Badge>}
        </div>
        <span className="mono small">{grupo.resumo}</span>
      </div>
      <div className="os-grid">
        {grupo.os.map((os) => (
          <OsCard key={os.numero} os={os} />
        ))}
      </div>
    </section>
  );
}
