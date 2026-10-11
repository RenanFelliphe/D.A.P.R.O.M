import { Panel } from "@/components/web/Panel";
import { equipes } from "@/data/usuarios";

/** Equipes cadastradas, com centro de trabalho, técnicos e supervisor. */
export function ListaEquipes() {
  return (
    <Panel>
      <h2>Equipes</h2>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {equipes.map((e) => (
          <li key={e.centro} className="stack" style={{ lineHeight: 1.35, paddingBottom: 8, borderBottom: "1px solid var(--line2)" }}>
            <div className="row between">
              <strong style={{ fontSize: 14 }}>{e.nome}</strong>
              <span className="mono small">{e.centro}</span>
            </div>
            <span className="small">{`${e.tecnicos} técnicos · ${e.supervisor ?? "Sem supervisor"}`}</span>
          </li>
        ))}
      </ul>
      <p className="small">
        O centro de trabalho da OS no SAP define a equipe. Os técnicos da equipe aparecem como participantes da APR.
      </p>
    </Panel>
  );
}
