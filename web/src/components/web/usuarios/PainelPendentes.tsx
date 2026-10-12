import Link from "next/link";
import { Panel, TableWrap } from "@/components/web/Panel";
import { rotas } from "@/lib/rotas";
import { dataHora } from "@/lib/formatar";
import type { Equipe, Usuario } from "@/lib/tipos";
import { BotoesLiberacao } from "./liberacao";

interface PainelPendentesProps {
  pendentes: Usuario[];
  total: number;
  equipes: Pick<Equipe, "id" | "nome">[];
  /** Nome de quem cadastrou (supervisor ou admin), pelo `criado_por_id`. */
  nomes: Map<string, string>;
}

/** Destaque no topo da tela do admin: cadastros feitos por supervisores que esperam a liberação, com quem criou e quando. */
export function PainelPendentes({ pendentes, total, equipes, nomes }: PainelPendentesProps) {
  if (total === 0) return null;
  const nomeDaEquipe = new Map(equipes.map((e) => [e.id, e.nome]));
  return (
    <Panel className="painel-pendentes">
      <div className="stack g4">
        <h2 id="pendentes-titulo">{`Pendentes de liberação · ${total}`}</h2>
        <span className="small">Estas pessoas já entram e fazem o campo de treino, mas só ganham o acesso geral quando você liberar. Recusar exige um motivo.</span>
      </div>
      <TableWrap>
        <table className="tb" aria-labelledby="pendentes-titulo">
          <thead>
            <tr>
              <th>Nome</th>
              <th style={{ width: 90 }}>Matrícula</th>
              <th>Equipe</th>
              <th>Cadastrado por</th>
              <th style={{ width: 190 }} />
            </tr>
          </thead>
          <tbody>
            {pendentes.map((u) => {
              const criador = u.criado_por_nome ?? (u.criado_por_id ? nomes.get(u.criado_por_id) : undefined);
              return (
                <tr key={u.id}>
                  <td>
                    <span style={{ fontWeight: 600 }}>{u.nome}</span>
                    {u.email && <div className="small">{u.email}</div>}
                  </td>
                  <td className="mono">{u.matricula}</td>
                  <td>{u.equipe_id && nomeDaEquipe.has(u.equipe_id) ? <Link href={rotas.web.equipe(u.equipe_id)}>{nomeDaEquipe.get(u.equipe_id)}</Link> : "—"}</td>
                  <td>
                    {criador ?? "—"}
                    {u.criado_em && <div className="small">{dataHora(u.criado_em)}</div>}
                  </td>
                  <td className="acoes-linha">
                    <BotoesLiberacao usuario={u} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
      {total > pendentes.length && (
        <p className="small">
          {`Mostrando ${pendentes.length} de ${total}. `}
          <Link href={`${rotas.web.usuarios}?liberacao=pendente`}>Ver todos os pendentes</Link>
        </p>
      )}
    </Panel>
  );
}
