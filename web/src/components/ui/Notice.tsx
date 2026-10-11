import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Icon, type IconName, type IconSize } from "./Icon";

const tons = {
  off: "n-off",
  info: "n-info",
  al: "n-al",
  ok: "n-ok",
  blq: "n-blq",
} as const;

export type NoticeTone = keyof typeof tons;

interface NoticeProps {
  tone: NoticeTone;
  icon: IconName;
  iconSize?: IconSize;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Aviso com ícone à esquerda (.notice). */
export function Notice({ tone, icon, iconSize = 18, className, style, children }: NoticeProps) {
  return (
    <div className={cx("notice", tons[tone], className)} style={style}>
      <Icon name={icon} size={iconSize} />
      <div>{children}</div>
    </div>
  );
}
