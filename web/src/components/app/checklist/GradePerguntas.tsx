import { cx } from "@/lib/cx";

interface GradePerguntasProps {
  total: number;
  /** Índice (base 0) da pergunta atual. */
  atual: number;
  /** Quais perguntas (base 0) já têm resposta. */
  respondida: (indice: number) => boolean;
  aoSelecionar: (indice: number) => void;
}

/** Grade com um chip por pergunta, para voltar a uma resposta. */
export function GradePerguntas({ total, atual, respondida, aoSelecionar }: GradePerguntasProps) {
  return (
    <section className="panel" style={{ gap: 10 }} aria-label="Todas as perguntas">
      <span className="lbl">Perguntas · clique para voltar a uma resposta</span>
      <div className="qgrid">
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            className={cx("qchip", i === atual ? "cur" : respondida(i) && "done")}
            type="button"
            aria-label={`Pergunta ${i + 1}${respondida(i) ? ", respondida" : ""}`}
            onClick={() => aoSelecionar(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </section>
  );
}
