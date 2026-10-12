import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Kpi, Panel } from "@/components/web/Panel";
import type { ResumoDasImportacoes } from "@/components/web/importacao/tipos";
import type { DashboardOs as Dados } from "@/data/dashboards";
import type { OsDoQuadro } from "@/data/quadro";
import { dataHora, duracao } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { CabecalhoDoBloco, comparacao, plural, porcentagem, Secao } from "./blocos";
import { COR_AVISO, COR_CORRETIVA, COR_CRITICA, COR_EM_DIA, COR_PREVENTIVA, COR_UNICA, MARCADOR_DO_STATUS } from "./cores";
import { EntradaDeOs } from "./EntradaDeOs";
import { ExportacaoSap } from "./ExportacaoSap";
import { GraficoColunas, type SerieDoGrafico } from "./GraficoColunas";

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
        titulo="Preventivas do período"
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

/** Tempo médio das execuções encerradas no período (iniciadas nele): líquido, pausa e a parte do tempo em pausa. */
export function TempoDoPeriodo({ tempo, rodape }: { tempo: Dados["tempo"]; rodape?: string }) {
  const dados = [
    { rotulo: "Tempo líquido médio", valor: duracao(tempo.tempo_liquido_medio_min) },
    { rotulo: "Pausa média", valor: duracao(tempo.pausa_media_min) },
    { rotulo: "Pausa no total", valor: tempo.proporcao_pausa === null ? "—" : `${Math.round(tempo.proporcao_pausa * 100)}%` },
  ];
  return (
    <Panel>
      <CabecalhoDoBloco
        titulo="Tempo de execução"
        descricao={
          tempo.execucoes === 0
            ? "Nenhuma execução encerrada no período"
            : `Média de ${plural(tempo.execucoes, "execução encerrada", "execuções encerradas")}; o líquido não conta as pausas`
        }
      />
      <dl className="dl">
        {dados.map((d) => (
          <div key={d.rotulo}>
            <dt>{d.rotulo}</dt>
            <dd style={{ fontSize: 18, fontWeight: 600 }}>{d.valor}</dd>
          </div>
        ))}
      </dl>
      {rodape && <span className="small">{rodape}</span>}
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
  /** Entrada de OS (`GET /importacoes/resumo`): só o admin. */
  entrada: ResumoDasImportacoes | null;
  /** Baixa no SAP (as encerradas ainda não exportadas): só o admin. */
  exportacao: { total: number; os: OsDoQuadro[] } | null;
  /** Admin e supervisor: a nota do tempo aponta para o detalhe por técnico, que o técnico comum não tem. */
  porTecnico: boolean;
}

/**
 * Dashboard de OS: a carteira de agora, as programadas e encerradas no período (por tipo e por faixa), as preventivas,
 * o tempo, as interrupções por risco e os locais; para o admin, a entrada de OS e a baixa no SAP.
 */
export function DashboardOs({ dados, rotuloAnterior, entrada, exportacao, porTecnico }: DashboardOsProps) {
  const { carteira: c, programadas: prog, encerradas: e } = dados;
  const unidade = nomeDaUnidade[dados.agrupamento];
  const pontos = dados.serie.map((p) => ({ inicio: p.inicio, fim: p.fim, valores: { corretivas: p.corretivas, preventivas: p.preventivas } }));

  return (
    <>
      <Secao id="os-carteira-t" titulo="Carteira agora" descricao="As OS abertas neste momento; não depende do período.">
        <div className="kpis k4">
          <Kpi label="Liberadas" marker={<i style={{ background: MARCADOR_DO_STATUS.liberada }}></i>} value={c.liberadas} sub="à espera de APR e execução" />
          <Kpi label="Em execução" marker={<i style={{ background: MARCADOR_DO_STATUS.em_execucao }}></i>} value={c.em_execucao} sub="em campo agora" />
          <Kpi
            label="Pendentes"
            marker={<i style={{ background: MARCADOR_DO_STATUS.pendente }}></i>}
            value={c.pendentes}
            sub="à espera de uma APR nova"
            subStyle={c.pendentes > 0 ? { color: "var(--blq)", fontWeight: 500 } : undefined}
          />
          <Kpi
            label="Atrasadas"
            marker={<Icon name="clock" size={13} style={{ color: c.atrasadas > 0 ? "var(--al)" : "var(--ink3)" }} />}
            value={c.atrasadas}
            sub={`${plural(c.criticas, "aberta", "abertas")} em local crítico${c.apoio_abertas > 0 ? ` · ${c.apoio_abertas} de apoio` : ""}`}
          />
        </div>
      </Secao>

      <Secao id="os-periodo-t" titulo="No período" descricao="Programadas pela data de início; encerradas pelo fim da execução.">
        <div className="kpis k4">
          <Kpi
            label="Programadas"
            marker={<Icon name="cal" size={13} style={{ color: "var(--ink3)" }} />}
            value={prog.total}
            sub={`${prog.corretivas} corretivas · ${prog.preventivas} preventivas${prog.canceladas > 0 ? ` · ${prog.canceladas} canceladas` : ""}`}
          />
          <Kpi label="Encerradas" marker={<Icon name="check" size={13} style={{ color: "var(--ink3)" }} />} value={e.total} sub={comparacao(e.total, e.anterior, rotuloAnterior)} />
          <Kpi label="Reprogramações" marker={<Icon name="refresh" size={13} style={{ color: "var(--ink3)" }} />} value={dados.reprogramacoes} sub="datas ou equipes mudadas no período" />
          <Kpi
            label="Interrupções por risco"
            marker={<Icon name="octagon" size={13} style={{ color: dados.interrupcoes.total > 0 ? "var(--blq)" : "var(--ink3)" }} />}
            value={dados.interrupcoes.total}
            sub="execuções paradas por risco"
          />
        </div>
        <Panel>
          <CabecalhoDoBloco
            titulo={`OS encerradas por ${unidade}`}
            descricao={e.total === 0 ? "Corretivas e preventivas, pelo fim da execução" : `${e.corretivas} corretivas e ${e.preventivas} preventivas, pelo fim da execução`}
          />
          <GraficoColunas pontos={pontos} series={SERIES_POR_TIPO} agrupamento={dados.agrupamento} medida="OS encerradas" vazio="Nenhuma OS encerrada neste período." />
        </Panel>
        <div className="two eq">
          <PreventivasDoPeriodo preventivas={dados.preventivas} />
          <TempoDoPeriodo tempo={dados.tempo} rodape={porTecnico ? "Por equipe e por técnico no dashboard de equipes e usuários." : "Da equipe toda, sem separar por pessoa."} />
        </div>
        <div className="two eq">
          <Interrupcoes interrupcoes={dados.interrupcoes} />
          <Locais locais={dados.locais} />
        </div>
      </Secao>

      {entrada && <EntradaDeOs resumo={entrada} rotuloAnterior={rotuloAnterior} />}

      {exportacao && (
        <section id="exportacao" className="stack g12" aria-label="Exportação para o SAP">
          <ExportacaoSap total={exportacao.total} os={exportacao.os} />
        </section>
      )}
    </>
  );
}
