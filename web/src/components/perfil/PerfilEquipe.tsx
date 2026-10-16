import Link from "next/link";
import { notFound } from "next/navigation";
import { Trilha } from "@/components/app/AppChrome";
import { AusenciasDaEquipe, BotaoRegistrarAusencia, type PessoaDaEquipe } from "@/components/ausencia/AusenciasDaEquipe";
import { SeloDeAusencia } from "@/components/ausencia/SeloDeAusencia";
import { RepresentanteDaEquipe } from "@/components/representacao/RepresentanteDaEquipe";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { BlocoDaEquipe } from "@/components/web/gamificacao/BlocosDoPerfil";
import { aparenciaDoStatus } from "@/components/web/quadro/ColunaQuadro";
import { lerPerfilDaEquipe } from "@/data/gamificacao";
import type { ContagemPorStatus, OsDoQuadro } from "@/data/quadro";
import { apiOuNulo, usuarioAtual } from "@/lib/api";
import type { Ausencia, AusenciaDaPessoa } from "@/lib/ausencia";
import { dataDoDia } from "@/lib/formatar";
import type { RepresentacaoDaEquipe } from "@/lib/representacao";
import { ordemDosStatus } from "@/lib/os-app";
import { rotas } from "@/lib/rotas";
import { ehAdmin, ehSupervisor, iniciaisDe, rotuloDoPerfil, rotuloDoStatus, type Equipe, type Perfil } from "@/lib/tipos";

/** Resposta de `GET /equipes/{id}`. */
interface EquipeDaApi {
  equipe: Equipe;
  supervisor: { id: string; nome: string; matricula: string; cargo: string | null; ausencia: AusenciaDaPessoa | null } | null;
  /** Quem substitui o supervisor, e a representação em vigor (o supervisor está ausente ou parado). */
  representante?: { id: string; nome: string; matricula: string } | null;
  representacao?: RepresentacaoDaEquipe | null;
  membros: { id: string; nome: string; matricula: string; cargo: string | null; perfil: Perfil; ativo: boolean; ausencia: AusenciaDaPessoa | null }[];
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
  // A gamificação da equipe (soma, média, patente, posição, conquistas e os pontos de cada membro) vem à parte e some no campo de treino.
  const [dados, { usuario: eu, ausencia: minhaAusencia }, gamificacao] = await Promise.all([apiOuNulo<EquipeDaApi>(`/equipes/${equipeId}`), usuarioAtual(), lerPerfilDaEquipe(equipeId)]);
  if (!dados) notFound();

  const { equipe, supervisor, membros, contagem_por_status: contagem, total_os: totalOs, os_recentes: recentes } = dados;
  const hrefDoPerfil = (id: string) => rotas.app.perfilDe(id);
  const hrefDaOs = (id: string) => rotas.app.os(id);
  const ativos = membros.filter((m) => m.ativo).length;
  const minhaEquipe = eu.equipe_id === equipe.id;
  // O atalho para o quadro da equipe é de quem acompanha as OS (admin e supervisor); o técnico já vê o quadro da própria equipe.
  const gestao = ehAdmin(eu) || ehSupervisor(eu);
  // As ausências da equipe são de quem a supervisiona (que responde e registra) e do admin (que só consulta); no campo de treino a rota não existe.
  const supervisaEquipe = eu.equipes_supervisionadas?.some((e) => e.id === equipe.id) ?? false;
  // Quem designa o representante: o supervisor da equipe (não o representante no comando) e o admin; ausente só visualiza.
  const representaEquipe = eu.equipes_representadas?.some((e) => e.id === equipe.id) ?? false;
  const podeDesignar = !minhaAusencia && (ehAdmin(eu) || (supervisaEquipe && !representaEquipe));
  const candidatos = membros.filter((m) => m.ativo && m.perfil === "tecnico" && m.id !== supervisor?.id).map((m) => ({ id: m.id, nome: m.nome }));
  const ausencias = supervisaEquipe || ehAdmin(eu) ? (await apiOuNulo<{ ausencias: Ausencia[] }>("/ausencias", { consulta: { equipe_id: equipe.id, abertas: true, tamanho: 100 } }))?.ausencias ?? null : null;
  const quemAge = { id: eu.id, assinaturaPath: eu.assinatura_path, ausente: Boolean(minhaAusencia) };
  // A quem o supervisor registra a ausência: os técnicos ativos da equipe e ele mesmo.
  const pessoas: PessoaDaEquipe[] = [
    { id: eu.id, nome: eu.nome, eu: true },
    ...membros.filter((m) => m.ativo && m.perfil === "tecnico" && m.id !== eu.id).map((m) => ({ id: m.id, nome: m.nome })),
  ];

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

      {ausencias && <AusenciasDaEquipe ausencias={ausencias} eu={quemAge} supervisaEquipe={supervisaEquipe} pessoas={pessoas} equipeNome={equipe.nome} />}

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
                  <strong style={{ fontSize: 14 }}>
                    {supervisor.nome} <SeloDeAusencia ausencia={supervisor.ausencia} />
                  </strong>
                  <span className="small">
                    {supervisor.cargo ?? "Supervisor"} · mat. {supervisor.matricula}
                  </span>
                </span>
              </Link>
            ) : (
              <p className="muted">Sem supervisor: os alertas desta equipe ficam só com o admin, e ninguém da equipe pode pedir ausência.</p>
            )}
          </section>

          {dados.representante !== undefined && (
            <RepresentanteDaEquipe equipeId={equipe.id} representante={dados.representante ?? null} representacao={dados.representacao ?? null} candidatos={candidatos} podeDesignar={podeDesignar} />
          )}

          <BlocoDaEquipe dados={gamificacao} />

          <section className="panel" aria-labelledby="membros-da-equipe">
            <h2 id="membros-da-equipe">{`Membros · ${membros.length}`}</h2>
            {membros.length === 0 ? (
              <p className="muted">Nenhum membro cadastrado.</p>
            ) : (
              <ul className="perfil-membros" aria-label={`Membros da equipe ${equipe.nome}`}>
                {membros.map((m) => (
                  <li key={m.id} className="row g8" style={{ alignItems: "center" }}>
                    <Link href={hrefDoPerfil(m.id)} className="perfil-membro" aria-current={m.id === eu.id ? "true" : undefined} style={{ flex: 1, minWidth: 0 }}>
                      <span className={m.ativo ? "avatar" : "avatar av3"}>{iniciaisDe(m.nome)}</span>
                      <span className="stack" style={{ minWidth: 0, lineHeight: 1.25 }}>
                        <strong style={{ fontSize: 14 }}>
                          {m.nome}
                          {!m.ativo && <span className="small"> · inativo</span>} <SeloDeAusencia ausencia={m.ausencia} />
                          {m.id === dados.representante?.id && <Badge tone="neu" style={{ padding: "1px 8px", fontSize: 11 }}>Representante</Badge>}
                        </strong>
                        <span className="small">
                          {m.cargo ?? rotuloDoPerfil[m.perfil]} · mat. {m.matricula}
                        </span>
                      </span>
                    </Link>
                    {supervisaEquipe && m.ativo && m.perfil === "tecnico" && m.id !== eu.id && (
                      <BotaoRegistrarAusencia pessoas={pessoas} pessoaInicial={m.id} assinaturaPath={eu.assinatura_path} ausente={quemAge.ausente} rotulo="Ausência" pequeno />
                    )}
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
