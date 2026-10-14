"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

interface BarraAcoesEmMassaProps {
  /** Quantos estão selecionados (todos da busca, ou os marcados). */
  quantidade: number;
  /** Rótulo no plural: "funcionários", "ordens". */
  rotulo: string;
  /** Quantos itens a busca tem, e quantos da página estão marcados, para a faixa "Selecionar os N da busca". */
  totalDaBusca: number;
  marcadosNaPagina: number;
  tamanhoDaPagina: number;
  todosDaBusca: boolean;
  aoSelecionarTodosDaBusca: () => void;
  aoLimpar: () => void;
  /** Os botões das ações (Mudar setor, Mudar situação, Excluir…). */
  children: ReactNode;
}

/**
 * Barra que aparece quando há seleção: quantos estão marcados, a faixa que oferece "Selecionar os N da busca" (quando a página inteira
 * está marcada e a busca tem mais) e as ações em massa. Compartilhada pelos simuladores.
 */
export function BarraAcoesEmMassa({ quantidade, rotulo, totalDaBusca, marcadosNaPagina, tamanhoDaPagina, todosDaBusca, aoSelecionarTodosDaBusca, aoLimpar, children }: BarraAcoesEmMassaProps) {
  if (quantidade === 0) return null;
  const paginaInteira = marcadosNaPagina >= tamanhoDaPagina && tamanhoDaPagina > 0;
  const ofereceBusca = !todosDaBusca && paginaInteira && totalDaBusca > tamanhoDaPagina;
  return (
    <div className="stack g8" role="region" aria-label="Ações em massa">
      <div className="sim-barra">
        <b>{quantidade === 1 ? "1 selecionado" : `${quantidade} selecionados`}</b>
        <span className="row g8 wrap">{children}</span>
        <Button variant="ghost" sm onClick={aoLimpar}>
          Limpar seleção
        </Button>
      </div>
      {ofereceBusca && (
        <div className="sim-faixa" role="status">
          Os {tamanhoDaPagina} {rotulo} desta página estão selecionados.{" "}
          <button type="button" className="sim-link" onClick={aoSelecionarTodosDaBusca}>
            Selecionar os {totalDaBusca} da busca
          </button>
        </div>
      )}
      {todosDaBusca && (
        <div className="sim-faixa" role="status">
          Todos os {totalDaBusca} {rotulo} da busca estão selecionados.{" "}
          <button type="button" className="sim-link" onClick={aoLimpar}>
            Limpar seleção
          </button>
        </div>
      )}
    </div>
  );
}
