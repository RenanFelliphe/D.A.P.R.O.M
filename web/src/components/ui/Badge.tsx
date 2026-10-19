import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { TomDoSelo } from "@/lib/tipos";

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
} as const satisfies Record<TomDoSelo, string>;

export type BadgeTone = TomDoSelo;

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
