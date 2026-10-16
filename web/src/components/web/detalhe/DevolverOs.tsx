"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Panel } from "@/components/web/Panel";
import { chamar } from "@/lib/cliente-api";

/**
 * Devolve a OS ao SAP (`POST /os/{id}/devolver`): o supervisor escreve a justificativa (o erro que viu na ordem), a OS sai do
 * quadro da equipe e a justificativa vai na próxima planilha de baixa, que o SAP usa para corrigir a ordem. O DAPROM não
 * escreve no SAP. Só aparece para a OS liberada, que ainda não foi iniciada.
 */
export function DevolverOs({ osId }: { osId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  async function devolver() {
    setErro(null);
    if (!justificativa.trim()) {
      setErro("Justificativa obrigatória");
      return;
    }
    setEnviando(true);
    try {
      await chamar("POST", `/os/${osId}/devolver`, { justificativa: justificativa.trim() });
      iniciar(() => router.refresh());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível devolver a OS");
      setEnviando(false);
    }
  }

  return (
    <Panel style={{ gap: 10 }}>
      <h2>Devolver ao SAP</h2>
      <p className="muted">A ordem está com algum erro? Devolva com uma justificativa: a OS sai do quadro da equipe e a justificativa vai na planilha de baixa para o SAP corrigir.</p>
      {!aberto ? (
        <button className="btn btn-od btn-sm" type="button" onClick={() => setAberto(true)} style={{ alignSelf: "flex-start" }}>
          Devolver a OS
        </button>
      ) : (
        <div className="stack g8">
          <label className="small" htmlFor={`devolver-${osId}`} style={{ color: "var(--ink3)" }}>
            Justificativa da devolução
          </label>
          <textarea
            id={`devolver-${osId}`}
            className="textarea"
            rows={3}
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="O que está errado na ordem?"
            disabled={enviando}
          />
          <div className="row g8">
            <button className="btn btn-d btn-sm" type="button" onClick={devolver} disabled={enviando}>
              {enviando ? "Devolvendo…" : "Confirmar devolução"}
            </button>
            <button className="btn btn-line btn-sm" type="button" onClick={() => setAberto(false)} disabled={enviando}>
              Voltar
            </button>
          </div>
        </div>
      )}
      {erro && (
        <span role="alert" style={{ color: "var(--blq)", fontSize: 13.5 }}>
          {erro}
        </span>
      )}
    </Panel>
  );
}
