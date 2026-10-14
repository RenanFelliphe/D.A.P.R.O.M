"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export interface ColunaDaTabela<T> {
  titulo: string;
  largura?: number;
  render: (linha: T) => ReactNode;
  className?: string;
}

interface TabelaSelecionavelProps<T> {
  legenda: string;
  linhas: T[];
  idDe: (linha: T) => string;
  colunas: ColunaDaTabela<T>[];
  selecionados: ReadonlySet<string>;
  aoAlterarSelecao: (selecao: Set<string>) => void;
  /** Última coluna de cada linha (o menu de três pontos). */
  acoesDaLinha?: (linha: T) => ReactNode;
  /** Texto da linha única quando não há nada. */
  vazio: string;
  classeDaLinha?: (linha: T) => string | undefined;
  /** Nome do que a caixa de seleção seleciona, para leitores de tela ("funcionário", "ordem"). */
  rotuloDoItem: string;
}

/**
 * Tabela com caixa de seleção por linha e "selecionar todos" no cabeçalho (marca a página). Feita para os simuladores (funcionários
 * e ordens do SAP): a seleção é do pai, que sabe oferecer "Selecionar os N da busca" e as ações em massa.
 */
export function TabelaSelecionavel<T>({ legenda, linhas, idDe, colunas, selecionados, aoAlterarSelecao, acoesDaLinha, vazio, classeDaLinha, rotuloDoItem }: TabelaSelecionavelProps<T>) {
  const cabecalho = useRef<HTMLInputElement>(null);
  const ids = linhas.map(idDe);
  const marcados = ids.filter((id) => selecionados.has(id)).length;
  const todos = ids.length > 0 && marcados === ids.length;

  useEffect(() => {
    if (cabecalho.current) cabecalho.current.indeterminate = marcados > 0 && !todos;
  }, [marcados, todos]);

  function alternarPagina() {
    const novo = new Set(selecionados);
    for (const id of ids) {
      if (todos) novo.delete(id);
      else novo.add(id);
    }
    aoAlterarSelecao(novo);
  }

  function alternar(id: string) {
    const novo = new Set(selecionados);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    aoAlterarSelecao(novo);
  }

  return (
    <div className="tbw">
      <table className="tb sim-tabela">
        <caption className="sr">{legenda}</caption>
        <thead>
          <tr>
            <th style={{ width: 40 }}>
              <input ref={cabecalho} type="checkbox" checked={todos} onChange={alternarPagina} disabled={ids.length === 0} aria-label={`Selecionar todos os ${rotuloDoItem}s desta página`} />
            </th>
            {colunas.map((c) => (
              <th key={c.titulo} style={c.largura ? { width: c.largura } : undefined} className={c.className}>
                {c.titulo}
              </th>
            ))}
            {acoesDaLinha && (
              <th style={{ width: 56 }}>
                <span className="sr">Ações</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 ? (
            <tr>
              <td colSpan={colunas.length + 1 + (acoesDaLinha ? 1 : 0)} className="muted">
                {vazio}
              </td>
            </tr>
          ) : (
            linhas.map((l) => {
              const id = idDe(l);
              return (
                <tr key={id} className={cx(selecionados.has(id) && "sim-marcada", classeDaLinha?.(l))}>
                  <td>
                    <input type="checkbox" checked={selecionados.has(id)} onChange={() => alternar(id)} aria-label={`Selecionar ${rotuloDoItem} ${id}`} />
                  </td>
                  {colunas.map((c) => (
                    <td key={c.titulo} className={c.className}>
                      {c.render(l)}
                    </td>
                  ))}
                  {acoesDaLinha && <td className="acoes-linha">{acoesDaLinha(l)}</td>}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
