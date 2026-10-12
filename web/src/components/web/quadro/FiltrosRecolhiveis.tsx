"use client";

import { useId, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

interface FiltrosRecolhiveisProps {
  /** Há algum filtro em uso: o botão avisa mesmo com a seção fechada. */
  filtrado: boolean;
  children: ReactNode;
}

/** No desktop mostra os filtros direto; no tablet e no celular eles ficam ocultos até o botão "Filtrar" ser tocado. */
export function FiltrosRecolhiveis({ filtrado, children }: FiltrosRecolhiveisProps) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  return (
    <div className="filtros-recolhiveis">
      <button
        type="button"
        className="btn btn-line btn-sm filtros-toggle"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((a) => !a)}
      >
        <Icon name="search" size={16} />
        Filtrar
        {filtrado && <span className="filtros-ponto" aria-label="filtros ativos" />}
      </button>
      <div id={id} className="filtros-corpo" data-aberto={aberto}>
        {children}
      </div>
    </div>
  );
}
