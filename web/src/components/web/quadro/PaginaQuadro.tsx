import Link from "next/link";
import { redirect } from "next/navigation";
import { CartaoOs } from "@/components/web/quadro/CartaoOs";
import { ColunaQuadro, aparenciaDoStatus } from "@/components/web/quadro/ColunaQuadro";
import { FaixaAlertas } from "@/components/web/quadro/FaixaAlertas";
import { FiltrosRecolhiveis } from "@/components/web/quadro/FiltrosRecolhiveis";
import { FiltrosQuadro } from "@/components/web/quadro/FiltrosQuadro";
import { OrdemDoQuadro } from "@/components/web/quadro/OrdemDoQuadro";
import { KpisQuadro } from "@/components/web/quadro/KpisQuadro";
import { Paginas } from "@/components/web/quadro/Paginas";
import { rotas } from "@/lib/rotas";
import {
  carregarQuadro,
  listarEquipes,
  mesesDoSeletor,
  osPorNumeroExato,
  rotuloDoMes,
  totalDeAlertasNaoLidos,
  type FiltrosDoQuadro,
} from "@/data/quadro";
import { usuarioAtual } from "@/lib/api";
import { hoje, hora } from "@/lib/formatar";
import { ehAdmin, ehSupervisor as supervisa, nomesDasEquipesDoSupervisor, rotuloDoStatus, type OsStatus } from "@/lib/tipos";

const STATUS_VALIDOS: OsStatus[] = ["liberada", "pendente", "em_execucao", "encerrada", "cancelada"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lê os filtros da URL, descartando o que não tem a forma esperada (a `api` recusaria com 422). */
function lerFiltros(sp: Record<string, string | string[] | undefined>): FiltrosDoQuadro {
  const um = (chave: string) => {
    const v = sp[chave];
    const texto = Array.isArray(v) ? v[0] : v;
    return texto?.trim() ? texto.trim() : undefined;
  };
  const tipo = um("tipo");
  const periodo = um("periodo");
  const equipe = um("equipe_id");
  const status = um("status") as OsStatus | undefined;
  const pagina = Number(um("pagina"));
  return {
    equipe_id: equipe && UUID.test(equipe) ? equipe : undefined,
    tipo: tipo === "preventiva" || tipo === "corretiva" ? tipo : undefined,
    critica: um("critica") === "true" ? true : undefined,
    periodo: periodo && /^\d{4}-(0[1-9]|1[0-2])$/.test(periodo) ? periodo : undefined,
    busca: um("busca"),
    ordem: um("ordem") === "data_limite" ? "data_limite" : undefined,
    status: status && STATUS_VALIDOS.includes(status) ? status : undefined,
    pagina: Number.isInteger(pagina) && pagina > 0 ? pagina : undefined,
  };
}

/** Endereço do quadro com os filtros atuais, mais o que for passado (`undefined` tira o parâmetro). */
function hrefDoQuadro(base: string, f: FiltrosDoQuadro, mudar: Partial<Record<keyof FiltrosDoQuadro, string | number | undefined>> = {}) {
  const todos: Record<string, string | number | boolean | undefined> = { ...f, ...mudar };
  const q = new URLSearchParams();
  for (const [chave, valor] of Object.entries(todos)) if (valor !== undefined && valor !== "") q.set(chave, String(valor));
  const texto = q.toString();
  return texto ? `${base}?${texto}` : base;
}

/**
 * Quadro de OS (kanban por status, com visão de um status só): a mesma tela e o mesmo endereço para admin, supervisor e técnico.
 * Admin e supervisor ganham a faixa de alertas e a situação de ciência e PDF nos cartões; só o admin escolhe a equipe.
 */
export async function PaginaQuadro({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filtros = lerFiltros(await searchParams);
  const { usuario, equipe } = await usuarioAtual();
  const rota = { quadro: rotas.app.lista, os: rotas.app.os };

  // A busca do quadro que casa exatamente com o número de uma ordem vai direto ao detalhe.
  if (filtros.busca) {
    const id = await osPorNumeroExato(filtros.busca);
    if (id) redirect(rota.os(id));
  }

  const admin = ehAdmin(usuario);
  const supervisor = supervisa(usuario);
  // Admin e supervisor acompanham as OS (alertas, ciência e PDF); o técnico comum só executa.
  const gestao = admin || supervisor;
  const [quadro, equipes, alertas] = await Promise.all([
    carregarQuadro(filtros),
    // Só o admin escolhe a equipe; os demais enxergam apenas as próprias.
    admin ? listarEquipes() : Promise.resolve(null),
    gestao ? totalDeAlertasNaoLidos(usuario) : Promise.resolve(0),
  ]);

  const nomeDaEquipe = admin ? equipes?.find((e) => e.id === filtros.equipe_id)?.nome : supervisor ? nomesDasEquipesDoSupervisor(usuario) : equipe?.nome;
  const periodo = filtros.periodo ? rotuloDoMes(filtros.periodo) : "todos os períodos";
  const subtitulo = [nomeDaEquipe ?? "Todas as equipes", periodo, `atualizado às ${hora(new Date())}`].join(" · ");
  const filtrado = Boolean(filtros.equipe_id || filtros.tipo || filtros.critica || filtros.periodo || filtros.busca || filtros.status);
  const meses = mesesDoSeletor(hoje().slice(0, 7), filtros.periodo);

  const unica = filtros.status ? quadro.colunas[0] : undefined;

  return (
    <>
      <span className="muted" style={{ fontSize: 14 }}>
        {subtitulo}
      </span>
      <KpisQuadro contagem={quadro.contagem} periodo={filtros.periodo ? periodo : "todas as datas"} />
      <OrdemDoQuadro atual={filtros.ordem ?? "prioridade"} hrefDa={(ordem) => hrefDoQuadro(rota.quadro, filtros, { ordem: ordem === "prioridade" ? undefined : ordem, pagina: undefined })} />
      {gestao && <FaixaAlertas total={alertas} />}
      <FiltrosRecolhiveis filtrado={filtrado}>
        <FiltrosQuadro acao={rota.quadro} equipes={equipes} meses={meses} valores={filtros} filtrado={filtrado} />
      </FiltrosRecolhiveis>

      {unica ? (
        <>
          <div className="row between wrap" style={{ alignItems: "center" }}>
            <span className="row g8" style={{ alignItems: "center" }}>
              <h2>{rotuloDoStatus[unica.status]}</h2>
              <span className="muted">{unica.total} OS</span>
            </span>
            <Link href={hrefDoQuadro(rota.quadro, filtros, { status: undefined, pagina: undefined })} style={{ fontWeight: 600 }}>
              Voltar ao quadro
            </Link>
          </div>
          {unica.os.length === 0 ? (
            <p className="muted">Nenhuma OS com esses filtros.</p>
          ) : (
            <div className="bcol bcol-grade">
              {unica.os.map((o) => (
                <CartaoOs key={o.id} os={o} gestao={gestao} />
              ))}
            </div>
          )}
          <Paginas pagina={quadro.pagina} tamanho={quadro.tamanho} total={unica.total} hrefDa={(p) => hrefDoQuadro(rota.quadro, filtros, { pagina: p })} />
        </>
      ) : (
        <>
          <div className="board">
            {quadro.colunas.map((coluna) => (
              <ColunaQuadro
                key={coluna.status}
                gestao={gestao}
               
                status={coluna.status}
                total={coluna.total}
                os={coluna.os}
                hrefTodas={hrefDoQuadro(rota.quadro, filtros, { status: coluna.status, pagina: undefined })}
              />
            ))}
          </div>
          {quadro.contagem.cancelada > 0 && (
            <span className="muted">
              {quadro.contagem.cancelada === 1 ? "1 OS cancelada" : `${quadro.contagem.cancelada} OS canceladas`} ·{" "}
              <Link href={hrefDoQuadro(rota.quadro, filtros, { status: "cancelada" })} style={{ color: aparenciaDoStatus.cancelada.cor, fontWeight: 600 }}>
                Ver canceladas
              </Link>
            </span>
          )}
        </>
      )}
    </>
  );
}
