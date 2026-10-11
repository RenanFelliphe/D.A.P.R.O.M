import { cx } from "@/lib/cx";

const etapasApr = ["1 · Participantes e riscos", "2 · Checklist", "3 · Assinaturas"];

/** Indicador das 3 etapas da APR; `atual` é o índice (base 0) da etapa em andamento. */
export function EtapasApr({ atual = 0 }: { atual?: number }) {
  return (
    <div className="steps">
      {etapasApr.map((etapa, i) => (
        <div key={etapa} className={cx(i === atual && "on")}>
          <i></i>
          {etapa}
        </div>
      ))}
    </div>
  );
}
