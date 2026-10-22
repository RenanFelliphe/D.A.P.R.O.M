import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Kpi, Panel } from "@/components/web/Panel";
import type { ResumoDasImportacoes } from "@/components/web/importacao/tipos";
import type { DashboardOs as Dados, MapaDeCalorDoPeriodo } from "@/data/dashboards";
import type { OsDoQuadro } from "@/data/quadro";
import { dataHora } from "@/lib/formatar";
import { aparenciaDaSituacao, type ContagemDosCiclos } from "@/lib/preventivas";
import { rotas } from "@/lib/rotas";
import { CabecalhoDoBloco, comparacao, plural, porcentagem, Secao } from "./blocos";
import { COR_AVISO, COR_CORRETIVA, COR_CRITICA, COR_EM_DIA, COR_PREVENTIVA, COR_UNICA } from "./cores";
import { EntradaDeOs } from "./EntradaDeOs";
import { ExportacaoSap } from "./ExportacaoSap";
import { GraficoColunas, type SerieDoGrafico } from "./GraficoColunas";
import { MapaDoDashboard, type SituacaoDoMapa } from "./MapaDoDashboard";
import { PrecisaDeAtencao } from "./PrecisaDeAtencao";
import { TempoDoPeriodo } from "./TempoDeExecucao";

export const nomeDaUnidade = { dia: "dia", semana: "semana", mes: "mês" } as const;

export const SERIES_POR_TIPO: SerieDoGrafico[] = [
  { chave: "corretivas", nome: "Corretivas", cor: COR_CORRETIVA },
  { chave: "preventivas", nome: "Preventivas", cor: COR_PREVENTIVA },
];

/** As três situações das preventivas do período, com a fatia de cada uma (cores de estado, com ícone). */
function PreventivasDoPeriodo({ preventivas }: { preventivas: Dados["preventivas"] }) {
  const linhas = [
    { chave: "enc", nome: "Encerradas", icone: "check" as const, cor: COR_EM_DIA, total: preventivas.encerradas },
    { chave: "just", nome: "Atrasadas com justificativa", icone: "alert" as const, cor: COR_AVISO, total: preventivas.atrasadas_justificadas },
    { chave: "sem", nome: "Atrasadas sem justificativa", icone: "octagon" as const, cor: COR_CRITICA, total: preventivas.atrasadas_sem_justificativa },
  ];
  const total = linhas.reduce((t, l) => t + l.total, 0);
  return (
    <Panel>
      <CabecalhoDoBloco
        titulo="Programadas no período"
        descricao={total === 0 ? "Pela data programada; nenhuma encerrada ou atrasada" : `${plural(total, "preventiva programada", "preventivas programadas")}, pela data programada`}
      />
      {total === 0 ? (
        <p className="muted">Nenhuma preventiva programada no período.</p>
      ) : (
      <ul className="lista-barras">
        {linhas.map((l) => (
          <li key={l.chave}>
            <div className="row between g8" style={{ alignItems: "baseline" }}>
              <span className="row g6">
                <Icon name={l.icone} size={13} style={{ color: l.cor }} />
                {l.nome}
              </span>
              <span style={{ whiteSpace: "nowrap" }}>
                <strong>{l.total}</strong> <span className="small">· {porcentagem(l.total, total)}%</span>
              </span>
            </div>
            <div className="trilho" aria-hidden="true">
              {l.total > 0 && <i style={{ width: `${porcentagem(l.total, total)}%`, background: l.cor }}></i>}
            </div>
          </li>
        ))}
      </ul>
      )}
    </Panel>
  );
}

/**
 * O ciclo das preventivas agora (não depende do período): quantos planos venceram sem OS nova, vencem dentro da
 * antecedência, aguardam a execução da OS do ciclo ou estão em dia, e quantos ainda não têm intervalo.
 */
function CiclosDasPreventivas({ ciclos, comAtalho }: { ciclos: ContagemDosCiclos; comAtalho: boolean }) {
  const situacoes = ["vencido", "proximo", "aguardando_execucao", "em_dia"] as const;
  const subtitulos = {
    vencido: "venceram sem OS nova do plano",
    proximo: "vencem dentro da antecedência",
    aguardando_execucao: "OS do ciclo ainda não executada",
    em_dia: "próximo ciclo longe do vencimento",
  };
  return (
    <Panel>
      <CabecalhoDoBloco
        titulo={
          <span className="row g8">
            <Icon name="clock" size={16} style={{ color: "var(--ink3)" }} />
            Ciclo dos planos, agora
          </span>
        }
        descricao={
          ciclos.total === 0
            ? "Nenhuma preventiva com plano de manutenção"
            : `${plural(ciclos.total, "plano de manutenção", "planos de manutenção")}${ciclos.sem_intervalo > 0 ? ` · ${ciclos.sem_intervalo} sem intervalo definido` : ""}${ciclos.pausado > 0 ? ` · ${ciclos.pausado} pausados` : ""}`
        }
      />
      <div className="kpis k2">
        {situacoes.map((s) => (
          <Kpi
            key={s}
            label={aparenciaDaSituacao[s].rotulo}
            marker={<i style={{ background: aparenciaDaSituacao[s].cor }}></i>}
            value={ciclos[s]}
            sub={subtitulos[s]}
            subStyle={(s === "vencido" || s === "proximo") && ciclos[s] > 0 ? { color: aparenciaDaSituacao[s].cor, fontWeight: 500 } : undefined}
          />
        ))}
      </div>
      {comAtalho && ciclos.total > 0 && (
        <Link href={rotas.app.preventivas} style={{ fontSize: 14, fontWeight: 600 }}>
          Abrir as OS preventivas
        </Link>
      )}
    </Panel>
  );
}

export function Interrupcoes({ interrupcoes }: { interrupcoes: Dados["interrupcoes"] }) {
  return (
    <Panel>
      <CabecalhoDoBloco
        titulo={
          <span className="row g8">
            <Icon name="octagon" size={16} style={{ color: "var(--blq)" }} />
            Interrupções por risco
          </span>
        }
        descricao={interrupcoes.total === 0 ? "Execuções paradas por risco no local" : `${plural(interrupcoes.total, "execução parada", "execuções paradas")} por risco no local; as mais recentes`}
      />
      {interrupcoes.total === 0 ? (
        <p className="muted">Nenhuma interrupção no período.</p>
      ) : (
        <ul className="uso-lista">
          {interrupcoes.recentes.map((i) => (
            <li key={`${i.os_id}-${i.fim}`}>
              <Link href={rotas.app.os(i.os_id)} className="mono">
                {i.numero_ordem ? `OS ${i.numero_ordem}` : "OS de apoio"}
              </Link>
              <span>{i.motivo ?? "Sem motivo informado"}</span>
              {/* Sem o nome quando a `api` não o entrega (técnico) ou quando é o da própria pessoa. */}
              <span className="small">{i.executor ? `${i.executor} · ${dataHora(i.fim)}` : dataHora(i.fim)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function Locais({ locais, descricao = "Onde as equipes mais trabalharam no período" }: { locais: Dados["locais"]; descricao?: string }) {
  const maior = Math.max(1, ...locais.map((l) => l.encerradas));
  return (
    <Panel>
      <CabecalhoDoBloco titulo="Locais com mais OS encerradas" descricao={descricao} />
      {locais.length === 0 ? (
        <p className="muted">Nenhuma OS encerrada no período.</p>
      ) : (
        <ul className="lista-barras">
          {locais.map((l) => (
            <li key={l.id}>
              <div className="row between g8" style={{ alignItems: "baseline" }}>
                <span className="row g6 wrap">
                  <span className="mono" style={{ fontSize: 13 }}>
                    {l.codigo}
                  </span>
                  {l.critico && <Badge tone="crit">Crítico</Badge>}
                </span>
                <strong>{l.encerradas}</strong>
              </div>
              <div className="trilho" aria-hidden="true">
                <i style={{ width: `${(l.encerradas / maior) * 100}%`, background: COR_UNICA }}></i>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

interface DashboardOsProps {
  dados: Dados;
  rotuloAnterior: string;
  /** O mapa de calor do período (`GET /os/mapa-calor`), com a situação das OS que ele mostra e o filtro do painel. */
  mapa: MapaDeCalorDoPeriodo;
  situacaoDoMapa: SituacaoDoMapa;
  filtro: { periodo: string; equipeId?: string };
  /** Entrada de OS (`GET /importacoes/resumo`): só o admin. */
  entrada: ResumoDasImportacoes | null;
  /** Baixa no SAP (as encerradas ainda não exportadas): só o admin. */
  exportacao: { total: number; os: OsDoQuadro[] } | null;
  /** Admin e supervisor: a nota do tempo aponta para o detalhe por técnico, que o técnico comum não tem. */
  porTecnico: boolean;
  /** O ciclo das preventivas agora (`GET /preventivas`); nulo se não carregou. */
  ciclos?: ContagemDosCiclos | null;
  /** Alertas não lidos de quem está vendo (os mesmos do sino); `null` para o técnico, que não os recebe. */
  alertasNaoLidos: number | null;
}

/**
 * Dashboard de OS: o que precisa de atenção, o mapa de calor (o destaque, com as áreas mais movimentadas), as preventivas
 * (o ciclo dos planos e as programadas no período), os resultados do período (OS encerradas, tempo de execução e
 * interrupções por risco); para o admin, a entrada de OS e a baixa no SAP. A carteira de agora fica no quadro de OS.
 */
export function DashboardOs({ dados, rotuloAnterior, mapa, situacaoDoMapa, filtro, entrada, exportacao, porTecnico, ciclos, alertasNaoLidos }: DashboardOsProps) {
  const { encerradas: e } = dados;
  const unidade = nomeDaUnidade[dados.agrupamento];
  const pontos = dados.serie.map((p) => ({ inicio: p.inicio, fim: p.fim, valores: { corretivas: p.corretivas, preventivas: p.preventivas } }));

  return (
    <>
      <PrecisaDeAtencao dados={dados} alertasNaoLidos={alertasNaoLidos} verExportacao={exportacao !== null} acompanha={porTecnico} />

      <MapaDoDashboard mapa={mapa} situacao={situacaoDoMapa} filtro={filtro} />

      <Secao id="os-preventivas-t" titulo="Preventivas" descricao="Os planos de manutenção agora e as preventivas programadas no período.">
        {ciclos ? (
          <div className="two eq" style={{ alignItems: "stretch" }}>
            <CiclosDasPreventivas ciclos={ciclos} comAtalho={porTecnico} />
            <PreventivasDoPeriodo preventivas={dados.preventivas} />
          </div>
        ) : (
          <PreventivasDoPeriodo preventivas={dados.preventivas} />
        )}
      </Secao>

      <Secao id="os-resultados-t" titulo="Resultados do período" descricao="Encerradas pelo fim da execução; tempo e interrupções das execuções do período.">
        <Panel>
          <CabecalhoDoBloco
            titulo={`OS encerradas por ${unidade}`}
            descricao={
              e.total === 0
                ? "Corretivas e preventivas, pelo fim da execução"
                : `${e.corretivas} corretivas e ${e.preventivas} preventivas · ${comparacao(e.total, e.anterior, rotuloAnterior)}`
            }
          />
          <GraficoColunas pontos={pontos} series={SERIES_POR_TIPO} agrupamento={dados.agrupamento} medida="OS encerradas" vazio="Nenhuma OS encerrada neste período." />
        </Panel>
        <div className="two eq" style={{ alignItems: "stretch" }}>
          <TempoDoPeriodo tempo={dados.tempo} rodape={porTecnico ? "Por equipe e por técnico no dashboard de equipes e usuários." : "Da equipe toda, sem separar por pessoa."} />
          <Interrupcoes interrupcoes={dados.interrupcoes} />
        </div>
      </Secao>

      {entrada && <EntradaDeOs resumo={entrada} />}

      {exportacao && (
        <section id="exportacao" className="stack g12" aria-label="Exportação para o SAP">
          <ExportacaoSap total={exportacao.total} os={exportacao.os} />
        </section>
      )}
    </>
  );
}
