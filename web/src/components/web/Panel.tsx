import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";

interface PanelProps {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Cartão branco do painel web (.panel). */
export function Panel({ className, style, children }: PanelProps) {
  return (
    <div className={cx("panel", className)} style={style}>
      {children}
    </div>
  );
}

/** Contêiner com borda para tabelas (.tbw). */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="tbw">{children}</div>;
}

interface KpiProps {
  /** Texto do rótulo; o marcador (bolinha/ícone) vai em `marker`. */
  label: ReactNode;
  marker?: ReactNode;
  value: ReactNode;
  sub: ReactNode;
  subStyle?: CSSProperties;
}

/** Indicador numérico (.kpi). */
export function Kpi({ label, marker, value, sub, subStyle }: KpiProps) {
  return (
    <div className="kpi">
      <span className="l">
        {marker}
        {label}
      </span>
      <span className="v">{value}</span>
      <span className="s" style={subStyle}>
        {sub}
      </span>
    </div>
  );
}
