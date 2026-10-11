"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { chamar } from "@/lib/cliente-api";

/** "Dar ciência" do supervisor da equipe, na OS encerrada (`POST /os/{id}/ciencia`). Depois a tela recarrega com "Ciente em…". */
export function BotaoCiencia({ osId }: { osId: string }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  async function darCiencia() {
    setErro(null);
    setEnviando(true);
    try {
      await chamar("POST", `/os/${osId}/ciencia`);
      iniciar(() => router.refresh());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível registrar a ciência");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="stack g8">
      <button className="btn btn-p btn-sm" type="button" onClick={darCiencia} disabled={enviando} style={{ alignSelf: "flex-start" }}>
        <Icon name="check" size={16} />
        {enviando ? "Registrando…" : "Dar ciência"}
      </button>
      {erro && (
        <span role="alert" style={{ color: "var(--blq)", fontSize: 13.5 }}>
          {erro}
        </span>
      )}
    </div>
  );
}
