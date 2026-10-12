"use client";

import { Icon } from "@/components/ui/Icon";
import { estadoDoTreino } from "./estado";

/** Botão flutuante e discreto do modo livre: abre o tutorial direcionado de onde parou. */
export function BotaoRoteiro() {
  return (
    <button type="button" className="tr-roteiro" aria-label="Abrir o roteiro do tutorial" onClick={() => estadoDoTreino.definirModo("direcionado")}>
      <Icon name="list" size={16} />
      Roteiro
    </button>
  );
}
