import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";

interface FieldProps {
  label: ReactNode;
  htmlFor?: string;
  labelStyle?: CSSProperties;
  className?: string;
  children: ReactNode;
}

/** Campo de formulário: rótulo + controle (.field). */
export function Field({ label, htmlFor, labelStyle, className, children }: FieldProps) {
  return (
    <div className={cx("field", className)}>
      <label htmlFor={htmlFor} style={labelStyle}>
        {label}
      </label>
      {children}
    </div>
  );
}

/** Complemento "· obrigatória" do rótulo (.req). */
export function Req({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span className="req" style={style}>
      {children}
    </span>
  );
}
