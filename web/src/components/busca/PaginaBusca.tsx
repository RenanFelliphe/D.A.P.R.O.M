import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { aparenciaDoStatus } from "@/components/web/quadro/ColunaQuadro";
import type { OsDoQuadro, RespostaOs } from "@/data/quadro";
import { api, usuarioAtual } from "@/lib/api";
import { destacar } from "@/lib/destacar";
import { dataDoDia } from "@/lib/formatar";
import { ordemDosStatus } from "@/lib/os-app";
import { rotas } from "@/lib/rotas";
import { iniciaisDe, rotuloDoPerfil, rotuloDoStatus, type Equipe, type OsStatus, type Paginacao, type Perfil, type Usuario } from "@/lib/tipos";
import { ColunaFiltros } from "./ColunaFiltros";
import { ColunaResultados, Paginador } from "./ColunaResultados";
import { FiltrosBusca } from "./FiltrosBusca";

const TAMANHO = 10;
const TAMANHO_DAS_EQUIPES = 6;

/** Equipe como `GET /equipes?busca=` a devolve. */
interface EquipeEncontrada extends Equipe {
  supervisor_nome: string | null;
  total_membros: number;
}

/** Resposta de `GET /busca/exata`: o único item que casa por inteiro com o texto. */
interface AchadoExato {
  tipo: "usuario" | "equipe" | "os";
  id: string;
}

type Area = "web" | "app";

const PERFIS: Perfil[] = ["tecnico", "supervisor", "analista", "seguranca", "admin"];

type Consulta = Record<string, string | string[] | undefined>;

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const numero = (v: string | undefined) => Math.max(1, Number.parseInt(v ?? "1", 10) || 1);
const ultimaPaginaDe = (r: Paginacao) => Math.max(1, Math.ceil(r.total / r.tamanho));

/** Endereço da própria página com os parâmetros trocados (valor vazio remove o parâmetro). */
function endereco(caminho: string, atual: Record<string, string | undefined>, troca: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries({ ...atual, ...troca })) if (valor) params.set(chave, valor);
  const texto = params.toString();
  return texto ? `${caminho}?${texto}` : caminho;
}

/** Página do item achado: perfil da pessoa, perfil da equipe ou detalhe da OS. */
function enderecoDoAchado(area: Area, achado: AchadoExato): string {
  const r = area === "web" ? rotas.web : rotas.app;
  if (achado.tipo === "usuario") return r.perfilDe(achado.id);
  return achado.tipo === "equipe" ? r.equipe(achado.id) : r.os(achado.id);
}

function ResultadoEquipe({ area, equipe, q }: { area: Area; equipe: EquipeEncontrada; q: string | undefined }) {
  const r = area === "web" ? rotas.web : rotas.app;
  return (
    <Link className="res-equipe" href={r.equipe(equipe.id)}>
      <span className="res-icone eq">
        <Icon name="users" size={18} />
      </span>
      <span className="res-corpo">
        <span className="res-tit">{destacar(equipe.nome, q)}</span>
        <span className="res-det">
          Centro <span className="mono">{destacar(equipe.centro_trabalho, q)}</span>
        </span>
        <span className="res-det">
          {`${equipe.total_membros} ${equipe.total_membros === 1 ? "membro" : "membros"}`}
          {equipe.supervisor_nome ? ` · ${equipe.supervisor_nome}` : " · sem supervisor"}
        </span>
      </span>
      <Icon name="right" size={16} className="res-seta" />
    </Link>
  );
}

function ResultadoUsuario({ area, usuario: u, equipe, q }: { area: Area; usuario: Usuario; equipe: string | undefined; q: string | undefined }) {
  const r = area === "web" ? rotas.web : rotas.app;
  return (
    <Link className="res-item" href={r.perfilDe(u.id)} data-inativo={u.ativo ? undefined : ""}>
      <span className={u.ativo ? "avatar" : "avatar av3"}>{iniciaisDe(u.nome)}</span>
      <span className="res-corpo">
        <span className="res-tit">{destacar(u.nome, q)}</span>
        {u.email && <span className="res-det">{destacar(u.email, q)}</span>}
        <span className="res-det">
          {u.cargo && <>{destacar(u.cargo, q)} · </>}
          Matrícula {destacar(u.matricula, q)}
          {u.registro_profissional && <> · CREA {destacar(u.registro_profissional, q)}</>}
        </span>
        <span className="res-tags">
          <Badge tone={u.perfil === "admin" ? "dark" : "neu"}>{rotuloDoPerfil[u.perfil]}</Badge>
          {equipe && <span className="res-chip">{equipe}</span>}
          {!u.ativo && <Badge tone="blq">Inativo</Badge>}
        </span>
      </span>
      <Icon name="right" size={16} className="res-seta" />
    </Link>
  );
}

function ResultadoOs({ area, os: o, q }: { area: Area; os: OsDoQuadro; q: string | undefined }) {
  const r = area === "web" ? rotas.web : rotas.app;
  const a = aparenciaDoStatus[o.status];
  const programada = dataDoDia(o.data_fim_prog ?? o.data_inicio_prog).slice(0, 5);
  return (
    <Link className="res-item" href={r.os(o.id)}>
      <span className="res-icone" style={{ color: a.cor }}>
        <Icon name={a.icone} size={18} fill={a.cheio} />
      </span>
      <span className="res-corpo">
        <span className="res-linha">
          <span className={o.numero_ordem ? "res-num mono" : "res-num mono sem-numero"}>{o.numero_ordem ? destacar(o.numero_ordem, q) : "Sem nº"}</span>
          <span className="res-tit">{destacar(o.titulo, q)}</span>
        </span>
        <span className="res-det com-icone">
          <Icon name="pin" size={13} />
          <span>
            {destacar(o.local_instalacao.codigo, q)}
            {o.local_instalacao.cliente && <> · {destacar(o.local_instalacao.cliente, q)}</>}
            {o.numero_nota && <> · Nota {destacar(o.numero_nota, q)}</>}
          </span>
        </span>
        <span className={o.atrasada ? "res-det com-icone res-atraso" : "res-det com-icone"}>
          <Icon name="clock" size={13} />
          <span>
            {o.tipo === "preventiva" ? "Preventiva" : "Corretiva"} · Equipe {o.equipe_nome} · prog. até {programada}
            {o.atrasada && " · atrasada"}
          </span>
        </span>
        <span className="res-tags">
          <Badge tone={a.tom}>{rotuloDoStatus[o.status]}</Badge>
          {o.local_instalacao.critico && <Badge tone="crit">Crítico</Badge>}
        </span>
      </span>
      <Icon name="right" size={16} className="res-seta" />
    </Link>
  );
}

interface AvisoProps {
  icone: "search" | "info";
  titulo: string;
  children?: ReactNode;
}

/** Aviso que ocupa a área de resultados inteira (nada pesquisado ainda, ou nada encontrado). */
function Aviso({ icone, titulo, children }: AvisoProps) {
  return (
    <section className="busca-aviso-geral">
      <span className="busca-aviso-icone">
        <Icon name={icone} size={24} />
      </span>
      <h2>{titulo}</h2>
      {children}
    </section>
  );
}

interface PaginaBuscaProps {
  /** `web` é o painel de gestão; `app` é a área do técnico. */
  area: Area;
  consulta: Consulta;
}

/**
 * Página de resultados da busca global, em três seções: equipes, usuários e ordens de serviço. Tudo vive na URL (`q`,
 * filtros e páginas), então o resultado pode ser compartilhado e o "voltar" do navegador funciona.
 *
 * Cada seção traz só o que tem o texto em algum dos seus campos (ver `api/src/dominio/busca.ts`). A busca enviada pela
 * barra superior (ou pelo Enter no campo desta página) chega com `abrir=1`: se o texto é exatamente um item só (o e-mail
 * completo, a matrícula, o número da ordem...), abre direto a página dele em vez desta.
 */
export async function PaginaBusca({ area, consulta }: PaginaBuscaProps) {
  const caminho = area === "web" ? rotas.web.busca : rotas.app.busca;
  const { usuario } = await usuarioAtual();
  const admin = usuario.perfil === "admin";
  const veEquipes = usuario.perfil === "admin" || usuario.perfil === "analista" || usuario.perfil === "seguranca";

  const parametros = {
    q: um(consulta.q),
    mostrar: ["equipes", "usuarios", "os"].includes(um(consulta.mostrar) ?? "") ? um(consulta.mostrar) : undefined,
    tipo: ["preventiva", "corretiva"].includes(um(consulta.tipo) ?? "") ? um(consulta.tipo) : undefined,
    status: ordemDosStatus.includes(um(consulta.status) as OsStatus) ? um(consulta.status) : undefined,
    critica: um(consulta.critica) === "true" ? "true" : undefined,
    equipe: veEquipes ? um(consulta.equipe) : undefined,
    supervisor: veEquipes ? um(consulta.supervisor) : undefined,
    perfil: PERFIS.includes(um(consulta.perfil) as Perfil) ? um(consulta.perfil) : undefined,
    ativo: admin && ["true", "false"].includes(um(consulta.ativo) ?? "") ? um(consulta.ativo) : undefined,
  };
  const q = parametros.q;

  if (q && um(consulta.abrir) === "1") {
    const { achado } = await api<{ achado: AchadoExato | null }>("/busca/exata", { consulta: { q } });
    if (achado) redirect(enderecoDoAchado(area, achado));
  }

  const paginaOs = numero(um(consulta.po));
  const paginaUsuarios = numero(um(consulta.pu));
  const paginaEquipes = numero(um(consulta.pe));
  const filtrado = Object.entries(parametros).some(([chave, valor]) => chave !== "q" && chave !== "mostrar" && valor);
  // Escolher só o que mostrar (sem texto nem filtro) também lista: é a forma de ver todas as equipes, usuários ou OS.
  const procurando = Boolean(q) || filtrado || Boolean(parametros.mostrar);

  const mostrarEquipes = !parametros.mostrar || parametros.mostrar === "equipes";
  const mostrarUsuarios = !parametros.mostrar || parametros.mostrar === "usuarios";
  const mostrarOs = !parametros.mostrar || parametros.mostrar === "os";

  const [equipesApi, supervisoresApi, os, usuarios, equipes] = await Promise.all([
    api<{ equipes: Equipe[] }>("/equipes", { consulta: { tamanho: 200 } }),
    veEquipes ? api<{ usuarios: Usuario[] }>("/usuarios", { consulta: { perfil: "supervisor", ativo: admin ? true : undefined, tamanho: 200 } }) : null,
    procurando && mostrarOs
      ? api<RespostaOs>("/os", {
          consulta: { busca: q, tipo: parametros.tipo, status: parametros.status, critica: parametros.critica, equipe_id: parametros.equipe, pagina: paginaOs, tamanho: TAMANHO },
        })
      : null,
    procurando && mostrarUsuarios
      ? api<{ usuarios: Usuario[] } & Paginacao>("/usuarios", {
          consulta: { busca: q, perfil: parametros.perfil, equipe_id: parametros.equipe, ativo: parametros.ativo, pagina: paginaUsuarios, tamanho: TAMANHO },
        })
      : null,
    procurando && mostrarEquipes
      ? api<{ equipes: EquipeEncontrada[] } & Paginacao>("/equipes", {
          consulta: { global: true, busca: q, id: parametros.equipe, supervisor_id: parametros.supervisor, pagina: paginaEquipes, tamanho: TAMANHO_DAS_EQUIPES },
        })
      : null,
  ]);

  // Cada seção pagina sozinha: os links de uma mantêm a página das outras, e uma página além da última (endereço antigo ou
  // digitado) volta para a última que existe, em vez de mostrar a seção vazia com um total positivo.
  const paginasAtuais = {
    po: paginaOs > 1 ? String(paginaOs) : undefined,
    pu: paginaUsuarios > 1 ? String(paginaUsuarios) : undefined,
    pe: paginaEquipes > 1 ? String(paginaEquipes) : undefined,
  };
  const hrefDa = (troca: Record<string, string | undefined>) => endereco(caminho, { ...parametros, ...paginasAtuais }, troca);
  const alem: Record<string, string | undefined> = {};
  for (const [chave, resposta, pagina] of [["po", os, paginaOs], ["pu", usuarios, paginaUsuarios], ["pe", equipes, paginaEquipes]] as const) {
    if (resposta && pagina > ultimaPaginaDe(resposta)) alem[chave] = ultimaPaginaDe(resposta) > 1 ? String(ultimaPaginaDe(resposta)) : undefined;
  }
  if (Object.keys(alem).length > 0) redirect(hrefDa(alem));

  const nomeDaEquipe = new Map(equipesApi.equipes.map((e) => [e.id, e.nome]));
  const contagem = os?.contagem_por_status;
  const totalGeral = (os?.total ?? 0) + (usuarios?.total ?? 0) + (equipes?.total ?? 0);

  const subtitulo = !procurando
    ? "Procure ordens de serviço, usuários e equipes."
    : `${totalGeral} ${totalGeral === 1 ? "resultado" : "resultados"}${q ? ` para “${q}”` : " com os filtros escolhidos"}`;
  const colunas = Number(mostrarUsuarios) + Number(mostrarOs);

  return (
    <Screen className="busca-pagina">
      <header className="busca-cab">
        <h1>Busca</h1>
        <p className="muted" aria-live="polite">
          {subtitulo}
        </p>
      </header>

      <div className="busca-grade">
        <ColunaFiltros>
          <FiltrosBusca
            caminho={caminho}
            valores={{
              q: parametros.q ?? "",
              mostrar: parametros.mostrar ?? "",
              equipe: parametros.equipe ?? "",
              supervisor: parametros.supervisor ?? "",
              perfil: parametros.perfil ?? "",
              ativo: parametros.ativo ?? "",
              status: parametros.status ?? "",
              tipo: parametros.tipo ?? "",
              critica: parametros.critica ?? "",
            }}
            equipes={equipesApi.equipes.map((e) => ({ id: e.id, nome: e.nome }))}
            supervisores={supervisoresApi?.usuarios.map((u) => ({ id: u.id, nome: u.nome })) ?? []}
            contagem={contagem ?? null}
            perfis={PERFIS}
            admin={admin}
            veEquipes={veEquipes}
          />
        </ColunaFiltros>

        <div className="busca-resultados">
          {!procurando ? (
            <Aviso icone="search" titulo="O que você procura?">
              <p className="muted">Digite um nome, matrícula, nº da OS, nota ou cliente, ou veja tudo de um tipo:</p>
              <div className="busca-aviso-acoes">
                <Link className="btn btn-line btn-sm" href={endereco(caminho, {}, { mostrar: "equipes" })}>
                  <Icon name="users" size={16} />
                  Todas as equipes
                </Link>
                <Link className="btn btn-line btn-sm" href={endereco(caminho, {}, { mostrar: "usuarios" })}>
                  <Icon name="user" size={16} />
                  Todos os usuários
                </Link>
                <Link className="btn btn-line btn-sm" href={endereco(caminho, {}, { mostrar: "os" })}>
                  <Icon name="clip" size={16} />
                  Todas as OS
                </Link>
              </div>
            </Aviso>
          ) : totalGeral === 0 ? (
            <Aviso icone="info" titulo={q ? `Nada encontrado para “${q}”` : "Nada encontrado com esses filtros"}>
              <p className="muted">Confira a grafia, tente um trecho menor do texto{filtrado || parametros.mostrar ? " ou tire algum filtro" : ""}.</p>
              {(filtrado || parametros.mostrar) && (
                <div className="busca-aviso-acoes">
                  <Link className="btn btn-line btn-sm" href={endereco(caminho, { q })}>
                    Limpar filtros
                  </Link>
                </div>
              )}
            </Aviso>
          ) : (
            <>
              {mostrarEquipes && (
                <ColunaResultados
                  id="busca-equipes"
                  titulo="Equipes"
                  icone="users"
                  total={equipes?.total ?? 0}
                  vazio="Nenhuma equipe encontrada."
                  grade
                  paginacao={
                    equipes && <Paginador pagina={equipes.pagina} tamanho={equipes.tamanho} total={equipes.total} href={(p) => hrefDa({ pe: p > 1 ? String(p) : undefined })} />
                  }
                >
                  {equipes?.equipes.map((e) => <ResultadoEquipe key={e.id} area={area} equipe={e} q={q} />)}
                </ColunaResultados>
              )}

              {colunas > 0 && (
                <div className="busca-colunas" data-colunas={colunas}>
                  {mostrarUsuarios && (
                    <ColunaResultados
                      id="busca-usuarios"
                      titulo="Usuários"
                      icone="user"
                      total={usuarios?.total ?? 0}
                      vazio="Nenhum usuário encontrado."
                      paginacao={
                        usuarios && <Paginador pagina={usuarios.pagina} tamanho={usuarios.tamanho} total={usuarios.total} href={(p) => hrefDa({ pu: p > 1 ? String(p) : undefined })} />
                      }
                    >
                      {usuarios?.usuarios.map((u) => (
                        <ResultadoUsuario key={u.id} area={area} usuario={u} equipe={u.equipe_id ? nomeDaEquipe.get(u.equipe_id) : undefined} q={q} />
                      ))}
                    </ColunaResultados>
                  )}

                  {mostrarOs && (
                    <ColunaResultados
                      id="busca-os"
                      titulo="Ordens de serviço"
                      icone="clip"
                      total={os?.total ?? 0}
                      vazio="Nenhuma OS encontrada."
                      paginacao={os && <Paginador pagina={os.pagina} tamanho={os.tamanho} total={os.total} href={(p) => hrefDa({ po: p > 1 ? String(p) : undefined })} />}
                    >
                      {os?.os.map((o) => <ResultadoOs key={o.id} area={area} os={o} q={q} />)}
                    </ColunaResultados>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Screen>
  );
}
