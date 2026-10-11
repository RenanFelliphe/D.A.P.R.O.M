interface ProgressoChecklistProps {
  /** Texto da posição ("Pergunta 3 de 18" ou "Revisão · 18 de 18"). */
  titulo: string;
  secao: string;
  respondidas: number;
  total: number;
}

/** Faixa com a posição atual, a seção da pergunta e a barra de progresso. */
export function ProgressoChecklist({ titulo, secao, respondidas, total }: ProgressoChecklistProps) {
  return (
    <div className="panel" style={{ gap: 10, padding: "14px 20px" }}>
      <div className="row between" style={{ fontSize: 14 }}>
        <strong>{titulo}</strong>
        <span className="muted">{secao}</span>
      </div>
      <div className="progress" role="img" aria-label="Progresso do checklist">
        <i style={{ width: respondidas ? `${((respondidas / total) * 100).toFixed(1)}%` : 0 }}></i>
      </div>
    </div>
  );
}
