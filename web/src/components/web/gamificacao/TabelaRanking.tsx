import Link from "next/link";
import { Panel, TableWrap } from "@/components/web/Panel";
import { SeloPatente } from "@/components/web/gamificacao/SeloPatente";
import { Badge } from "@/components/ui/Badge";
import { cx } from "@/lib/cx";
import { mediaDeEquipe, numero, type LinhaDeEquipe, type LinhaDePessoa } from "@/lib/gamificacao";
import { rotas } from "@/lib/rotas";

/** A posição, com a medalha dos três primeiros. */
function Posicao({ n }: { n: number }) {
  return n <= 3 ? <span className={cx("pos-medalha", `p${n}`)}>{n}</span> : <>{n}º</>;
}

interface TabelaDePessoasProps {
  linhas: LinhaDePessoa[];
  /** No ranking geral a patente é a maior já alcançada. */
  geral: boolean;
}

/** O ranking de pessoas: posição, nome, equipe, patente e pontos. A própria linha vem em destaque; os anônimos aparecem sem nome. */
export function TabelaDePessoas({ linhas, geral }: TabelaDePessoasProps) {
  return (
    <Panel style={{ gap: 12 }}>
      <TableWrap>
        <table className="tb">
          <caption className="sr">Ranking de pessoas</caption>
          <thead>
            <tr>
              <th className="pos">#</th>
              <th>Nome</th>
              <th>Equipe</th>
              <th>{geral ? "Maior patente" : "Patente"}</th>
              <th className="num">Pontos</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  Ninguém no ranking ainda.
                </td>
              </tr>
            ) : (
              linhas.map((l, i) => (
                <tr key={l.usuario_id ?? `anonimo-${i}`} className={l.voce ? "voce" : undefined} aria-current={l.voce ? "true" : undefined}>
                  <td className="pos">
                    <Posicao n={l.posicao} />
                  </td>
                  <td>
                    {l.usuario_id ? <Link href={l.voce ? rotas.app.perfil : rotas.app.perfilDe(l.usuario_id)}>{l.nome}</Link> : <span className="rank-anonimo">{l.nome}</span>}
                    {l.voce && (
                      <>
                        {" "}
                        <Badge tone="brand">Você</Badge>
                      </>
                    )}
                    {l.voce && l.anonimo && (
                      <>
                        {" "}
                        <Badge tone="neu">Anônimo para os outros</Badge>
                      </>
                    )}
                  </td>
                  <td>{l.equipe_id && l.equipe_nome ? <Link href={rotas.app.equipe(l.equipe_id)}>{l.equipe_nome}</Link> : <span className="muted">—</span>}</td>
                  <td>
                    <SeloPatente patente={l.patente} tamanho="p" />
                  </td>
                  <td className="num">
                    <strong>{numero(l.pontos)}</strong>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableWrap>
    </Panel>
  );
}

interface TabelaDeEquipesProps {
  linhas: LinhaDeEquipe[];
  geral: boolean;
}

/** O ranking de equipes pela média por membro (a equipe maior não ganha só por ser maior); a soma e o número de pessoas ficam ao lado. */
export function TabelaDeEquipes({ linhas, geral }: TabelaDeEquipesProps) {
  return (
    <Panel style={{ gap: 12 }}>
      <TableWrap>
        <table className="tb">
          <caption className="sr">Ranking de equipes</caption>
          <thead>
            <tr>
              <th className="pos">#</th>
              <th>Equipe</th>
              {!geral && <th>Patente</th>}
              <th className="num">Média por membro</th>
              <th className="num">Soma</th>
              <th className="num">Pessoas</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={geral ? 5 : 6} className="muted">
                  Nenhuma equipe no ranking ainda.
                </td>
              </tr>
            ) : (
              linhas.map((l) => (
                <tr key={l.equipe_id} className={l.voce ? "voce" : undefined} aria-current={l.voce ? "true" : undefined}>
                  <td className="pos">
                    <Posicao n={l.posicao} />
                  </td>
                  <td>
                    <Link href={rotas.app.equipe(l.equipe_id)}>{l.nome}</Link>
                    {l.voce && (
                      <>
                        {" "}
                        <Badge tone="brand">Sua equipe</Badge>
                      </>
                    )}
                  </td>
                  {!geral && (
                    <td>
                      <SeloPatente patente={l.patente} tamanho="p" />
                    </td>
                  )}
                  <td className="num">
                    <strong>{mediaDeEquipe(l.media)}</strong>
                  </td>
                  <td className="num">{numero(l.pontos)}</td>
                  <td className="num">{l.membros}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableWrap>
    </Panel>
  );
}
