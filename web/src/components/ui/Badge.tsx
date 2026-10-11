import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";

const tons = {
  lib: "b-lib",
  exe: "b-exe",
  blq: "b-blq",
  enc: "b-enc",
  neu: "b-neu",
  al: "b-al",
  crit: "b-crit",
  dark: "b-dark",
  brand: "b-brand",
} as const;

export type BadgeTone = keyof typeof tons;

interface BadgeProps {
  tone?: BadgeTone;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Selo arredondado (.badge) — status, criticidade, tipo da OS etc. */
export function Badge({ tone, className, style, children }: BadgeProps) {
  return (
    <span className={cx("badge", tone && tons[tone], className)} style={style}>
      {children}
    </span>
  );
}
