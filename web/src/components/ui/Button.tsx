"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { cx } from "@/lib/cx";
import { useToast } from "@/state/toast";

type Variante = "p" | "d" | "o" | "od" | "line" | "ghost";

interface EstiloBotao {
  variant?: Variante;
  sm?: boolean;
  block?: boolean;
  className?: string;
  /** Mensagem mostrada no aviso ao clicar (ações apenas simuladas na demonstração). */
  aviso?: string;
}

function classeBotao({ variant, sm, block, className }: EstiloBotao) {
  return cx("btn", variant && `btn-${variant}`, sm && "btn-sm", block && "btn-block", className);
}

type ButtonProps = EstiloBotao & Omit<ComponentProps<"button">, "className">;

/** Botão de ação (.btn). Para navegar entre telas use <LinkButton />. */
export function Button({ variant, sm, block, className, aviso, type = "button", onClick, ...rest }: ButtonProps) {
  const exibirAviso = useToast();

  function aoClicar(evento: MouseEvent<HTMLButtonElement>) {
    onClick?.(evento);
    if (aviso) exibirAviso(aviso);
  }

  return <button type={type} className={classeBotao({ variant, sm, block, className })} onClick={aoClicar} {...rest} />;
}

type LinkButtonProps = EstiloBotao & Omit<ComponentProps<typeof Link>, "className">;

/** Link com aparência de botão (.btn). Com `aviso`, mostra a mensagem e segue para o destino. */
export function LinkButton({ variant, sm, block, className, aviso, onClick, ...rest }: LinkButtonProps) {
  const exibirAviso = useToast();

  function aoClicar(evento: MouseEvent<HTMLAnchorElement>) {
    onClick?.(evento);
    if (aviso) exibirAviso(aviso);
  }

  return <Link className={classeBotao({ variant, sm, block, className })} onClick={aoClicar} {...rest} />;
}
