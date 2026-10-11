import type { SVGProps } from "react";

/** Traços das assinaturas fictícias usadas nas telas e no PDF. */
const tracos = {
  carlos:
    "M8 42 C 22 18, 30 50, 44 30 S 62 12, 70 34 S 88 52, 100 28 S 122 16, 128 36 S 146 48, 160 26 S 182 30, 194 22",
  diego:
    "M10 36 C 26 14, 34 44, 50 26 S 70 40, 84 22 S 104 46, 118 30 C 128 20, 140 40, 152 30 S 176 24, 190 34",
} as const;

export type PessoaAssinatura = keyof typeof tracos;

const nomes: Record<PessoaAssinatura, string> = {
  carlos: "Carlos Menezes",
  diego: "Diego Rocha",
};

interface AssinaturaProps extends Omit<SVGProps<SVGSVGElement>, "viewBox" | "role"> {
  pessoa: PessoaAssinatura;
  /** Espessura do traço: 2.2 nas telas do app, 2 no painel e no PDF. */
  espessura?: number;
}

/** Assinatura desenhada (SVG 200×60) de uma das pessoas fictícias. */
export function Assinatura({ pessoa, espessura = 2.2, ...rest }: AssinaturaProps) {
  return (
    <svg viewBox="0 0 200 60" role="img" aria-label={`Assinatura de ${nomes[pessoa]}`} {...rest}>
      <path d={tracos[pessoa]} fill="none" stroke="#17212B" strokeWidth={espessura} strokeLinecap="round" />
    </svg>
  );
}
