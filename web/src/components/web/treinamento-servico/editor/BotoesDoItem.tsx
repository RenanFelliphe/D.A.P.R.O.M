"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";

interface BotoesDoItemProps {
  /** "passo 3", "fase 2": vai no nome acessível de cada botão. */
  nome: string;
  primeiro: boolean;
  ultimo: boolean;
  aoSubir: () => void;
  aoDescer: () => void;
  aoTirar: () => void;
}

/** Subir, descer e tirar um passo ou uma fase; tirar pede um segundo toque, para não apagar sem querer. */
export function BotoesDoItem({ nome, primeiro, ultimo, aoSubir, aoDescer, aoTirar }: BotoesDoItemProps) {
  const [confirmando, setConfirmando] = useState(false);

  return (
    <span className="ts-item-acoes">
      <button type="button" className="ibtn" onClick={aoSubir} disabled={primeiro} aria-label={`Subir o ${nome}`} title="Subir">
        <Icon name="up" size={16} />
      </button>
      <button type="button" className="ibtn" onClick={aoDescer} disabled={ultimo} aria-label={`Descer o ${nome}`} title="Descer">
        <Icon name="down" size={16} />
      </button>
      {confirmando ? (
        <button type="button" className="ts-tirar-confirma" onClick={aoTirar} onBlur={() => setConfirmando(false)} autoFocus>
          Tirar?
        </button>
      ) : (
        <button type="button" className="ibtn ts-ibtn-perigo" onClick={() => setConfirmando(true)} aria-label={`Tirar o ${nome}`} title="Tirar">
          <Icon name="trash" size={16} />
        </button>
      )}
    </span>
  );
}
