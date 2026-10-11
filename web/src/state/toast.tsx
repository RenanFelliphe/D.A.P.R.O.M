"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";

const DURACAO_MS = 3200;

type ExibirAviso = (mensagem: string) => void;

const ToastContext = createContext<ExibirAviso | null>(null);

/** Guarda o aviso temporário das ações simuladas e o desenha por cima do palco. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [mensagem, setMensagem] = useState("");
  const [visivel, setVisivel] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);

  const exibir = useCallback<ExibirAviso>((texto) => {
    setMensagem(texto);
    setVisivel(true);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setVisivel(false), DURACAO_MS);
  }, []);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  return (
    <ToastContext value={exibir}>
      {children}
      <div className={cx("toast", visivel && "show")} id="toast" role="status" aria-live="polite">
        {mensagem}
      </div>
    </ToastContext>
  );
}

/** Retorna a função que mostra um aviso temporário. */
export function useToast(): ExibirAviso {
  const exibir = useContext(ToastContext);
  if (!exibir) throw new Error("useToast precisa estar dentro de <ToastProvider>.");
  return exibir;
}
