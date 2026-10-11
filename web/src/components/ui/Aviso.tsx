"use client";

import type { ComponentProps, MouseEvent } from "react";
import { useToast } from "@/state/toast";

type BotaoAvisoProps = { aviso: string } & ComponentProps<"button">;

/** Botão sem o visual de .btn (cartões, fotos) que só mostra um aviso de demonstração. */
export function BotaoAviso({ aviso, type = "button", onClick, ...rest }: BotaoAvisoProps) {
  const exibirAviso = useToast();

  function aoClicar(evento: MouseEvent<HTMLButtonElement>) {
    onClick?.(evento);
    exibirAviso(aviso);
  }

  return <button type={type} onClick={aoClicar} {...rest} />;
}

type LinkAvisoProps = { aviso: string } & Omit<ComponentProps<"a">, "href">;

/** Link de texto sem destino (href="#") que só mostra um aviso de demonstração. */
export function LinkAviso({ aviso, onClick, ...rest }: LinkAvisoProps) {
  const exibirAviso = useToast();

  function aoClicar(evento: MouseEvent<HTMLAnchorElement>) {
    evento.preventDefault();
    onClick?.(evento);
    exibirAviso(aviso);
  }

  return <a href="#" onClick={aoClicar} {...rest} />;
}
