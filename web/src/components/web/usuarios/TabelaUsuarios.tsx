import { Badge } from "@/components/ui/Badge";
import { Panel, TableWrap } from "@/components/web/Panel";
import { PaginacaoLista } from "@/components/web/PaginacaoLista";
import { ordemDosPerfis } from "@/data/usuarios";
import { rotas } from "@/lib/rotas";
import { rotuloDoPerfil, type Equipe, type Perfil, type Usuario } from "@/lib/tipos";
import { AcoesUsuario } from "./AcoesUsuario";

export interface FiltrosUsuarios {
  equipe_id?: string;
  perfil?: string;
  ativo?: string;
  busca?: string;
}

interface TabelaUsuariosProps {
  usuarios: Usuario[];
  equipes: Pick<Equipe, "id" | "nome">[];
  filtros: FiltrosUsuarios;
  pagina: number;
  tamanho: number;
  total: number;
}

/** Painel com a tabela de usuários (filtros por equipe, perfil e situação) e as ações do administrador em cada linha. */
export function TabelaUsuarios({ usuarios, equipes, filtros, pagina, tamanho, total }: TabelaUsuariosProps) {
  const nomeDaEquipe = new Map(equipes.map((e) => [e.id, e.nome]));
  return (
    <Panel>
      <h2>{`Usuários · ${total}`}</h2>
      <form method="get" action={rotas.web.usuarios} className="filtros-lista">
        <div className="field">
          <label htmlFor="f-busca">Busca</label>
          <input id="f-busca" name="busca" type="search" className="input" placeholder="Nome, matrícula, e-mail, cargo ou CREA" defaultValue={filtros.busca ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="f-equipe">Equipe</label>
          <select id="f-equipe" name="equipe_id" className="select" defaultValue={filtros.equipe_id ?? ""}>
            <option value="">Todas</option>
            {equipes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-perfil">Perfil</label>
          <select id="f-perfil" name="perfil" className="select" defaultValue={filtros.perfil ?? ""}>
            <option value="">Todos</option>
            {ordemDosPerfis.map((p) => (
              <option key={p} value={p}>
                {rotuloDoPerfil[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-ativo">Situação</label>
          <select id="f-ativo" name="ativo" className="select" defaultValue={filtros.ativo ?? ""}>
            <option value="">Todas</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
        </div>
        <button type="submit" className="btn btn-line btn-sm" style={{ height: 36 }}>
          Filtrar
        </button>
      </form>
      <TableWrap>
        <table className="tb">
          <caption className="sr">Usuários cadastrados</caption>
          <thead>
            <tr>
              <th>Nome</th>
              <th style={{ width: 90 }}>Matrícula</th>
              <th>Perfil</th>
              <th>Equipe</th>
              <th style={{ width: 110 }}>Situação</th>
              <th style={{ width: 56 }} />
            </tr>
          </thead>
          <tbody>
            {usuarios.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              usuarios.map((u) => (
                <tr key={u.id} className={u.ativo ? undefined : "off"}>
                  <td>
                    {u.nome}
                    {u.email && <div className="small">{u.email}</div>}
                  </td>
                  <td className="mono">{u.matricula}</td>
                  <td>{rotuloDoPerfil[u.perfil as Perfil] ?? u.perfil}</td>
                  <td>{u.equipe_id ? (nomeDaEquipe.get(u.equipe_id) ?? "—") : "Todas / sem equipe"}</td>
                  <td>
                    <span className="stack g4" style={{ alignItems: "flex-start" }}>
                      <Badge tone={u.ativo ? "enc" : "neu"} style={{ padding: "1px 8px" }}>
                        {u.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                      {u.senha_provisoria && (
                        <Badge tone="al" style={{ padding: "1px 8px", fontSize: 11 }}>
                          Senha provisória
                        </Badge>
                      )}
                    </span>
                  </td>
                  <td className="acoes-linha">
                    <AcoesUsuario usuario={u} equipes={equipes} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableWrap>
      <PaginacaoLista caminho={rotas.web.usuarios} consulta={{ ...filtros }} pagina={pagina} tamanho={tamanho} total={total} />
    </Panel>
  );
}
