"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { chamar } from "@/lib/cliente-api";

/** Cancela a OS de apoio (`POST /os/{id}/cancelar`): pede a justificativa e confirma. Só aparece para OS de apoio liberada ou pendente. */
export function CancelarOs({ osId }: { osId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  async function cancelar() {
    setErro(null);
    if (!justificativa.trim()) {
      setErro("Justificativa obrigatória");
      return;
    }
    setEnviando(true);
    try {
      await chamar("POST", `/os/${osId}/cancelar`, { justificativa: justificativa.trim() });
      iniciar(() => router.refresh());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível cancelar a OS");
      setEnviando(false);
    }
  }

  if (!aberto) {
    return (
      <button className="btn btn-od btn-sm" type="button" onClick={() => setAberto(true)} style={{ alignSelf: "flex-start" }}>
        Cancelar OS de apoio
      </button>
    );
  }

  return (
    <div className="stack g8">
      <label className="small" htmlFor="cancelar-justificativa" style={{ color: "var(--ink3)" }}>
        Justificativa do cancelamento
      </label>
      <textarea
        id="cancelar-justificativa"
        className="textarea"
        rows={3}
        value={justificativa}
        onChange={(e) => setJustificativa(e.target.value)}
        placeholder="Por que esta OS está sendo cancelada?"
        disabled={enviando}
      />
      <div className="row g8">
        <button className="btn btn-d btn-sm" type="button" onClick={cancelar} disabled={enviando}>
          {enviando ? "Cancelando…" : "Confirmar cancelamento"}
        </button>
        <button className="btn btn-line btn-sm" type="button" onClick={() => setAberto(false)} disabled={enviando}>
          Voltar
        </button>
      </div>
      {erro && (
        <span role="alert" style={{ color: "var(--blq)", fontSize: 13.5 }}>
          {erro}
        </span>
      )}
    </div>
  );
}
