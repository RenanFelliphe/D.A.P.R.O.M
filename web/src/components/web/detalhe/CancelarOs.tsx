"use client";

import { useState } from "react";
import { JanelaDeAssinatura } from "@/components/ausencia/JanelaDeAssinatura";
import { chamar } from "@/lib/cliente-api";
import { useMinhaAssinatura } from "@/state/minha-assinatura";

/** Cancela a OS de apoio (`POST /os/{id}/cancelar`): pede a justificativa e a assinatura do admin. Só aparece para OS de apoio liberada ou pendente. */
export function CancelarOs({ osId }: { osId: string }) {
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
      />
      <div className="row g8">
        <button className="btn btn-d btn-sm" type="button" onClick={pedirAssinatura}>
          Assinar e cancelar
        </button>
        <button className="btn btn-line btn-sm" type="button" onClick={() => setAberto(false)}>
          Voltar
        </button>
      </div>
      {erro && (
        <span role="alert" style={{ color: "var(--blq)", fontSize: 13.5 }}>
          {erro}
        </span>
      )}
      {assinando && (
        <JanelaDeAssinatura
          titulo="Cancelar a OS de apoio"
          tom="d"
          resumo="A OS de apoio é cancelada e sai do quadro da equipe."
          rotuloConfirmar="Assinar e cancelar"
          assinaturaPath={assinaturaPath}
          aoConfirmar={async () => {
            await chamar("POST", `/os/${osId}/cancelar`, { justificativa: justificativa.trim() });
          }}
          aoFechar={() => setAssinando(false)}
        >
          <p className="small">
            <strong>Justificativa:</strong> {justificativa.trim()}
          </p>
        </JanelaDeAssinatura>
      )}
    </div>
  );
}
