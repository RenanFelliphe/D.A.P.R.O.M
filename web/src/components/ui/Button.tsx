"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

type Variante = "p" | "d" | "o" | "od" | "line" | "ghost";

interface EstiloBotao {
  variant?: Variante;
  sm?: boolean;
  block?: boolean;
  className?: string;
}

function classeBotao({ variant, sm, block, className }: EstiloBotao) {
  return cx("btn", variant && `btn-${variant}`, sm && "btn-sm", block && "btn-block", className);
}

type ButtonProps = EstiloBotao & Omit<ComponentProps<"button">, "className">;

/** Botão de ação (.btn). Para navegar entre telas use <LinkButton />. */
export function Button({ variant, sm, block, className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={classeBotao({ variant, sm, block, className })} {...rest} />;
}

type LinkButtonProps = EstiloBotao & Omit<ComponentProps<typeof Link>, "className">;

/** Link com aparência de botão (.btn). */
export function LinkButton({ variant, sm, block, className, ...rest }: LinkButtonProps) {
  return <Link className={classeBotao({ variant, sm, block, className })} {...rest} />;
}
