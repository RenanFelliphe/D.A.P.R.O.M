import { statusDaOs, type OsResumo } from "@/lib/os-app";
import type { OsStatus } from "@/lib/tipos";
import { OsCard } from "./OsCard";

/** Grupo de OS de um mesmo status, com cabeçalho e cards em grade. */
export function GrupoOs({ status, os }: { status: OsStatus; os: OsResumo[] }) {
  return (
    <section className="stack g12">
      <div className="group-h">
        <h2>{statusDaOs[status].rotulo}</h2>
        <span className="mono small">{os.length === 1 ? "1 OS" : `${os.length} OS`}</span>
      </div>
      <div className="os-grid">
        {os.map((o) => (
          <OsCard key={o.id} os={o} />
        ))}
      </div>
    </section>
  );
}
