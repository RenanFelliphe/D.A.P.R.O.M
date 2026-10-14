import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Panel, TableWrap } from "@/components/web/Panel";
import { PaginacaoLista } from "@/components/web/PaginacaoLista";
import { opcoesDeLiberacao, ordemDosPerfis, type ModoUsuarios } from "@/data/usuarios";
import { dataHora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { rotuloDoPerfil, type Equipe, type Perfil, type Usuario } from "@/lib/tipos";
import { AcoesUsuario } from "./AcoesUsuario";
import { SeloLiberacao } from "./SeloLiberacao";
import { SeloRegistro } from "./SeloRegistro";

export interface FiltrosUsuarios {
  equipe_id?: string;
  perfil?: string;
  ativo?: string;
  /** `pendente`, `liberado` ou `recusado`. */
  liberacao?: string;
  busca?: string;
}

interface TabelaUsuariosProps {
  usuarios: Usuario[];
  equipes: Pick<Equipe, "id" | "nome">[];
  filtros: FiltrosUsuarios;
  pagina: number;
  tamanho: number;
  total: number;
  /** Admin (padrão): todos os filtros e ações. Supervisor: visão restrita aos técnicos das equipes dele, sem perfil nem ativo. */
  modo?: ModoUsuarios;
  /** Rota da tela que usa a tabela (filtros e paginação voltam para ela). */
  caminho?: string;
  /** Id de quem está logado: o supervisor só edita e cancela os pendentes que ele cadastrou. */
  meuId?: string;
}

/**
 * Painel com a tabela de usuários. Admin: filtros por equipe, perfil, situação e acesso, com as ações em cada linha. Supervisor: só
 * os técnicos das equipes dele, com o selo da situação do acesso (Pendente, Liberado ou Recusado + motivo).
 */
export function TabelaUsuarios({ usuarios, equipes, filtros, pagina, tamanho, total, modo = "admin", caminho = rotas.app.usuarios, meuId }: TabelaUsuariosProps) {
  const supervisor = modo === "supervisor";
  const nomeDaEquipe = new Map(equipes.map((e) => [e.id, e.nome]));
  const colunas = supervisor ? 5 : 6;
  return (
    <Panel>
      <h2>{supervisor ? `Técnicos · ${total}` : `Usuários · ${total}`}</h2>
      <form method="get" action={caminho} className="filtros-lista">
        <div className="field">
          <label htmlFor="f-busca">Busca</label>
          <input
            id="f-busca"
            name="busca"
            type="search"
            className="input"
            placeholder={supervisor ? "Nome, matrícula ou cargo" : "Nome, matrícula, e-mail, cargo ou CREA"}
            defaultValue={filtros.busca ?? ""}
          />
        </div>
        {(!supervisor || equipes.length > 1) && (
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
        )}
        {!supervisor && (
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
        )}
        <div className="field">
          <label htmlFor="f-liberacao">Acesso</label>
          <select id="f-liberacao" name="liberacao" className="select" defaultValue={filtros.liberacao ?? ""}>
            <option value="">Todos</option>
            {opcoesDeLiberacao.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </div>
        {!supervisor && (
          <div className="field">
            <label htmlFor="f-ativo">Situação</label>
            <select id="f-ativo" name="ativo" className="select" defaultValue={filtros.ativo ?? ""}>
              <option value="">Todas</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </div>
        )}
        <button type="submit" className="btn btn-line btn-sm" style={{ height: 36 }}>
          Filtrar
        </button>
      </form>
      <TableWrap>
        <table className="tb">
          <caption className="sr">{supervisor ? "Técnicos das equipes que você supervisiona" : "Usuários cadastrados"}</caption>
          <thead>
            <tr>
              <th>Nome</th>
              <th style={{ width: 90 }}>Matrícula</th>
              {!supervisor && <th>Perfil</th>}
              <th>Equipe</th>
              <th style={{ width: supervisor ? 220 : 170 }}>{supervisor ? "Acesso" : "Situação"}</th>
              <th style={{ width: 56 }}>
                <span className="sr">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {usuarios.length === 0 ? (
              <tr>
                <td colSpan={colunas} className="muted">
                  {supervisor ? "Nenhum técnico encontrado." : "Nenhum usuário encontrado."}
                </td>
              </tr>
            ) : (
              usuarios.map((u) => {
                return (
                  <tr key={u.id} className={u.ativo ? undefined : "off"}>
                    <td>
                      <Link href={rotas.app.perfilDe(u.id)} style={{ fontWeight: 600 }}>
                        {u.nome}
                      </Link>
                      {u.email && <div className="small">{u.email}</div>}
                    </td>
                    <td className="mono">{u.matricula}</td>
                    {!supervisor && <td>{rotuloDoPerfil[u.perfil as Perfil] ?? u.perfil}</td>}
                    <td>
                      {u.equipe_id ? (
                        nomeDaEquipe.has(u.equipe_id) ? <Link href={rotas.app.equipe(u.equipe_id)}>{nomeDaEquipe.get(u.equipe_id)}</Link> : "—"
                      ) : (
                        "Todas / sem equipe"
                      )}
                    </td>
                    <td>
                      {supervisor ? (
                        <span className="stack g4" style={{ alignItems: "flex-start" }}>
                          <SeloLiberacao liberacao={u.liberacao} motivo={u.recusa_motivo} />
                          <SeloRegistro situacao={u.situacao_registro} />
                        </span>
                      ) : (
                        <span className="stack g4" style={{ alignItems: "flex-start" }}>
                          <Badge tone={u.ativo ? "enc" : "neu"} style={{ padding: "1px 8px" }}>
                            {u.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                          {u.liberacao && u.liberacao !== "liberado" && <SeloLiberacao liberacao={u.liberacao} motivo={u.recusa_motivo} />}
                          <SeloRegistro situacao={u.situacao_registro} />
                          {u.registro_conferido_em && <span className="small">Registro conferido em {dataHora(u.registro_conferido_em)}</span>}
                          {u.senha_provisoria && (
                            <Badge tone="al" style={{ padding: "1px 8px", fontSize: 11 }}>
                              Senha provisória
                            </Badge>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="acoes-linha">
                      <AcoesUsuario usuario={u} equipes={equipes} modo={modo} meuId={meuId} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </TableWrap>
      <PaginacaoLista caminho={caminho} consulta={{ ...filtros }} pagina={pagina} tamanho={tamanho} total={total} />
    </Panel>
  );
}
