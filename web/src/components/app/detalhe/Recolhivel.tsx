import type { ReactNode } from "react";

interface RecolhivelProps {
  titulo: string;
  /** Texto curto à direita do título (ex.: quantos itens a seção guarda). */
  resumo?: string;
  aberto?: boolean;
  children: ReactNode;
}

/** Card que abre e fecha pelo título: deixa o detalhe da OS enxuto e o que é secundário a um toque. */
export function Recolhivel({ titulo, resumo, aberto, children }: RecolhivelProps) {
  return (
    <details className="card recolhivel" open={aberto}>
      <summary>
        <h2 style={{ fontSize: 15, fontWeight: 600 }}>{titulo}</h2>
        {resumo && <span className="small">{resumo}</span>}
      </summary>
      <div className="stack g8" style={{ paddingTop: 12 }}>
        {children}
      </div>
    </details>
  );
}
