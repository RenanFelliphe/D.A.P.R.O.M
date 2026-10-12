import Link from "next/link";
import { notFound } from "next/navigation";
import { Trilha } from "@/components/app/AppChrome";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { aparenciaDoStatus } from "@/components/web/quadro/ColunaQuadro";
import type { ContagemPorStatus, OsDoQuadro } from "@/data/quadro";
import { apiOuNulo, usuarioAtual } from "@/lib/api";
import { dataDoDia } from "@/lib/formatar";
import { ordemDosStatus } from "@/lib/os-app";
import { rotas } from "@/lib/rotas";
import { ehAdmin, ehSupervisor, iniciaisDe, rotuloDoPerfil, rotuloDoStatus, type Equipe, type Perfil } from "@/lib/tipos";

/** Resposta de `GET /equipes/{id}`. */
interface EquipeDaApi {
  equipe: Equipe;
  supervisor: { id: string; nome: string; matricula: string; cargo: string | null } | null;
  membros: { id: string; nome: string; matricula: string; cargo: string | null; perfil: Perfil; ativo: boolean }[];
  contagem_por_status: ContagemPorStatus;
  total_os: number;
  os_recentes: OsDoQuadro[];
}

interface PerfilEquipeProps {
  equipeId: string;
  /** "Minha equipe" do técnico: a página abre direto, sem a trilha que volta à busca. */
  propria?: boolean;
}

/**
 * Perfil de uma equipe: centro de trabalho, supervisor, membros, a situação das OS e as mais recentes. A `api` decide
 * quem enxerga a equipe; o que ela recusa vira `404`.
 */
export async function PerfilEquipe({ equipeId, propria = false }: PerfilEquipeProps) {
  const [dados, { usuario: eu }] = await Promise.all([apiOuNulo<EquipeDaApi>(`/equipes/${equipeId}`), usuarioAtual()]);
  if (!dados) notFound();

  const { equipe, supervisor, membros, contagem_por_status: contagem, total_os: totalOs, os_recentes: recentes } = dados;
  const hrefDoPerfil = (id: string) => rotas.app.perfilDe(id);
  const hrefDaOs = (id: string) => rotas.app.os(id);
  const ativos = membros.filter((m) => m.ativo).length;
  const minhaEquipe = eu.equipe_id === equipe.id;
  // O atalho para o quadro da equipe é de quem acompanha as OS (admin e supervisor); o técnico já vê o quadro da própria equipe.
  const gestao = ehAdmin(eu) || ehSupervisor(eu);

  return (
    <Screen className="perfil-pagina">
      {!propria && <Trilha passos={[{ rotulo: "Busca", href: rotas.app.busca }, { rotulo: `Equipe ${equipe.nome}` }]} />}

      <header className="perfil-capa">
        <span className="perfil-foto equipe" role="img" aria-label={`Equipe ${equipe.nome}`}>
          <Icon name="users" size={24} />
        </span>
        <div className="perfil-id">
          <div className="row g8 wrap">
            <h1>{equipe.nome}</h1>
            {minhaEquipe && <Badge tone="brand">Sua equipe</Badge>}
          </div>
          <span className="muted">
            Centro de trabalho <span className="mono">{equipe.centro_trabalho}</span>
          </span>
          <div className="row g8 wrap">
            <Badge tone="lib">{`${ativos} ${ativos === 1 ? "membro ativo" : "membros ativos"}`}</Badge>
            <Badge tone="neu">{`${totalOs} ${totalOs === 1 ? "OS" : "OS"} no total`}</Badge>
          </div>
        </div>
        <div className="perfil-acoes">
          {gestao && (
            <Link className="btn btn-line btn-sm" href={`${rotas.app.lista}?equipe_id=${equipe.id}`}>
              <Icon name="grid" size={16} />
              Ver no quadro
            </Link>
          )}
          {eu.perfil === "admin" && (
            <Link className="btn btn-line btn-sm" href={`${rotas.app.usuarios}?equipe_id=${equipe.id}`}>
              Gerenciar membros
            </Link>
          )}
        </div>
      </header>

      <div className="kpis perfil-kpis cinco">
        {ordemDosStatus.map((s) => {
          const a = aparenciaDoStatus[s];
          return (
            <div key={s} className="kpi">
              <span className="l">
                <i style={{ background: a.cor }} />
                {rotuloDoStatus[s]}
              </span>
              <span className="v">{contagem[s]}</span>
              <span className="s">{contagem[s] === 1 ? "OS" : "OS"}</span>
            </div>
          );
        })}
      </div>

      <div className="perfil-grade">
        <section className="panel" aria-labelledby="os-da-equipe">
          <h2 id="os-da-equipe">OS mais recentes da equipe</h2>
          {recentes.length === 0 ? (
            <p className="muted">Esta equipe ainda não tem OS.</p>
          ) : (
            <ul className="perfil-os">
              {recentes.map((o) => {
                const a = aparenciaDoStatus[o.status];
                return (
                  <li key={o.id}>
                    <Link href={hrefDaOs(o.id)} className="perfil-os-item">
                      <span className="stack" style={{ minWidth: 0, flex: 1, lineHeight: 1.3 }}>
                        <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)" }}>
                          OS {o.numero_ordem ?? "—"}
                        </span>
                        <span style={{ fontSize: 14.5, fontWeight: 600 }}>{o.titulo}</span>
                        <span className="small" style={o.atrasada ? { color: "var(--blq)", fontWeight: 500 } : undefined}>
                          <Icon name="pin" size={13} /> {o.local_instalacao.codigo} · {o.tipo === "preventiva" ? "Preventiva" : "Corretiva"} · prog. até{" "}
                          {dataDoDia(o.data_fim_prog ?? o.data_inicio_prog).slice(0, 5)}
                          {o.atrasada && " · atrasada"}
                        </span>
                      </span>
                      <Badge tone={a.tom}>{rotuloDoStatus[o.status]}</Badge>
                      <Icon name="right" size={16} className="res-seta" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {gestao && totalOs > recentes.length && (
            <Link href={`${rotas.app.lista}?equipe_id=${equipe.id}`} style={{ fontWeight: 600, fontSize: 14 }}>
              {`Ver as ${totalOs} OS no quadro`}
            </Link>
          )}
        </section>

        <aside className="stack g16" style={{ minWidth: 0 }}>
          <section className="panel" aria-labelledby="supervisor-da-equipe">
            <h2 id="supervisor-da-equipe">Supervisor</h2>
            {supervisor ? (
              <Link href={hrefDoPerfil(supervisor.id)} className="perfil-membro">
                <span className="avatar">{iniciaisDe(supervisor.nome)}</span>
                <span className="stack" style={{ minWidth: 0, lineHeight: 1.25 }}>
                  <strong style={{ fontSize: 14 }}>{supervisor.nome}</strong>
                  <span className="small">
                    {supervisor.cargo ?? "Supervisor"} · mat. {supervisor.matricula}
                  </span>
                </span>
              </Link>
            ) : (
              <p className="muted">Sem supervisor: os alertas desta equipe ficam só com o admin.</p>
            )}
          </section>

          <section className="panel" aria-labelledby="membros-da-equipe">
            <h2 id="membros-da-equipe">{`Membros · ${membros.length}`}</h2>
            {membros.length === 0 ? (
              <p className="muted">Nenhum membro cadastrado.</p>
            ) : (
              <ul className="perfil-membros" aria-label={`Membros da equipe ${equipe.nome}`}>
                {membros.map((m) => (
                  <li key={m.id}>
                    <Link href={hrefDoPerfil(m.id)} className="perfil-membro" aria-current={m.id === eu.id ? "true" : undefined}>
                      <span className={m.ativo ? "avatar" : "avatar av3"}>{iniciaisDe(m.nome)}</span>
                      <span className="stack" style={{ minWidth: 0, lineHeight: 1.25 }}>
                        <strong style={{ fontSize: 14 }}>
                          {m.nome}
                          {!m.ativo && <span className="small"> · inativo</span>}
                        </strong>
                        <span className="small">
                          {m.cargo ?? rotuloDoPerfil[m.perfil]} · mat. {m.matricula}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </Screen>
  );
}
