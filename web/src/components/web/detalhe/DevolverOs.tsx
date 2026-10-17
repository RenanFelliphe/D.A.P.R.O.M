"use client";

import { useState } from "react";
import { JanelaDeAssinatura } from "@/components/ausencia/JanelaDeAssinatura";
import { Panel } from "@/components/web/Panel";
import { chamar } from "@/lib/cliente-api";
import { useMinhaAssinatura } from "@/state/minha-assinatura";

/**
 * Devolve a OS ao SAP (`POST /os/{id}/devolver`): o supervisor escreve a justificativa (o erro que viu na ordem) e assina; a OS sai
 * do quadro da equipe e a justificativa vai na próxima planilha de baixa, que o SAP usa para corrigir a ordem. O SYNQ OS não
 * escreve no SAP. Só aparece para a OS liberada, que ainda não foi iniciada.
 */
export function DevolverOs({ osId }: { osId: string }) {
  const assinaturaPath = useMinhaAssinatura();
  const [aberto, setAberto] = useState(false);
  const [assinando, setAssinando] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function pedirAssinatura() {
    setErro(null);
    if (!justificativa.trim()) {
      setErro("Justificativa obrigatória");
      return;
    }
    setAssinando(true);
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
          />
          <div className="row g8">
            <button className="btn btn-d btn-sm" type="button" onClick={pedirAssinatura}>
              Assinar e devolver
            </button>
            <button className="btn btn-line btn-sm" type="button" onClick={() => setAberto(false)}>
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
      {assinando && (
        <JanelaDeAssinatura
          titulo="Devolver a OS ao SAP"
          tom="d"
          resumo="A OS sai do quadro da equipe e a sua justificativa vai na próxima planilha de baixa."
          rotuloConfirmar="Assinar e devolver"
          assinaturaPath={assinaturaPath}
          aoConfirmar={async () => {
            await chamar("POST", `/os/${osId}/devolver`, { justificativa: justificativa.trim() });
          }}
          aoFechar={() => setAssinando(false)}
        >
          <p className="small">
            <strong>Justificativa:</strong> {justificativa.trim()}
          </p>
        </JanelaDeAssinatura>
      )}
    </Panel>
  );
}
