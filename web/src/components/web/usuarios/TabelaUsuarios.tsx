import { LinkAviso } from "@/components/ui/Aviso";
import { Badge } from "@/components/ui/Badge";
import { Panel, TableWrap } from "@/components/web/Panel";
import { usuarios } from "@/data/usuarios";

/** Painel com a tabela de usuários cadastrados. */
export function TabelaUsuarios() {
  return (
    <Panel>
      <h2>Usuários · 52</h2>
      <TableWrap>
        <table className="tb">
          <caption className="sr">Usuários cadastrados</caption>
          <thead>
            <tr>
              <th>Nome</th>
              <th style={{ width: 100 }}>Matrícula</th>
              <th>Perfil</th>
              <th>Equipe</th>
              <th style={{ width: 90 }}>Situação</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.matricula}>
                <td>{u.nome}</td>
                <td className="mono">{u.matricula}</td>
                <td>{u.perfil}</td>
                <td>{u.equipe}</td>
                <td>
                  <Badge tone="enc" style={{ padding: "1px 8px" }}>
                    {u.situacao}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <LinkAviso aviso="Mostraria os 52 usuários." style={{ fontSize: 13.5, fontWeight: 600 }}>
        Mostrar os 52 usuários
      </LinkAviso>
    </Panel>
  );
}
