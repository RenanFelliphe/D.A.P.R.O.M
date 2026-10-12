import Link from "next/link";
import { Panel } from "@/components/web/Panel";
import type { EquipeComTecnicos } from "@/data/usuarios";
import { rotas } from "@/lib/rotas";
import { BotaoEquipe } from "./BotaoEquipe";
import type { OpcaoSupervisor } from "./FormularioEquipe";

interface ListaEquipesProps {
  equipes: EquipeComTecnicos[];
  /** Usuários ativos de perfil supervisor (candidatos a supervisor de equipe). */
  supervisores: OpcaoSupervisor[];
}

/** Equipes cadastradas, com centro de trabalho, técnicos e supervisor; criar e editar pelo administrador. */
export function ListaEquipes({ equipes, supervisores }: ListaEquipesProps) {
  const nomeDoSupervisor = new Map(supervisores.map((s) => [s.id, s.nome]));
  return (
    <Panel>
      <div className="row between">
        <h2>{`Equipes · ${equipes.length}`}</h2>
        <BotaoEquipe supervisores={supervisores} />
      </div>
      {equipes.length === 0 ? (
        <p className="muted">Nenhuma equipe cadastrada.</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {equipes.map((e) => (
            <li key={e.id} className="stack" style={{ lineHeight: 1.35, paddingBottom: 8, borderBottom: "1px solid var(--line2)" }}>
              <div className="row between">
                <Link href={rotas.web.equipe(e.id)} style={{ fontSize: 14, fontWeight: 600 }}>
                  {e.nome}
                </Link>
                <span className="mono small">{e.centro_trabalho}</span>
              </div>
              <div className="row between">
                <span className="small">
                  <Link href={`${rotas.web.usuarios}?equipe_id=${e.id}`}>{`${e.tecnicos} ${e.tecnicos === 1 ? "técnico" : "técnicos"}`}</Link>
                  {` · ${e.supervisor_id ? (nomeDoSupervisor.get(e.supervisor_id) ?? "Supervisor inativo") : "Sem supervisor"}`}
                </span>
                <BotaoEquipe supervisores={supervisores} equipe={e} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="small">
        O centro de trabalho da OS no SAP define a equipe. Os técnicos da equipe aparecem como participantes da APR. Equipe sem supervisor manda os alertas aos analistas.
      </p>
    </Panel>
  );
}
