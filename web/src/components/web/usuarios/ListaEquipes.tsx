import Link from "next/link";
import { Panel } from "@/components/web/Panel";
import type { EquipeComTecnicos } from "@/data/usuarios";
import { rotas } from "@/lib/rotas";
import { BotaoEquipe } from "./BotaoEquipe";
import type { OpcaoSupervisor } from "./FormularioEquipe";

interface ListaEquipesProps {
  equipes: EquipeComTecnicos[];
  /** Usuários ativos (candidatos a supervisor de equipe, de qualquer perfil). */
  supervisores: OpcaoSupervisor[];
  /** Visão do supervisor: só lê as equipes dele, sem criar nem editar. */
  somenteLeitura?: boolean;
  /** Tela que a contagem de técnicos abre filtrada pela equipe (`?equipe_id=`). */
  caminhoUsuarios?: string;
}

/** Equipes cadastradas, com centro de trabalho, técnicos e supervisor; criar e editar pelo administrador. */
export function ListaEquipes({ equipes, supervisores, somenteLeitura = false, caminhoUsuarios = rotas.app.usuarios }: ListaEquipesProps) {
  const nomeDoSupervisor = new Map(supervisores.map((s) => [s.id, s.nome]));
  return (
    <Panel>
      <div className="row between">
        <h2>{`${somenteLeitura ? "Minhas equipes" : "Equipes"} · ${equipes.length}`}</h2>
        {!somenteLeitura && <BotaoEquipe supervisores={supervisores} />}
      </div>
      {equipes.length === 0 ? (
        <p className="muted">Nenhuma equipe cadastrada.</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {equipes.map((e) => (
            <li key={e.id} className="stack" style={{ lineHeight: 1.35, paddingBottom: 8, borderBottom: "1px solid var(--line2)" }}>
              <div className="row between">
                <Link href={rotas.app.equipe(e.id)} style={{ fontSize: 14, fontWeight: 600 }}>
                  {e.nome}
                </Link>
                <span className="mono small">{e.centro_trabalho}</span>
              </div>
              <div className="row between">
                <span className="small">
                  <Link href={`${caminhoUsuarios}?equipe_id=${e.id}`}>{`${e.tecnicos} ${e.tecnicos === 1 ? "técnico" : "técnicos"}`}</Link>
                  {" · "}
                  {e.supervisor_id && nomeDoSupervisor.has(e.supervisor_id) ? (
                    <Link href={rotas.app.perfilDe(e.supervisor_id)}>{nomeDoSupervisor.get(e.supervisor_id)}</Link>
                  ) : e.supervisor_id ? (
                    "Supervisor inativo"
                  ) : (
                    "Sem supervisor"
                  )}
                </span>
                {!somenteLeitura && <BotaoEquipe supervisores={supervisores} equipe={e} />}
              </div>
            </li>
          ))}
        </ul>
      )}
      {somenteLeitura ? (
        <p className="small">A contagem considera só os técnicos ativos com o acesso liberado. Quem foi cadastrado agora aparece na lista de técnicos como pendente.</p>
      ) : (
        <p className="small">
          O centro de trabalho da OS no SAP define a equipe. Os técnicos da equipe aparecem como participantes da APR. Na equipe sem supervisor, o representante responde por ela e recebe os alertas, e os administradores são avisados para escolher um supervisor.
        </p>
      )}
    </Panel>
  );
}
