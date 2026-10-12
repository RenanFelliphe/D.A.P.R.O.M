import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { CabecalhoDoBloco, comparacao, plural, porcentagem, Secao } from "@/components/web/indicadores/blocos";
import { GraficoColunas, type PontoDoGrafico, type SerieDoGrafico } from "./GraficoColunas";
import { Kpi, Panel } from "@/components/web/Panel";
import { rotuloSecao, type ItemReprovado, type ResumoDasAprs } from "@/data/modelos";
import { rotas } from "@/lib/rotas";

/**
 * O bloqueio é o ponto do painel: vermelho de estado crítico, sempre com ícone. A aprovada é contexto e fica em cinza;
 * o par foi validado no script de paleta (ΔE 13 na deuteranopia, onde o verde de estado ficaria em 4, indistinguível
 * do vermelho) e o cinza tem 3:1 de contraste no fundo branco. O âmbar é o estado de aviso, para os alertas.
 */
const BLOQUEADA = "#D03B3B";
const APROVADA = "#8A949F";
const ALERTA = "#C98500";

const SERIES: SerieDoGrafico[] = [
  { chave: "bloqueadas", nome: "Bloqueadas", cor: BLOQUEADA, icone: "octagon" },
  { chave: "aprovadas", nome: "Aprovadas", cor: APROVADA, icone: "check" },
];

const EQUIPES_VISIVEIS = 8;
const nomeDaUnidade = { dia: "dia", semana: "semana", mes: "mês" } as const;

/** Respondidas (com a comparação), bloqueadas e a taxa, alertas registrados e as APRs sem modelo ligado à atividade. */
function Contadores({ resumo, rotuloAnterior }: { resumo: ResumoDasAprs; rotuloAnterior: string }) {
  const { totais, anterior } = resumo;
  const taxaAnterior = anterior.aprs > 0 ? ` · ${rotuloAnterior}: ${porcentagem(anterior.bloqueadas, anterior.aprs)}%` : "";
  return (
    <div className="kpis k4">
      <Kpi
        label="APRs respondidas"
        marker={<Icon name="clip" size={13} style={{ color: "var(--ink3)" }} />}
        value={totais.aprs}
        sub={comparacao(totais.aprs, anterior.aprs, rotuloAnterior)}
      />
      <Kpi
        label="Bloqueadas"
        marker={<Icon name="octagon" size={13} style={{ color: totais.bloqueadas > 0 ? "var(--blq)" : "var(--ink3)" }} />}
        value={totais.bloqueadas}
        sub={totais.aprs === 0 ? "nenhuma APR no período" : `${porcentagem(totais.bloqueadas, totais.aprs)}% das respondidas${taxaAnterior}`}
        subStyle={totais.bloqueadas > 0 ? { color: "var(--blq)", fontWeight: 500 } : undefined}
      />
      {totais.alertas !== null && (
        <Kpi
          label="Alertas registrados"
          marker={<Icon name="alert" size={13} style={{ color: totais.alertas > 0 ? "var(--al)" : "var(--ink3)" }} />}
          value={totais.alertas}
          sub="respostas que avisam sem bloquear"
        />
      )}
      <Kpi
        label="Modelo escolhido pelo técnico"
        marker={<Icon name="list" size={13} style={{ color: totais.sem_modelo_ligado > 0 ? "var(--al)" : "var(--ink3)" }} />}
        value={totais.sem_modelo_ligado}
        sub={
          totais.sem_modelo_ligado > 0 ? (
            <Link href={`${rotas.web.atividades}?sem_modelo=true`}>OS sem atividade ligada a um modelo</Link>
          ) : (
            "toda OS tinha o modelo ligado"
          )
        }
        subStyle={totais.sem_modelo_ligado > 0 ? { fontWeight: 500 } : { color: "var(--enc)", fontWeight: 500 }}
      />
    </div>
  );
}

interface RankingDeItensProps {
  titulo: ReactNode;
  descricao: string;
  itens: ItemReprovado[];
  cor: string;
  /** Complemento ao lado do número (`· 50% das bloqueadas`, `vezes`). */
  detalhe: (item: ItemReprovado) => string;
  /** O total que vale 100% da barra. */
  base: number;
  vazio: string;
}

/** Itens reprovados no período, do mais frequente ao menos, com o modelo e a seção de cada um. */
function RankingDeItens({ titulo, descricao, itens, cor, base, detalhe, vazio }: RankingDeItensProps) {
  return (
    <Panel>
      <CabecalhoDoBloco titulo={titulo} descricao={descricao} />
      {itens.length === 0 ? (
        <p className="muted">{vazio}</p>
      ) : (
        <ul className="lista-barras">
          {itens.map((i) => (
            <li key={`${i.modelo}|${i.secao}|${i.texto}`}>
              <div className="row between g8" style={{ alignItems: "baseline" }}>
                <span className="stack" style={{ gap: 1 }}>
                  <span>{i.texto}</span>
                  <span className="small">
                    <Link href={rotas.web.modelo(i.modelo)}>{i.modelo}</Link> · {rotuloSecao[i.secao]}
                  </span>
                </span>
                <span style={{ whiteSpace: "nowrap" }}>
                  <strong>{i.total}</strong> <span className="small">{detalhe(i)}</span>
                </span>
              </div>
              <div className="trilho" aria-hidden="true">
                <i style={{ width: `${porcentagem(i.total, base)}%`, background: cor }}></i>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

interface LinhaDeResultado {
  chave: string;
  rotulo: ReactNode;
  aprs: number;
  bloqueadas: number;
}

/** APRs de cada modelo ou equipe: o comprimento é o volume (o maior ocupa a linha) e a barra separa bloqueadas e aprovadas. */
function RankingDeResultado({ titulo, descricao, linhas, ocultas, vazio }: { titulo: string; descricao: string; linhas: LinhaDeResultado[]; ocultas?: string; vazio: string }) {
  const maior = Math.max(1, ...linhas.map((l) => l.aprs));
  return (
    <Panel>
      <CabecalhoDoBloco titulo={titulo} descricao={descricao} />
      {linhas.length === 0 ? (
        <p className="muted">{vazio}</p>
      ) : (
        <>
          <ul className="legend" aria-label="Legenda">
            {SERIES.map((s) => (
              <li key={s.chave}>
                <i style={{ background: s.cor }}></i>
                <Icon name={s.icone!} size={13} style={{ color: "var(--ink3)" }} />
                {s.nome}
              </li>
            ))}
          </ul>
          <ul className="lista-barras">
            {linhas.map((l) => (
              <li key={l.chave}>
                <div className="row between g8" style={{ alignItems: "baseline" }}>
                  <span>{l.rotulo}</span>
                  <span style={{ whiteSpace: "nowrap" }}>
                    <strong>{l.aprs}</strong>{" "}
                    <span className="small">
                      · {plural(l.bloqueadas, "bloqueada", "bloqueadas")} ({porcentagem(l.bloqueadas, l.aprs)}%)
                    </span>
                  </span>
                </div>
                <div className="trilho" aria-hidden="true">
                  <div className="trilho-pilha" style={{ width: `${(l.aprs / maior) * 100}%` }}>
                    {l.bloqueadas > 0 && <i style={{ flexGrow: l.bloqueadas, background: BLOQUEADA }}></i>}
                    {l.aprs > l.bloqueadas && <i style={{ flexGrow: l.aprs - l.bloqueadas, background: APROVADA }}></i>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {ocultas && <span className="small">{ocultas}</span>}
        </>
      )}
    </Panel>
  );
}

/**
 * Dashboard de APR (Dashboard), no período e na equipe do filtro comum: contadores, as APRs por intervalo
 * de tempo, os itens que mais bloqueiam e os alertas mais registrados, e as APRs por modelo e por equipe.
 */
export function DashboardApr({ resumo, rotuloAnterior }: { resumo: ResumoDasAprs; rotuloAnterior: string }) {
  const unidade = nomeDaUnidade[resumo.agrupamento];
  const { totais } = resumo;
  const pontos: PontoDoGrafico[] = resumo.serie.map((p) => ({ inicio: p.inicio, fim: p.fim, valores: { bloqueadas: p.bloqueadas, aprovadas: p.aprovadas } }));
  // Os rankings dizem quais itens são eliminatórios e quais são de alerta; a `api` só os entrega ao admin.
  const { itens_que_bloqueiam: queBloqueiam, alertas_registrados: alertasRegistrados } = resumo;
  const maiorAlerta = Math.max(1, ...(alertasRegistrados ?? []).map((i) => i.total));
  const equipes = resumo.por_equipe.slice(0, EQUIPES_VISIVEIS);
  const outrasEquipes = resumo.por_equipe.length - equipes.length;

  return (
    <>
      <Secao id="apr-contadores-t" titulo="Contadores" descricao="As APRs do período, contadas pela data em que foram concluídas.">
        <Contadores resumo={resumo} rotuloAnterior={rotuloAnterior} />
      </Secao>

      <Secao id="apr-graficos-t" titulo="Gráficos" descricao={`Por ${unidade}, no fuso de São Paulo.`}>
        <Panel>
          <CabecalhoDoBloco
            titulo={`APRs por ${unidade}`}
            descricao={
              totais.aprs === 0
                ? "Aprovadas e bloqueadas, com as bloqueadas na base de cada coluna"
                : `${plural(totais.aprs, "APR respondida", "APRs respondidas")}, ${porcentagem(totais.bloqueadas, totais.aprs)}% bloqueadas; as bloqueadas ficam na base de cada coluna`
            }
          />
          <GraficoColunas pontos={pontos} series={SERIES} agrupamento={resumo.agrupamento} medida="APRs" vazio="Nenhuma APR concluída neste período." />
        </Panel>
      </Secao>

      {queBloqueiam && alertasRegistrados && (
        <Secao id="apr-itens-t" titulo="Por que bloqueia" descricao="Itens que receberam a resposta que o modelo marca: no eliminatório ela bloqueia a APR, no alerta só fica registrada.">
          <div className="two eq">
            <RankingDeItens
              titulo={
                <span className="row g8">
                  <Icon name="octagon" size={16} style={{ color: "var(--blq)" }} />
                  Itens que mais bloqueiam
                </span>
              }
              descricao={totais.bloqueadas === 0 ? "Itens eliminatórios reprovados" : `Em quantas das ${totais.bloqueadas} APRs bloqueadas cada item reprovou`}
              itens={queBloqueiam}
              cor={BLOQUEADA}
              base={totais.bloqueadas}
              detalhe={(i) => `· ${porcentagem(i.total, totais.bloqueadas)}% das bloqueadas`}
              vazio="Nenhuma APR bloqueada no período."
            />
            <RankingDeItens
              titulo={
                <span className="row g8">
                  <Icon name="alert" size={16} style={{ color: "var(--al)" }} />
                  Alertas mais registrados
                </span>
              }
              descricao="Itens de alerta com a resposta que avisa"
              itens={alertasRegistrados}
              cor={ALERTA}
              base={maiorAlerta}
              detalhe={(i) => (i.total === 1 ? "vez" : "vezes")}
              vazio="Nenhum alerta registrado no período."
            />
          </div>
        </Secao>
      )}

      <Secao id="apr-onde-t" titulo="Onde bloqueia" descricao="As APRs do período por modelo e pela equipe da OS.">
        <div className="two eq">
          <RankingDeResultado
            titulo="Por modelo"
            descricao="Versões diferentes do mesmo modelo somam juntas"
            linhas={resumo.por_modelo.map((m) => ({
              chave: m.codigo,
              rotulo: (
                <span className="stack" style={{ gap: 1 }}>
                  <Link href={rotas.web.modelo(m.codigo)} className="mono" style={{ fontWeight: 600 }}>
                    {m.codigo}
                  </Link>
                  <span className="small">{m.titulo}</span>
                </span>
              ),
              aprs: m.aprs,
              bloqueadas: m.bloqueadas,
            }))}
            vazio="Nenhuma APR no período."
          />
          <RankingDeResultado
            titulo="Por equipe"
            descricao="Pela equipe da OS em que a APR foi feita"
            linhas={equipes.map((e) => ({ chave: e.id, rotulo: <Link href={rotas.app.equipe(e.id)}>{e.nome}</Link>, aprs: e.aprs, bloqueadas: e.bloqueadas }))}
            ocultas={outrasEquipes > 0 ? `e mais ${plural(outrasEquipes, "equipe", "equipes")} com menos APRs` : undefined}
            vazio="Nenhuma APR no período."
          />
        </div>
      </Secao>
    </>
  );
}
