import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CartaoOs } from "@/components/web/quadro/CartaoOs";
import { ColunaQuadro, aparenciaDoStatus } from "@/components/web/quadro/ColunaQuadro";
import { FaixaAlertas } from "@/components/web/quadro/FaixaAlertas";
import { FiltrosRecolhiveis } from "@/components/web/quadro/FiltrosRecolhiveis";
import { FiltrosQuadro } from "@/components/web/quadro/FiltrosQuadro";
import { KpisQuadro } from "@/components/web/quadro/KpisQuadro";
import { Paginas } from "@/components/web/quadro/Paginas";
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
import { rotas } from "@/lib/rotas";
import { rotuloDoStatus, type OsStatus } from "@/lib/tipos";

export const metadata: Metadata = { title: "Quadro de OS" };

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
    status: status && STATUS_VALIDOS.includes(status) ? status : undefined,
    pagina: Number.isInteger(pagina) && pagina > 0 ? pagina : undefined,
  };
}

/** Endereço do quadro com os filtros atuais, mais o que for passado (`undefined` tira o parâmetro). */
function hrefDoQuadro(f: FiltrosDoQuadro, mudar: Partial<Record<keyof FiltrosDoQuadro, string | number | undefined>> = {}) {
  const base: Record<string, string | number | boolean | undefined> = { ...f, ...mudar };
  const q = new URLSearchParams();
  for (const [chave, valor] of Object.entries(base)) if (valor !== undefined && valor !== "") q.set(chave, String(valor));
  const texto = q.toString();
  return texto ? `${rotas.web.quadro}?${texto}` : rotas.web.quadro;
}

export default async function QuadroPage({ searchParams }: PageProps<"/web/os/quadro">) {
  const filtros = lerFiltros(await searchParams);
  const { usuario, equipe } = await usuarioAtual();

  // A busca do quadro que casa exatamente com o número de uma ordem vai direto ao detalhe.
  if (filtros.busca) {
    const id = await osPorNumeroExato(filtros.busca);
    if (id) redirect(rotas.web.os(id));
  }

  const ehSupervisor = usuario.perfil === "supervisor";
  const [quadro, equipes, alertas] = await Promise.all([
    carregarQuadro(filtros),
    ehSupervisor ? Promise.resolve(null) : listarEquipes(),
    totalDeAlertasNaoLidos(usuario.perfil),
  ]);

  const nomeDaEquipe = ehSupervisor ? equipe?.nome : equipes?.find((e) => e.id === filtros.equipe_id)?.nome;
  const periodo = filtros.periodo ? rotuloDoMes(filtros.periodo) : "todos os períodos";
  const subtitulo = [nomeDaEquipe ?? "Todas as equipes", periodo, `atualizado às ${hora(new Date())}`].join(" · ");
  const filtrado = Boolean(filtros.equipe_id || filtros.tipo || filtros.critica || filtros.periodo || filtros.busca || filtros.status);
  const meses = mesesDoSeletor(hoje().slice(0, 7), filtros.periodo);

  const unica = filtros.status ? quadro.colunas[0] : undefined;

  // O título e as abas vêm do layout da seção; a importação, antes um botão aqui, é a aba ao lado.
  return (
    <>
      <span className="muted" style={{ fontSize: 14 }}>
        {subtitulo}
      </span>
      <KpisQuadro contagem={quadro.contagem} periodo={filtros.periodo ? periodo : "todas as datas"} />
      <FaixaAlertas total={alertas} />
      <FiltrosRecolhiveis filtrado={filtrado}><FiltrosQuadro equipes={equipes} meses={meses} valores={filtros} filtrado={filtrado} /></FiltrosRecolhiveis>

      {unica ? (
        <>
          <div className="row between wrap" style={{ alignItems: "center" }}>
            <span className="row g8" style={{ alignItems: "center" }}>
              <h2>{rotuloDoStatus[unica.status]}</h2>
              <span className="muted">{unica.total} OS</span>
            </span>
            <Link href={hrefDoQuadro(filtros, { status: undefined, pagina: undefined })} style={{ fontWeight: 600 }}>
              Voltar ao quadro
            </Link>
          </div>
          {unica.os.length === 0 ? (
            <p className="muted">Nenhuma OS com esses filtros.</p>
          ) : (
            <div className="bcol bcol-grade">
              {unica.os.map((o) => (
                <CartaoOs key={o.id} os={o} />
              ))}
            </div>
          )}
          <Paginas pagina={quadro.pagina} tamanho={quadro.tamanho} total={unica.total} hrefDa={(p) => hrefDoQuadro(filtros, { pagina: p })} />
        </>
      ) : (
        <>
          <div className="board">
            {quadro.colunas.map((coluna) => (
              <ColunaQuadro
                key={coluna.status}
                status={coluna.status}
                total={coluna.total}
                os={coluna.os}
                hrefTodas={hrefDoQuadro(filtros, { status: coluna.status, pagina: undefined })}
              />
            ))}
          </div>
          {quadro.contagem.cancelada > 0 && (
            <span className="muted">
              {quadro.contagem.cancelada === 1 ? "1 OS cancelada" : `${quadro.contagem.cancelada} OS canceladas`} ·{" "}
              <Link href={hrefDoQuadro(filtros, { status: "cancelada" })} style={{ color: aparenciaDoStatus.cancelada.cor, fontWeight: 600 }}>
                Ver canceladas
              </Link>
            </span>
          )}
        </>
      )}
    </>
  );
}
