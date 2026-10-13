"use client";

import { UNIDADES, type Intervalo, type IntervaloUnidade } from "@/lib/preventivas";

interface CampoIntervaloProps {
  id: string;
  valor: Intervalo | null;
  aoMudar: (valor: Intervalo | null) => void;
  desabilitado?: boolean;
  /** Rótulo acessível do grupo (quando o rótulo visível está fora). */
  rotulo?: string;
}

/**
 * O intervalo entre ciclos: a quantidade e a unidade ("3" + "meses"). Quantidade em branco é "sem intervalo". As unidades
 * vão de dias a anos, com quinzena, bimestre, trimestre e semestre.
 */
export function CampoIntervalo({ id, valor, aoMudar, desabilitado, rotulo = "Intervalo entre ciclos" }: CampoIntervaloProps) {
  const quantidade = valor?.quantidade ?? "";
  const unidade: IntervaloUnidade = valor?.unidade ?? "mes";
  const plural = valor !== null && valor.quantidade !== 1;

  return (
    <div className="campo-intervalo" role="group" aria-label={rotulo}>
      <span className="small" aria-hidden="true">
        a cada
      </span>
      <input
        id={id}
        className="input"
        type="number"
        inputMode="numeric"
        min={1}
        max={999}
        placeholder="—"
        aria-label="Quantidade"
        value={quantidade}
        disabled={desabilitado}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          aoMudar(Number.isFinite(n) && n > 0 ? { quantidade: Math.min(n, 999), unidade } : null);
        }}
      />
      <select
        className="select"
        aria-label="Unidade"
        value={unidade}
        disabled={desabilitado}
        onChange={(e) => aoMudar({ quantidade: valor?.quantidade ?? 1, unidade: e.target.value as IntervaloUnidade })}
      >
        {UNIDADES.map((u) => (
          <option key={u.valor} value={u.valor}>
            {plural ? u.plural : u.singular}
          </option>
        ))}
      </select>
    </div>
  );
}
