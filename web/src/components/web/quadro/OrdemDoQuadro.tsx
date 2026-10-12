import Link from "next/link";
import type { FiltrosDoQuadro } from "@/data/quadro";

const opcoes: { valor: NonNullable<FiltrosDoQuadro["ordem"]>; rotulo: string }[] = [
  { valor: "prioridade", rotulo: "Prioridade" },
  { valor: "data_limite", rotulo: "Data limite" },
];

interface OrdemDoQuadroProps {
  atual: NonNullable<FiltrosDoQuadro["ordem"]>;
  /** Endereço do quadro com a ordem pedida (a padrão sai da URL). */
  hrefDa: (ordem: NonNullable<FiltrosDoQuadro["ordem"]>) => string;
}

/** Seletor de ordenação do quadro: Prioridade (padrão) ou Data limite. */
export function OrdemDoQuadro({ atual, hrefDa }: OrdemDoQuadroProps) {
  return (
    <div className="row g8" style={{ alignItems: "center" }}>
      <span className="small" style={{ color: "var(--ink4)" }}>
        Ordenar por
      </span>
      <nav className="segmentos" aria-label="Ordenar o quadro">
        {opcoes.map((o) => (
          <Link key={o.valor} href={hrefDa(o.valor)} aria-current={o.valor === atual ? "true" : undefined}>
            {o.rotulo}
          </Link>
        ))}
      </nav>
    </div>
  );
}
