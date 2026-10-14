import Link from "next/link";
import { notFound } from "next/navigation";
import { Trilha } from "@/components/app/AppChrome";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { BlocoDaPessoa } from "@/components/web/gamificacao/BlocosDoPerfil";
import { SeloRegistro } from "@/components/web/usuarios/SeloRegistro";
import { lerPerfilDaPessoa } from "@/data/gamificacao";
import { apiOuNulo, usuarioAtual } from "@/lib/api";
import { data, dataHora, duracao } from "@/lib/formatar";
import { rotas, urlDoPdf } from "@/lib/rotas";
import { iniciaisDe, rotuloDoPerfil, type Equipe, type Perfil, type Usuario } from "@/lib/tipos";

/** Resposta de `GET /usuarios/{id}`. */
interface PerfilDaApi {
  usuario: Usuario;
  equipe: Equipe | null;
  supervisor: { id: string; nome: string } | null;
  membros: { id: string; nome: string; matricula: string; cargo: string | null; perfil: Perfil }[];
  /** `null` para um técnico comum vendo um colega: o desempenho de cada um não é dele. */
  resumo: { os_encerradas: number; em_andamento: number; ultima_encerrada_em: string | null } | null;
  execucoes: {
    id: string;
    os_id: string;
    numero_ordem: string | null;
    titulo: string;
    local_codigo: string;
    inicio: string;
    fim: string;
    tempo_liquido_min: number | null;
    pdf_pronto: boolean;
  }[];
}

interface PerfilUsuarioProps {
  usuarioId: string;
}

/**
 * Perfil de uma pessoa (aberto pela busca global): foto, dados, equipe com os membros e as últimas OS que ela encerrou.
 * A `api` decide quem pode ver quem; o que ela recusa vira `404`.
 */
export async function PerfilUsuario({ usuarioId }: PerfilUsuarioProps) {
  // A gamificação (patente, maior patente e conquistas) vem à parte: some para quem está anônimo no ranking e no campo de treino.
  const [perfil, { usuario: eu }, gamificacao] = await Promise.all([apiOuNulo<PerfilDaApi>(`/usuarios/${usuarioId}`), usuarioAtual(), lerPerfilDaPessoa(usuarioId)]);
  if (!perfil) notFound();

  const { usuario: u, equipe, supervisor, membros, resumo, execucoes } = perfil;
  const admin = eu.perfil === "admin";
  const euMesmo = u.id === eu.id;
  const hrefDoPerfil = (id: string) => (rotas.app.perfilDe(id));
  const hrefDaEquipe = (id: string) => (rotas.app.equipe(id));
  const hrefDaOs = (id: string) => (rotas.app.os(id));
  const meuPerfil = rotas.app.perfil;

  const dados: [string, string | null][] = [
    ["Matrícula", u.matricula],
    ["Cargo", u.cargo],
    ["Registro profissional", u.registro_profissional],
    ["E-mail institucional", u.email ?? null],
    ["Assinatura cadastrada", u.assinatura_em ? `em ${data(u.assinatura_em)}` : "ainda não cadastrada"],
  ];

  return (
    <Screen className="perfil-pagina">
      <Trilha
        passos={[
          { rotulo: "Busca", href: rotas.app.busca },
          { rotulo: u.nome },
        ]}
      />

      <header className="perfil-capa">
        <span className={u.ativo ? "perfil-foto" : "perfil-foto inativo"} role="img" aria-label={`Foto de ${u.nome}`}>
          {iniciaisDe(u.nome)}
        </span>
        <div className="perfil-id">
          <div className="row g8 wrap">
            <h1>{u.nome}</h1>
            {euMesmo && <Badge tone="brand">Você</Badge>}
          </div>
          <span className="muted">
            {u.cargo ?? rotuloDoPerfil[u.perfil]}
            {equipe && (
              <>
                {" · "}
                <Link href={hrefDaEquipe(equipe.id)}>{equipe.nome}</Link>
              </>
            )}
          </span>
          <div className="row g8 wrap">
            <Badge tone={u.perfil === "admin" ? "dark" : "lib"}>{rotuloDoPerfil[u.perfil]}</Badge>
            <Badge tone={u.ativo ? "enc" : "blq"}>{u.ativo ? "Conta ativa" : "Conta inativa"}</Badge>
            {admin && <SeloRegistro situacao={u.situacao_registro} />}
          </div>
        </div>
        <div className="perfil-acoes">
          {euMesmo && (
            <Link className="btn btn-line btn-sm" href={meuPerfil}>
              <Icon name="user" size={16} />
              Meu perfil
            </Link>
          )}
          {admin && (
            <Link className="btn btn-line btn-sm" href={`${rotas.app.usuarios}?busca=${encodeURIComponent(u.matricula)}`}>
              Gerenciar conta
            </Link>
          )}
        </div>
      </header>

      {resumo && (
        <div className="kpis perfil-kpis">
          <div className="kpi">
            <span className="l">
              <i style={{ background: "var(--enc)" }} />
              OS encerradas
            </span>
            <span className="v">{resumo.os_encerradas}</span>
            <span className="s">no total</span>
          </div>
          <div className="kpi">
            <span className="l">
              <i style={{ background: "var(--exe)" }} />
              Em andamento
            </span>
            <span className="v">{resumo.em_andamento}</span>
            <span className="s">execuções abertas agora</span>
          </div>
          <div className="kpi">
            <span className="l">
              <i style={{ background: "var(--lib)" }} />
              Última OS encerrada
            </span>
            <span className="v" style={{ fontSize: 22 }}>
              {resumo.ultima_encerrada_em ? data(resumo.ultima_encerrada_em) : "—"}
            </span>
            <span className="s">{resumo.ultima_encerrada_em ? dataHora(resumo.ultima_encerrada_em).slice(-5) : "sem OS encerradas"}</span>
          </div>
        </div>
      )}

      <div className="perfil-grade">
        {resumo && (
          <div className="col-main">
            <section className="panel" aria-labelledby="ultimas-os">
              <h2 id="ultimas-os">Últimas OS realizadas</h2>
              {execucoes.length === 0 ? (
                <p className="muted">{euMesmo ? "Você ainda não encerrou nenhuma OS." : `${u.nome.split(" ")[0]} ainda não encerrou nenhuma OS.`}</p>
              ) : (
                <ul className="perfil-os">
                  {execucoes.map((e) => (
                    <li key={e.id}>
                      <Link href={hrefDaOs(e.os_id)} className="perfil-os-item">
                        <span className="stack" style={{ minWidth: 0, flex: 1, lineHeight: 1.3 }}>
                          <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)" }}>
                            OS {e.numero_ordem ?? "—"}
                          </span>
                          <span style={{ fontSize: 14.5, fontWeight: 600 }}>{e.titulo}</span>
                          <span className="small">
                            <Icon name="pin" size={13} /> {e.local_codigo} · {dataHora(e.fim)} · {duracao(e.tempo_liquido_min)} líquidos
                          </span>
                        </span>
                        <Badge tone="enc">Encerrada</Badge>
                        <Icon name="right" size={16} className="res-seta" />
                      </Link>
                      {e.pdf_pronto && (
                        <a className="perfil-pdf" href={urlDoPdf(e.os_id)} target="_blank" rel="noreferrer" aria-label={`PDF da OS ${e.numero_ordem ?? ""}`}>
                          <Icon name="file" size={16} />
                          PDF
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        <aside className="stack g16" style={{ minWidth: 0 }}>
          <section className="panel" aria-labelledby="dados-pessoa">
            <h2 id="dados-pessoa">Informações</h2>
            <dl className="perfil-dados">
              {dados.map(([rotulo, valor]) => (
                <div key={rotulo}>
                  <dt>{rotulo}</dt>
                  <dd>{valor || "—"}</dd>
                </div>
              ))}
            </dl>
          </section>

          <BlocoDaPessoa perfil={gamificacao} />

          <section className="panel" aria-labelledby="equipe-pessoa">
            <h2 id="equipe-pessoa">
              {equipe ? <Link href={hrefDaEquipe(equipe.id)}>{`Equipe ${equipe.nome}`}</Link> : "Equipe"}
            </h2>
            {!equipe ? (
              <p className="muted">Esta pessoa não pertence a uma equipe específica.</p>
            ) : (
              <>
                <div className="small">
                  Centro de trabalho <strong className="mono">{equipe.centro_trabalho}</strong>
                  {supervisor && (
                    <>
                      {" "}
                      · Supervisor <strong>{supervisor.nome}</strong>
                    </>
                  )}
                </div>
                <ul className="perfil-membros" aria-label={`Membros da equipe ${equipe.nome}`}>
                  {membros.map((m) => (
                    <li key={m.id}>
                      <Link href={hrefDoPerfil(m.id)} className="perfil-membro" aria-current={m.id === u.id ? "true" : undefined}>
                        <span className="avatar">{iniciaisDe(m.nome)}</span>
                        <span className="stack" style={{ minWidth: 0, lineHeight: 1.25 }}>
                          <strong style={{ fontSize: 14 }}>{m.nome}</strong>
                          <span className="small">
                            {m.cargo ?? rotuloDoPerfil[m.perfil]} · mat. {m.matricula}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <span className="small">{`${membros.length} ${membros.length === 1 ? "membro ativo" : "membros ativos"}`}</span>
              </>
            )}
          </section>
        </aside>
      </div>
    </Screen>
  );
}
