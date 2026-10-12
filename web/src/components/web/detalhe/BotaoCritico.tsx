"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { chamar } from "@/lib/cliente-api";

interface BotaoCriticoProps {
  localId: string;
  critico: boolean;
}

/** Marca o local como crítico ou não crítico (`PATCH /locais/{id}`; admin). Vale para todas as OS do local. */
export function BotaoCritico({ localId, critico }: BotaoCriticoProps) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  async function alternar() {
    setErro(null);
    setEnviando(true);
    try {
      await chamar("PATCH", `/locais/${localId}`, { critico: !critico });
      iniciar(() => router.refresh());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível alterar o local");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="stack g6">
      <button className="btn btn-line btn-block" type="button" onClick={alternar} disabled={enviando}>
        {enviando ? "Salvando…" : critico ? "Marcar local como não crítico" : "Marcar local como crítico"}
      </button>
      {erro && (
        <span role="alert" style={{ color: "var(--blq)", fontSize: 13.5 }}>
          {erro}
        </span>
      )}
    </div>
  );
}
