"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";

interface JanelaModalProps {
  titulo: string;
  /** Chamado quando a janela fecha (botão X, Esc ou clique fora). */
  aoFechar: () => void;
  /** Classe extra da `<dialog>` (ex.: `dlg-larga`). */
  className?: string;
  children: ReactNode;
}

/** Janela modal sobre a `<dialog>` nativa (foco preso, Esc fecha). Monte só quando for abrir. */
export function JanelaModal({ titulo, aoFechar, className, children }: JanelaModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (dialogo && !dialogo.open) dialogo.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={cx("dlg", className)}
      aria-label={titulo}
      onClose={aoFechar}
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) ref.current?.close();
      }}
    >
      <div className="dlg-cab">
        <h2>{titulo}</h2>
        <button type="button" className="ibtn" aria-label="Fechar" onClick={() => ref.current?.close()}>
          <Icon name="x" size={16} />
        </button>
      </div>
      <div className="dlg-corpo">{children}</div>
    </dialog>
  );
}
