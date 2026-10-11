import { cx } from "@/lib/cx";

interface GradePerguntasProps {
  total: number;
  /** Índice (base 0) da pergunta atual. */
  atual: number;
  /** Quais perguntas (base 0) já têm resposta. */
  respondida: (indice: number) => boolean;
  /** Quais perguntas (base 0) ainda pedem evidência ou observação. */
  pendente: (indice: number) => boolean;
  aoSelecionar: (indice: number) => void;
}

/** Grade com um chip por pergunta, para ir a qualquer uma; o contorno vermelho marca a que ainda pede evidência. */
export function GradePerguntas({ total, atual, respondida, pendente, aoSelecionar }: GradePerguntasProps) {
  return (
    <section className="panel" style={{ gap: 10 }} aria-label="Todas as perguntas">
      <span className="lbl">Perguntas · clique para ir a uma pergunta</span>
      <div className="qgrid">
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            className={cx("qchip", i === atual ? "cur" : respondida(i) && "done")}
            style={pendente(i) && i !== atual ? { borderColor: "var(--blq)", color: "var(--blq)" } : undefined}
            type="button"
            aria-label={`Pergunta ${i + 1}${respondida(i) ? ", respondida" : ""}${pendente(i) ? ", falta evidência" : ""}`}
            onClick={() => aoSelecionar(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </section>
  );
}
