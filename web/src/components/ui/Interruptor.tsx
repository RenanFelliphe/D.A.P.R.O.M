import type { ReactNode } from "react";

interface InterruptorProps {
  ligado: boolean;
  aoAlternar: (ligar: boolean) => void;
  disabled?: boolean;
  /** O que o interruptor liga, para o leitor de tela; o texto visível (`children`) é o estado ("Ligada"). */
  rotulo: string;
  children?: ReactNode;
}

/** Interruptor de ligar e desligar (`role="switch"`): o estado vem de fora e quem usa decide o que cada toque faz. */
export function Interruptor({ ligado, aoAlternar, disabled, rotulo, children }: InterruptorProps) {
  return (
    <span className="ci-chave">
      <button type="button" role="switch" className="sw" aria-checked={ligado} aria-label={rotulo} disabled={disabled} onClick={() => aoAlternar(!ligado)}>
        <span className="sw-botao" />
      </button>
      {children && <span aria-hidden="true">{children}</span>}
    </span>
  );
}
