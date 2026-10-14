import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Panel, TableWrap } from "@/components/web/Panel";
import { OpcaoAnonimato } from "@/components/web/gamificacao/OpcaoAnonimato";
import { SeloPatente } from "@/components/web/gamificacao/SeloPatente";
import { data } from "@/lib/formatar";
import { mediaDeEquipe, numero, ordinal, type ConquistaObtida, type PerfilDaEquipeNaGamificacao, type PerfilDaPessoa, type ResumoDaBarra } from "@/lib/gamificacao";
import { rotas } from "@/lib/rotas";

/** Os troféus obtidos, pequenos, com a data na dica. */
function Trofeus({ conquistas }: { conquistas: ConquistaObtida[] }) {
  if (conquistas.length === 0) return <span className="muted small">Nenhuma conquista ainda.</span>;
  return (
    <div className="gal-pequena">
      {conquistas.map((c) => (
        <span key={c.id} className="trofeu" title={`${c.descricao} · obtida em ${data(c.obtida_em)}`}>
          {c.imagem_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.imagem_url} alt="" loading="lazy" />
          ) : (
            <Icon name="trophy" size={16} />
          )}
          {c.titulo}
        </span>
      ))}
    </div>
  );
}

/**
 * A gamificação no perfil de uma pessoa: a patente da temporada, a maior patente e as conquistas. Quem está anônimo no ranking
 * não mostra nada disso aos outros (a `api` devolve só `anonimo: true`); o bloco some.
 */
export function BlocoDaPessoa({ perfil }: { perfil: PerfilDaPessoa | null }) {
  if (!perfil || perfil.anonimo) return null;
  return (
    <section className="panel gam-bloco" aria-labelledby="gam-pessoa">
      <div className="row between wrap">
        <h2 id="gam-pessoa">Gamificação</h2>
        <Link href={rotas.app.gamificacaoRanking} className="small">
          Ver o ranking
        </Link>
      </div>
      <div className="gam-resumo">
        <div className="r-item">
          <span className="lbl">Patente · {perfil.temporada.nome}</span>
          <SeloPatente patente={perfil.patente} tamanho="m" />
        </div>
        <div className="r-item">
          <span className="lbl">Pontos na temporada</span>
          <strong>{numero(perfil.pontos_temporada)}</strong>
        </div>
        <div className="r-item">
          <span className="lbl">Maior patente</span>
          <SeloPatente patente={perfil.maior_patente} tamanho="m" />
        </div>
      </div>
      <div className="stack g6">
        <span className="lbl">Conquistas · {perfil.conquistas.length}</span>
        <Trofeus conquistas={perfil.conquistas} />
      </div>
    </section>
  );
}

/**
 * A gamificação da própria pessoa, no Meu perfil: a patente e os pontos da temporada (que levam a "Minha pontuação") e a opção
 * de aparecer como anônimo no ranking.
 */
export function CartaoDaMinhaPontuacao({ resumo, anonimo }: { resumo: ResumoDaBarra; anonimo: boolean }) {
  return (
    <section className="panel gam-bloco" aria-labelledby="gam-minha">
      <h2 id="gam-minha">Gamificação</h2>
      <div className="row g12 wrap" style={{ alignItems: "center" }}>
        <SeloPatente patente={resumo.patente} tamanho="g" />
        <div className="stack g4">
          <span className="lbl">{resumo.temporada.nome}</span>
          <strong style={{ fontSize: 20 }}>
            {numero(resumo.pontos_temporada)} {resumo.pontos_temporada === 1 ? "ponto" : "pontos"}
          </strong>
        </div>
      </div>
      <Link href={rotas.app.gamificacaoMinha} className="small">
        Ver minha pontuação, o extrato e as conquistas
      </Link>
      <OpcaoAnonimato anonimo={anonimo} />
    </section>
  );
}

/**
 * A gamificação da equipe: a soma, a média por membro, a patente (a tabela de patentes aplicada à média), a posição e as
 * conquistas, e os pontos de cada membro na temporada (os anônimos aparecem como anônimos).
 */
export function BlocoDaEquipe({ dados }: { dados: PerfilDaEquipeNaGamificacao | null }) {
  if (!dados) return null;
  return (
    <section className="panel gam-bloco" aria-labelledby="gam-equipe">
      <div className="row between wrap">
        <h2 id="gam-equipe">Gamificação</h2>
        <Link href={`${rotas.app.gamificacaoRanking}?tipo=equipes`} className="small">
          Ver o ranking de equipes
        </Link>
      </div>
      <div className="gam-resumo">
        <div className="r-item">
          <span className="lbl">Patente · {dados.temporada.nome}</span>
          <SeloPatente patente={dados.patente} tamanho="m" />
        </div>
        <div className="r-item">
          <span className="lbl">Posição na temporada</span>
          <strong>{dados.posicao_temporada ? `${ordinal(dados.posicao_temporada)} de ${dados.equipes_no_ranking}` : "—"}</strong>
        </div>
        <div className="r-item">
          <span className="lbl">Média por membro</span>
          <strong>{mediaDeEquipe(dados.media)}</strong>
        </div>
        <div className="r-item">
          <span className="lbl">Soma da temporada</span>
          <strong>
            {numero(dados.pontos_temporada)} <span className="muted small">· {dados.membros} {dados.membros === 1 ? "pessoa" : "pessoas"}</span>
          </strong>
        </div>
        <div className="r-item">
          <span className="lbl">Geral</span>
          <strong>
            {dados.posicao_geral ? ordinal(dados.posicao_geral) : "—"} <span className="muted small">· média {mediaDeEquipe(dados.media_geral)}</span>
          </strong>
        </div>
      </div>
      <div className="stack g6">
        <span className="lbl">Conquistas da equipe · {dados.conquistas.length}</span>
        <Trofeus conquistas={dados.conquistas} />
      </div>
      <div className="stack g6">
        <span className="lbl">Pontos de cada membro na temporada</span>
        <Panel style={{ padding: 0, border: 0, gap: 0 }}>
          <TableWrap>
            <table className="tb">
              <caption className="sr">Pontos de cada membro na temporada</caption>
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Patente</th>
                  <th className="num">Pontos</th>
                </tr>
              </thead>
              <tbody>
                {dados.pessoas.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      Nenhuma pessoa na equipe.
                    </td>
                  </tr>
                ) : (
                  dados.pessoas.map((p, i) => (
                    <tr key={p.usuario_id ?? `anonimo-${i}`} className={p.voce ? "voce" : undefined}>
                      <td>{p.usuario_id ? <Link href={p.voce ? rotas.app.perfil : rotas.app.perfilDe(p.usuario_id)}>{p.nome}</Link> : <span className="rank-anonimo">{p.nome}</span>}</td>
                      <td>
                        <SeloPatente patente={p.patente} tamanho="p" />
                      </td>
                      <td className="num">
                        <strong>{numero(p.pontos)}</strong>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      </div>
    </section>
  );
}
