"use client";

import { useId, type ReactNode } from "react";
import { useDialogo } from "@/components/treino/useDialogo";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";

interface JanelaSobrepostaProps {
  titulo: string;
  /** Chamado ao fechar (botão X, Esc ou clique fora). */
  aoFechar: () => void;
  /** Classe extra da janela (ex.: `dlg-modelos`). */
  className?: string;
  /** Chave `data-treino` da janela, para o tutorial do Campo de treino apontar para ela. */
  dataTreino?: string;
  children: ReactNode;
}

/**
 * Janela modal das telas de campo. Não usa a `<dialog>` nativa (como `JanelaModal`) porque ela sobe para a camada do topo e
 * deixa o resto da página inerte: o tutorial do treino, que aponta para dentro da janela, ficaria por baixo e sem clique.
 * Prende o foco, fecha com Esc e trava a rolagem como diálogo modal. Monte só quando for abrir.
 */
export function JanelaSobreposta({ titulo, aoFechar, className, dataTreino, children }: JanelaSobrepostaProps) {
  const raiz = useDialogo<HTMLDivElement>(aoFechar);
  const idTitulo = useId();

  return (
    <div
      className="janela-fundo"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar();
      }}
    >
      <div ref={raiz} className={cx("dlg janela", className)} role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1} data-treino={dataTreino}>
        <div className="dlg-cab">
          <h2 id={idTitulo}>{titulo}</h2>
          <button type="button" className="ibtn" aria-label="Fechar" onClick={aoFechar}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="dlg-corpo">{children}</div>
      </div>
    </div>
  );
}
