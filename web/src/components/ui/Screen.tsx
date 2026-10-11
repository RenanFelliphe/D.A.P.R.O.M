import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";

interface ScreenProps {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Página de conteúdo da área principal (.page): coluna com respiro e largura máxima. */
export function Screen({ className, style, children }: ScreenProps) {
  return (
    <section className={cx("page", className)} style={style}>
      {children}
    </section>
  );
}
