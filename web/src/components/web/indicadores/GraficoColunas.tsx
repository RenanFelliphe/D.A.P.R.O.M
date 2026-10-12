"use client";

import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { TableWrap } from "@/components/web/Panel";
import { rotuloCurto, rotuloLongo, type Agrupamento } from "@/components/web/importacao/tipos";
import { cx } from "@/lib/cx";

/** Uma faixa `[inicio, fim)` do período com o valor de cada série. */
export interface PontoDoGrafico {
  inicio: string;
  fim: string;
  valores: Record<string, number>;
}

export interface SerieDoGrafico {
  chave: string;
  nome: string;
  cor: string;
  /** Séries de estado (sem falha, com falha) levam ícone na legenda: a cor nunca diz sozinha. */
  icone?: IconName;
}

interface GraficoColunasProps {
  pontos: PontoDoGrafico[];
  /** De baixo para cima na coluna empilhada; a ordem da legenda é a mesma. */
  series: SerieDoGrafico[];
  agrupamento: Agrupamento;
  /** O que se conta, no plural: "OS registradas", "leituras" (dica, tabela e leitor de tela). */
  medida: string;
  /** Texto no lugar das colunas quando o período não tem nada. */
  vazio: string;
}

/** Marcas do eixo em números redondos (passo 1, 2 ou 5 × 10ⁿ), com o topo logo acima do maior valor. */
function marcasDoEixo(maior: number): number[] {
  const bruto = Math.max(maior, 4) / 4;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 5, 10].map((m) => m * potencia).find((p) => p >= bruto)!;
  const topo = Math.ceil(maior / passo) * passo || passo * 4;
  return Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => i * passo);
}

/** De quantos em quantos pontos o eixo X mostra o rótulo (o ponto atual sempre tem). */
const saltoDoRotulo = (n: number) => (n > 14 ? Math.ceil(n / 8) : n > 7 ? 2 : 1);

const nomeDaUnidade = { dia: "dia", semana: "semana", mes: "mês" } as const;
const tituloDaUnidade = { dia: "Dia", semana: "Semana", mes: "Mês" } as const;

/**
 * Colunas empilhadas por dia, semana ou mês, uma cor por série. A dica aparece ao passar o mouse ou com as setas do
 * teclado (o gráfico recebe foco); a tabela abaixo tem todos os números.
 */
export function GraficoColunas({ pontos, series, agrupamento, medida, vazio }: GraficoColunasProps) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const n = pontos.length;
  const total = (p: PontoDoGrafico) => series.reduce((t, s) => t + (p.valores[s.chave] ?? 0), 0);
  const maior = Math.max(0, ...pontos.map(total));
  const marcas = marcasDoEixo(maior);
  const topo = marcas.at(-1)!;
  const altura = (v: number) => `${(v / topo) * 100}%`;
  const destaque = maior > 0 ? pontos.findLastIndex((p) => total(p) === maior) : -1;
  const salto = saltoDoRotulo(n);
  const unidade = nomeDaUnidade[agrupamento];

  function teclar(e: KeyboardEvent) {
    const mover: Record<string, () => number | null> = {
      ArrowRight: () => Math.min(n - 1, (ativo ?? -1) + 1),
      ArrowLeft: () => Math.max(0, (ativo ?? n) - 1),
      Home: () => 0,
      End: () => n - 1,
      Escape: () => null,
    };
    if (!(e.key in mover)) return;
    e.preventDefault();
    setAtivo(mover[e.key]!());
  }

  const ponto = ativo === null ? null : pontos[ativo];
  // A dica fica ao lado da coluna, sem cobri-la: à direita na primeira metade do gráfico, à esquerda na segunda (no
  // celular o CSS a centraliza acima do gráfico).
  const posicaoDaDica = (
    ativo === null
      ? undefined
      : ativo < n / 2
        ? { "--dica-x": `${((ativo + 1) / n) * 100}%`, "--dica-desloc": "8px" }
        : { "--dica-x": `${(ativo / n) * 100}%`, "--dica-desloc": "calc(-100% - 8px)" }
  ) as CSSProperties | undefined;
  const textoDoPonto = (p: PontoDoGrafico) =>
    `${rotuloLongo(p, agrupamento)}: ${total(p)} ${medida}, ${series.map((s) => `${p.valores[s.chave] ?? 0} ${s.nome.toLowerCase()}`).join(", ")}`;

  return (
    <div className="stack g12">
      {series.length > 1 && (
        <ul className="legend" aria-label="Legenda">
          {series.map((s) => (
            <li key={s.chave}>
              <i style={{ background: s.cor }}></i>
              {s.icone && <Icon name={s.icone} size={13} style={{ color: "var(--ink3)" }} />}
              {s.nome}
            </li>
          ))}
        </ul>
      )}

      <div className="grafico">
        <div className="grafico-y" aria-hidden="true">
          {marcas.map((m) => (
            <span key={m} style={{ bottom: altura(m) }}>
              {m}
            </span>
          ))}
        </div>
        <div
          className="grafico-area"
          role="group"
          tabIndex={0}
          aria-label={`${medida} por ${unidade}. Use as setas para percorrer os pontos.`}
          onKeyDown={teclar}
          onFocus={() => setAtivo((a) => a ?? n - 1)}
          onBlur={() => setAtivo(null)}
          onPointerLeave={() => setAtivo(null)}
        >
          {marcas.slice(1).map((m) => (
            <i key={m} className="grafico-grade" style={{ bottom: altura(m) }} aria-hidden="true"></i>
          ))}
          <div className="grafico-colunas" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} aria-hidden="true">
            {pontos.map((p, i) => (
              <div key={p.inicio} className={cx("grafico-col", i === ativo && "ativa")} onPointerEnter={() => setAtivo(i)}>
                {i === destaque && (
                  <span className="grafico-rot" style={{ bottom: altura(maior) }}>
                    {maior}
                  </span>
                )}
                {total(p) > 0 && (
                  <div className="grafico-pilha" style={{ height: altura(total(p)) }}>
                    {series.map((s) => ((p.valores[s.chave] ?? 0) > 0 ? <i key={s.chave} style={{ flexGrow: p.valores[s.chave], background: s.cor }}></i> : null))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {maior === 0 && <span className="grafico-vazio">{vazio}</span>}
          {ponto && (
            <div className="grafico-dica" style={posicaoDaDica} aria-hidden="true">
              <strong>
                {total(ponto)} {medida}
              </strong>
              <span className="small">{rotuloLongo(ponto, agrupamento)}</span>
              {series.length > 1 &&
                series.map((s) => (
                  <span key={s.chave} className="dica-linha">
                    <i style={{ background: s.cor }}></i>
                    <b>{ponto.valores[s.chave] ?? 0}</b>
                    {s.nome}
                  </span>
                ))}
            </div>
          )}
          <span className="sr" aria-live="polite">
            {ponto ? textoDoPonto(ponto) : ""}
          </span>
        </div>
        <div className="grafico-x" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} aria-hidden="true">
          {pontos.map((p, i) => (
            <span key={p.inicio}>{(n - 1 - i) % salto === 0 ? rotuloCurto(p, agrupamento) : ""}</span>
          ))}
        </div>
      </div>

      <details className="grafico-tabela">
        <summary>Ver os números em tabela</summary>
        <TableWrap>
          <table className="tb">
            <caption className="sr">
              {medida} por {unidade}
            </caption>
            <thead>
              <tr>
                <th>{tituloDaUnidade[agrupamento]}</th>
                {series.map((s) => (
                  <th key={s.chave} className="r">
                    {s.nome}
                  </th>
                ))}
                <th className="r">Total</th>
              </tr>
            </thead>
            <tbody>
              {pontos
                .map((p) => (
                  <tr key={p.inicio}>
                    <th scope="row" style={{ fontWeight: 500 }}>
                      {rotuloLongo(p, agrupamento)}
                    </th>
                    {series.map((s) => (
                      <td key={s.chave} className="r">
                        {p.valores[s.chave] ?? 0}
                      </td>
                    ))}
                    <td className="r" style={{ fontWeight: 600 }}>
                      {total(p)}
                    </td>
                  </tr>
                ))
                .reverse()}
            </tbody>
          </table>
        </TableWrap>
      </details>
    </div>
  );
}
