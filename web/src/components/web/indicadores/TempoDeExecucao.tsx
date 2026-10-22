import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Panel, TableWrap } from "@/components/web/Panel";
import type { MedidaDeTempo, MotivoDaPausa, OsComMaisPausa, PausaPorMotivo } from "@/data/dashboards";
import { dataHora, duracao } from "@/lib/formatar";
import { rotuloDoMotivoDaPausa } from "@/lib/motivos-de-parada";
import { rotas } from "@/lib/rotas";
import { CabecalhoDoBloco, plural, porcentagem } from "./blocos";
import { COR_PAUSA, COR_TEMPO_LIQUIDO, COR_UNICA } from "./cores";

/**
 * Peças do tempo de execução nos dashboards: só execuções encerradas iniciadas no período. O tempo total é do início ao fim,
 * a pausa é a soma das pausas registradas no app e o líquido é a diferença.
 */

/** `0.1234` → `12%`; sem medida, "—". */
export const fracao = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

/** `0.5` → `0,5`. */
const decimal = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));

const NOME_DO_MOTIVO: Record<MotivoDaPausa, string> = { ...rotuloDoMotivoDaPausa, outro: "Outro motivo", sem_motivo: "Sem motivo informado" };

/** Tempo médio das execuções encerradas no período: total, líquido, pausa, a parte do tempo em pausa e quantas pausaram. */
export function TempoDoPeriodo({ tempo, rodape }: { tempo: MedidaDeTempo; rodape?: string }) {
  const dados = [
    { rotulo: "Tempo total médio", valor: duracao(tempo.tempo_total_medio_min) },
    { rotulo: "Tempo líquido médio", valor: duracao(tempo.tempo_liquido_medio_min) },
    { rotulo: "Pausa média", valor: duracao(tempo.pausa_media_min) },
    { rotulo: "Pausa no total", valor: fracao(tempo.proporcao_pausa) },
    { rotulo: "Execuções com pausa", valor: tempo.execucoes === 0 ? "—" : `${tempo.execucoes_com_pausa} de ${tempo.execucoes}` },
    { rotulo: "Pausas por execução", valor: decimal(tempo.pausas_por_execucao) },
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

export interface LinhaDeTempo extends MedidaDeTempo {
  id: string;
  nome: string;
  href?: string;
  /** Texto pequeno ao lado do nome (a equipe do técnico). */
  detalhe?: string | null;
}

const SERIES = [
  { chave: "liquido", nome: "Tempo líquido", cor: COR_TEMPO_LIQUIDO },
  { chave: "pausa", nome: "Pausa", cor: COR_PAUSA },
] as const;

const LINHAS_NO_GRAFICO = 12;

/**
 * Tempo médio por execução de cada equipe ou técnico: o comprimento da barra é o tempo total médio (a maior ocupa a linha), e
 * ela se divide em tempo líquido e pausa. À direita, o total e a parte em pausa; a tabela traz todos os números.
 */
export function TempoPorGrupo({ titulo, descricao, coluna, linhas }: { titulo: string; descricao: string; coluna: string; linhas: LinhaDeTempo[] }) {
  const comExecucao = linhas.filter((l) => l.execucoes > 0).sort((a, b) => (b.tempo_total_medio_min ?? 0) - (a.tempo_total_medio_min ?? 0) || a.nome.localeCompare(b.nome, "pt-BR"));
  const noGrafico = comExecucao.slice(0, LINHAS_NO_GRAFICO);
  const maior = Math.max(1, ...noGrafico.map((l) => l.tempo_total_medio_min ?? 0));
  return (
    <Panel>
      <CabecalhoDoBloco titulo={titulo} descricao={descricao} />
      {comExecucao.length === 0 ? (
        <p className="muted">Nenhuma execução encerrada no período.</p>
      ) : (
        <>
          <ul className="legend" aria-label="Legenda">
            {SERIES.map((s) => (
              <li key={s.chave}>
                <i style={{ background: s.cor }}></i>
                {s.nome}
              </li>
            ))}
          </ul>
          <ul className="lista-barras" aria-label={`${titulo}: tempo total médio por execução, dividido em tempo líquido e pausa`}>
            {noGrafico.map((l) => {
              const liquido = l.tempo_liquido_medio_min ?? 0;
              const pausa = l.pausa_media_min ?? 0;
              return (
                <li key={l.id}>
                  <div className="row between g8" style={{ alignItems: "baseline" }}>
                    <span>
                      {l.href ? <Link href={l.href}>{l.nome}</Link> : l.nome}
                      <span className="small">
                        {l.detalhe ? ` · ${l.detalhe}` : ""} · {plural(l.execucoes, "execução", "execuções")}
                      </span>
                    </span>
                    <span style={{ whiteSpace: "nowrap" }}>
                      <strong>{duracao(l.tempo_total_medio_min)}</strong>{" "}
                      <span className="small">
                        · {pausa > 0 ? `${duracao(pausa)} em pausa (${fracao(l.proporcao_pausa)})` : "sem pausa"}
                      </span>
                    </span>
                  </div>
                  <div className="trilho" aria-hidden="true">
                    <div className="trilho-pilha" style={{ width: `${((l.tempo_total_medio_min ?? 0) / maior) * 100}%` }}>
                      {liquido > 0 && <i style={{ flexGrow: liquido, background: COR_TEMPO_LIQUIDO }} title={`Tempo líquido médio: ${duracao(liquido)}`}></i>}
                      {pausa > 0 && <i style={{ flexGrow: pausa, background: COR_PAUSA }} title={`Pausa média: ${duracao(pausa)}`}></i>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {comExecucao.length > noGrafico.length && (
            <span className="small">
              Mostrando os {noGrafico.length} de maior tempo; os {comExecucao.length} estão na tabela.
            </span>
          )}
          <details className="grafico-tabela">
            <summary>Ver os números em tabela</summary>
            <TableWrap>
              <table className="tb">
                <caption className="sr">{titulo}</caption>
                <thead>
                  <tr>
                    <th>{coluna}</th>
                    <th className="r">Execuções</th>
                    <th className="r">Tempo total médio</th>
                    <th className="r">Tempo líquido médio</th>
                    <th className="r">Pausa média</th>
                    <th className="r">Pausas por execução</th>
                  </tr>
                </thead>
                <tbody>
                  {comExecucao.map((l) => (
                    <tr key={l.id}>
                      <th scope="row" style={{ fontWeight: 500 }}>
                        {l.nome}
                      </th>
                      <td className="r">{l.execucoes}</td>
                      <td className="r">{duracao(l.tempo_total_medio_min)}</td>
                      <td className="r">{duracao(l.tempo_liquido_medio_min)}</td>
                      <td className="r">{duracao(l.pausa_media_min)}</td>
                      <td className="r">{decimal(l.pausas_por_execucao)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </details>
        </>
      )}
    </Panel>
  );
}

/** Tempo em pausa por motivo (almoço, aguardando, descanso, clima, enfermidade, lesão, outro), com a fatia de cada um no tempo total em pausa. */
export function PausasPorMotivo({ motivos }: { motivos: PausaPorMotivo[] }) {
  const total = motivos.reduce((t, m) => t + m.minutos, 0);
  const pausas = motivos.reduce((t, m) => t + m.pausas, 0);
  return (
    <Panel>
      <CabecalhoDoBloco
        titulo="Pausas por motivo"
        descricao={pausas === 0 ? "O motivo escolhido no app ao pausar" : `${plural(pausas, "pausa", "pausas")}, ${duracao(total)} no total, pelo motivo escolhido no app`}
      />
      {pausas === 0 ? (
        <p className="muted">Nenhuma pausa registrada no período.</p>
      ) : (
        <ul className="lista-barras">
          {motivos.map((m) => (
            <li key={m.motivo}>
              <div className="row between g8" style={{ alignItems: "baseline" }}>
                <span>
                  {NOME_DO_MOTIVO[m.motivo]} <span className="small">· {plural(m.pausas, "pausa", "pausas")}</span>
                </span>
                <span style={{ whiteSpace: "nowrap" }}>
                  <strong>{duracao(m.minutos)}</strong> <span className="small">· {porcentagem(m.minutos, total)}%</span>
                </span>
              </div>
              <div className="trilho" aria-hidden="true">
                {m.minutos > 0 && <i style={{ width: `${porcentagem(m.minutos, total)}%`, background: COR_UNICA }}></i>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** As OS do período com mais tempo em pausa, com o total, a pausa e quem executou (quando a pessoa pode saber). */
export function OsComMaisPausaNoPeriodo({ lista, descricao = "As execuções encerradas com mais tempo em pausa" }: { lista: OsComMaisPausa[]; descricao?: string }) {
  return (
    <Panel>
      <CabecalhoDoBloco
        titulo={
          <span className="row g8">
            <Icon name="pause" size={16} style={{ color: "var(--ink3)" }} />
            OS com mais pausa
          </span>
        }
        descricao={descricao}
      />
      {lista.length === 0 ? (
        <p className="muted">Nenhuma execução com pausa no período.</p>
      ) : (
        <ul className="uso-lista">
          {lista.map((o) => (
            <li key={o.os_id}>
              <Link href={rotas.app.os(o.os_id)} className="mono">
                {o.numero_ordem ? `OS ${o.numero_ordem}` : "OS de apoio"}
              </Link>
              <span>{o.titulo}</span>
              <span className="small">
                {duracao(o.pausa_min)} em pausa ({plural(o.pausas, "pausa", "pausas")}) de {duracao(o.tempo_total_min)} · {fracao(o.proporcao_pausa)}
              </span>
              <span className="small">{o.executor ? `${o.executor} · ${dataHora(o.fim)}` : dataHora(o.fim)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
