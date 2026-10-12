import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Kpi, Panel } from "@/components/web/Panel";
import type { DashboardGeral as Dados } from "@/data/dashboards";
import { duracao } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { CabecalhoDoBloco, comparacao, Medidor, plural, porcentagem, Secao } from "./blocos";
import { COR_EM_DIA, MARCADOR_DO_STATUS } from "./cores";

interface ItemDeAtencao {
  icone: IconName;
  total: number;
  /** No singular e no plural. */
  texto: [string, string];
  href: string;
  acao: string;
}

/** "Precisa de atenção": cada linha é uma contagem de agora com o atalho para resolver; zerada, fica apagada. */
function ListaDeAtencao({ itens }: { itens: ItemDeAtencao[] }) {
  return (
    <ul className="atencao">
      {itens.map((i) => (
        <li key={i.texto[1]} data-zerado={i.total === 0 || undefined}>
          <Icon name={i.total === 0 ? "check" : i.icone} size={16} />
          <span className="grow">
            <strong>{i.total}</strong> {i.total === 1 ? i.texto[0] : i.texto[1]}
          </span>
          {i.total > 0 && (
            <Link href={i.href} className="small" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
              {i.acao}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

interface DashboardGeralProps {
  dados: Dados;
  rotuloAnterior: string;
  /** Alertas não lidos de quem está vendo (os mesmos do sino). */
  alertasNaoLidos: number;
  /** O admin faz a baixa no SAP: só ele vê a pendência. */
  verExportacao: boolean;
  /** O filtro atual (`periodo=…&equipe_id=…`), para os links aos outros dashboards. */
  consulta: string;
}

/**
 * Dashboard geral: a carteira de agora, o resumo do período, o que precisa de atenção e os resultados do período, com
 * atalhos para os dashboards de cada área.
 */
export function DashboardGeral({ dados, rotuloAnterior, alertasNaoLidos, verExportacao, consulta }: DashboardGeralProps) {
  const { carteira: c, encerradas: e, preventivas: p, aprs: a, tempo: t, pendencias: pend } = dados;
  const comFiltro = (href: string) => (consulta ? `${href}?${consulta}` : href);
  const abertas = c.liberadas + c.pendentes + c.em_execucao;
  const preventivas = p.encerradas + p.atrasadas_justificadas + p.atrasadas_sem_justificativa;

  const atencao: ItemDeAtencao[] = [
    { icone: "octagon", total: c.pendentes, texto: ["OS pendente, à espera de uma APR nova", "OS pendentes, à espera de uma APR nova"], href: `${rotas.web.quadro}?status=pendente`, acao: "Ver no quadro" },
    {
      icone: "alert",
      total: p.atrasadas_sem_justificativa,
      texto: ["preventiva atrasada sem justificativa no período", "preventivas atrasadas sem justificativa no período"],
      href: comFiltro(rotas.web.indicadoresOs),
      acao: "Ver no dashboard de OS",
    },
    { icone: "clock", total: pend.execucoes_esquecidas, texto: ["execução aberta há mais de 12 h", "execuções abertas há mais de 12 h"], href: `${rotas.web.quadro}?status=em_execucao`, acao: "Ver no quadro" },
    { icone: "user", total: pend.sem_ciencia, texto: ["OS encerrada sem a ciência do supervisor", "OS encerradas sem a ciência do supervisor"], href: `${rotas.web.quadro}?status=encerrada`, acao: "Ver no quadro" },
    ...(verExportacao
      ? [{ icone: "download", total: pend.a_exportar, texto: ["OS encerrada à espera da baixa no SAP", "OS encerradas à espera da baixa no SAP"], href: `${comFiltro(rotas.web.indicadoresOs)}#exportacao`, acao: "Exportar" } satisfies ItemDeAtencao]
      : []),
    { icone: "bell", total: alertasNaoLidos, texto: ["alerta não lido", "alertas não lidos"], href: rotas.web.alertas, acao: "Abrir alertas" },
    { icone: "list", total: pend.atividades_sem_modelo, texto: ["atividade sem modelo de APR", "atividades sem modelo de APR"], href: `${rotas.web.atividades}?sem_modelo=true`, acao: "Ligar a um modelo" },
  ];

  return (
    <>
      <Secao id="geral-agora-t" titulo="Agora" descricao="A carteira de OS neste momento; não depende do período.">
        <div className="kpis k4">
          <Kpi
            label="OS abertas"
            marker={<i style={{ background: MARCADOR_DO_STATUS.liberada }}></i>}
            value={abertas}
            sub={`${c.liberadas} liberadas · ${c.em_execucao} em execução`}
          />
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
            sub="liberadas ou pendentes depois da data"
          />
          <Kpi
            label="Em local crítico"
            marker={<Icon name="alert" size={13} style={{ color: "var(--ink3)" }} />}
            value={c.criticas}
            sub={c.apoio_abertas > 0 ? `abertas · ${plural(c.apoio_abertas, "OS de apoio aberta", "OS de apoio abertas")}` : "OS abertas em locais críticos"}
          />
        </div>
      </Secao>

      <Secao id="geral-periodo-t" titulo="No período" descricao="O que foi feito no período e na equipe do filtro.">
        <div className="kpis k4">
          <Kpi
            label="OS encerradas"
            marker={<Icon name="check" size={13} style={{ color: "var(--ink3)" }} />}
            value={e.total}
            sub={comparacao(e.total, e.anterior, rotuloAnterior)}
          />
          <Kpi
            label="APRs respondidas"
            marker={<Icon name="clip" size={13} style={{ color: "var(--ink3)" }} />}
            value={a.total}
            sub={a.total === 0 ? comparacao(0, a.anterior, rotuloAnterior) : `${porcentagem(a.bloqueadas, a.total)}% bloqueadas (${a.bloqueadas})`}
            subStyle={a.bloqueadas > 0 ? { color: "var(--blq)", fontWeight: 500 } : undefined}
          />
          <Kpi
            label="Tempo líquido médio"
            marker={<Icon name="clock" size={13} style={{ color: "var(--ink3)" }} />}
            value={t.tempo_liquido_medio_min === null ? "—" : duracao(t.tempo_liquido_medio_min)}
            sub={t.execucoes === 0 ? "nenhuma execução encerrada" : plural(t.execucoes, "execução encerrada", "execuções encerradas")}
          />
          <Kpi
            label="Interrupções por risco"
            marker={<Icon name="octagon" size={13} style={{ color: dados.interrupcoes > 0 ? "var(--blq)" : "var(--ink3)" }} />}
            value={dados.interrupcoes}
            sub="execuções paradas por risco no local"
          />
        </div>
      </Secao>

      <div className="two eq">
        <Panel>
          <CabecalhoDoBloco titulo="Precisa de atenção" descricao="Contagens de agora, cada uma com o atalho para resolver." />
          <ListaDeAtencao itens={atencao} />
        </Panel>
        <Panel>
          <CabecalhoDoBloco titulo="Resultados do período" descricao="As metas do dia a dia, no período e na equipe do filtro." />
          <ul className="lista-barras">
            <Medidor
              rotulo={
                <span className="row g6">
                  <Icon name="check" size={13} style={{ color: "var(--enc)" }} />
                  Preventivas em dia
                </span>
              }
              parte={p.encerradas}
              todo={preventivas}
              cor={COR_EM_DIA}
              detalhe={`${p.encerradas} encerradas de ${preventivas} programadas`}
              vazio="nenhuma preventiva programada"
            />
            <Medidor
              rotulo={
                <span className="row g6">
                  <Icon name="check" size={13} style={{ color: "var(--enc)" }} />
                  APRs aprovadas
                </span>
              }
              parte={a.total - a.bloqueadas}
              todo={a.total}
              cor={COR_EM_DIA}
              detalhe={`${a.total - a.bloqueadas} de ${a.total}`}
              vazio="nenhuma APR no período"
            />
          </ul>
          <div className="atalhos">
            <span className="small">Ver em detalhe:</span>
            <Link href={comFiltro(rotas.web.indicadoresEquipes)}>Equipes e usuários</Link>
            <Link href={comFiltro(rotas.web.indicadoresOs)}>OS</Link>
            <Link href={comFiltro(rotas.web.indicadoresApr)}>APR</Link>
          </div>
        </Panel>
      </div>
    </>
  );
}
