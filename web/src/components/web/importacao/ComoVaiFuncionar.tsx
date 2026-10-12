import { Icon } from "@/components/ui/Icon";

export interface Passo {
  titulo: string;
  detalhe: string;
  /** `feito`: o passo já aconteceu; `proximo`: o que vem depois. */
  estado: "feito" | "proximo";
}

/** Passo a passo de um fluxo: o que já aconteceu e o que vem depois. */
export function ComoVaiFuncionar({ titulo = "Como vai funcionar", passos }: { titulo?: string; passos: Passo[] }) {
  return (
    <div className="stack g8">
      <span className="lbl">{titulo}</span>
      <ol className="passos">
        {passos.map((p, i) => (
          <li key={p.titulo} data-estado={p.estado}>
            <span className="n" aria-hidden="true">
              {p.estado === "feito" ? <Icon name="check" size={13} /> : i + 1}
            </span>
            <span className="stack" style={{ gap: 1 }}>
              <strong>
                {p.titulo}
                {p.estado === "feito" && <span className="sr"> (concluído)</span>}
              </strong>
              <span className="small">{p.detalhe}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
