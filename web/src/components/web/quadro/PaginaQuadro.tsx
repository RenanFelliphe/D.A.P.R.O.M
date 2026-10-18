import Link from "next/link";
import { redirect } from "next/navigation";
import { CartaoOs } from "@/components/web/quadro/CartaoOs";
import { ColunaAssinaturas } from "@/components/web/quadro/ColunaAssinaturas";
import { ColunaQuadro, aparenciaDoStatus } from "@/components/web/quadro/ColunaQuadro";
import { FaixaAlertas } from "@/components/web/quadro/FaixaAlertas";
import { FiltrosRecolhiveis } from "@/components/web/quadro/FiltrosRecolhiveis";
import { FiltrosQuadro } from "@/components/web/quadro/FiltrosQuadro";
import { OrdemDoQuadro } from "@/components/web/quadro/OrdemDoQuadro";
import { KpisQuadro } from "@/components/web/quadro/KpisQuadro";
import { Paginas } from "@/components/web/quadro/Paginas";
import { BotaoPreventivas } from "@/components/web/preventivas/BotaoPreventivas";
import { rotas } from "@/lib/rotas";
import {
  carregarQuadro,
  listarEquipes,
  mesesDoSeletor,
  osPorNumeroExato,
  preventivasEmAtencao,
  rotuloDoMes,
  totalDeAlertasNaoLidos,
  type FiltrosDoQuadro,
} from "@/data/quadro";
import { usuarioAtual } from "@/lib/api";
import { hoje, hora } from "@/lib/formatar";
import { ehAdmin, ehSupervisor as supervisa, nomesDasEquipesDoSupervisor, rotuloDoStatus, type OsStatus } from "@/lib/tipos";

const STATUS_VALIDOS: OsStatus[] = ["liberada", "pendente", "em_execucao", "encerrando", "aguardando_supervisor", "encerrada", "cancelada", "devolvida"];
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
 * Admin e supervisor ganham a faixa de alertas e a situação da assinatura final e do PDF nos cartões; as OS que esperam assinaturas (`encerrando` e `aguardando_supervisor`) dividem a coluna "Aguardando assinaturas"; só o admin escolhe a equipe.
 */
export async function PaginaQuadro({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parametros = await searchParams;
  const filtros = lerFiltros(parametros);
  // `?preventivas=1` abre a janela das preventivas (o atalho do alerta de ciclo).
  const abrirPreventivas = parametros.preventivas === "1";
  const { usuario, equipe } = await usuarioAtual();
  const rota = { quadro: rotas.app.lista, os: rotas.app.os };

  // A busca do quadro que casa exatamente com o número de uma ordem vai direto ao detalhe.
  if (filtros.busca) {
    const id = await osPorNumeroExato(filtros.busca);
    if (id) redirect(rota.os(id));
  }

  const admin = ehAdmin(usuario);
  const supervisor = supervisa(usuario);
  // Admin e supervisor acompanham as OS (alertas, assinatura final e PDF); o técnico comum só executa.
  const gestao = admin || supervisor;
  const [quadro, equipes, alertas, preventivas] = await Promise.all([
    carregarQuadro(filtros),
    // Só o admin escolhe a equipe; os demais enxergam apenas as próprias.
    admin ? listarEquipes() : Promise.resolve(null),
    gestao ? totalDeAlertasNaoLidos(usuario) : Promise.resolve(0),
    // A janela das preventivas é de quem planeja: admin e supervisor.
    gestao ? preventivasEmAtencao(filtros.equipe_id) : Promise.resolve(0),
  ]);

  const nomeDaEquipe = admin ? equipes?.find((e) => e.id === filtros.equipe_id)?.nome : supervisor ? nomesDasEquipesDoSupervisor(usuario) : equipe?.nome;
  const periodo = filtros.periodo ? rotuloDoMes(filtros.periodo) : "todos os períodos";
  const subtitulo = [nomeDaEquipe ?? "Todas as equipes", periodo, `atualizado às ${hora(new Date())}`].join(" · ");
  // A visão de um status só e a ordenação não são filtros: o "Limpar" as mantém ("Voltar ao quadro" sai da visão).
  const filtrado = Boolean(filtros.equipe_id || filtros.tipo || filtros.critica || filtros.periodo || filtros.busca);
  const meses = mesesDoSeletor(hoje().slice(0, 7), filtros.periodo);

  const unica = filtros.status ? quadro.colunas[0] : undefined;

  return (
    <>
      <span className="muted" style={{ fontSize: 14 }}>
        {subtitulo}
      </span>
      <KpisQuadro contagem={quadro.contagem} periodo={filtros.periodo ? periodo : "todas as datas"} />
      <div className="row between wrap g8" style={{ alignItems: "center" }}>
        <OrdemDoQuadro atual={filtros.ordem ?? "prioridade"} hrefDa={(ordem) => hrefDoQuadro(rota.quadro, filtros, { ordem: ordem === "prioridade" ? undefined : ordem, pagina: undefined })} />
        {gestao && <BotaoPreventivas atencao={preventivas} equipeId={filtros.equipe_id} abrirAoCarregar={abrirPreventivas} />}
      </div>
      {gestao && <FaixaAlertas total={alertas} />}
      <FiltrosRecolhiveis filtrado={filtrado}>
        <FiltrosQuadro acao={rota.quadro} equipes={equipes} meses={meses} valores={filtros} manter={{ ordem: filtros.ordem, status: filtros.status }} filtrado={filtrado} />
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
                <CartaoOs key={o.id} os={o} gestao={gestao} usuarioId={usuario.id} />
              ))}
            </div>
          )}
          <Paginas pagina={quadro.pagina} tamanho={quadro.tamanho} total={unica.total} hrefDa={(p) => hrefDoQuadro(rota.quadro, filtros, { pagina: p })} />
        </>
      ) : (
        <>
          <div className="board">
            {quadro.colunas.map((coluna) =>
              coluna.status === "encerrando" ? null : coluna.status === "aguardando_supervisor" ? (
                <ColunaAssinaturas
                  key="assinaturas"
                  gestao={gestao}
                  usuarioId={usuario.id}
                  colunas={quadro.colunas.filter((c) => c.status === "aguardando_supervisor" || c.status === "encerrando")}
                  hrefTodas={(status) => hrefDoQuadro(rota.quadro, filtros, { status, pagina: undefined })}
                />
              ) : (
                <ColunaQuadro
                  key={coluna.status}
                  gestao={gestao}
                  usuarioId={usuario.id}
                  status={coluna.status}
                  total={coluna.total}
                  os={coluna.os}
                  hrefTodas={hrefDoQuadro(rota.quadro, filtros, { status: coluna.status, pagina: undefined })}
                />
              ),
            )}
          </div>
          {quadro.contagem.cancelada > 0 && (
            <span className="muted">
              {quadro.contagem.cancelada === 1 ? "1 OS cancelada" : `${quadro.contagem.cancelada} OS canceladas`} ·{" "}
              <Link href={hrefDoQuadro(rota.quadro, filtros, { status: "cancelada" })} style={{ color: aparenciaDoStatus.cancelada.cor, fontWeight: 600 }}>
                Ver canceladas
              </Link>
            </span>
          )}
          {quadro.contagem.devolvida > 0 && (
            <span className="muted">
              {quadro.contagem.devolvida === 1 ? "1 OS devolvida ao SAP" : `${quadro.contagem.devolvida} OS devolvidas ao SAP`} ·{" "}
              <Link href={hrefDoQuadro(rota.quadro, filtros, { status: "devolvida" })} style={{ color: aparenciaDoStatus.devolvida.cor, fontWeight: 600 }}>
                Ver devolvidas
              </Link>
            </span>
          )}
        </>
      )}
    </>
  );
}
