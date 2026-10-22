"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mensagemDoErro } from "@/components/app/execucao/useAcao";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { chamar } from "@/lib/cliente-api";

/** "Dar por atendida": o supervisor ou o admin diz que a ocorrência foi tratada (`POST /emergencias/{id}/atender`), com uma nota opcional; quem acionou é avisado. */
export function AtenderEmergencia({ emergenciaId }: { emergenciaId: string }) {
  const router = useRouter();
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function atender() {
    setEnviando(true);
    setErro(null);
    try {
      await chamar("POST", `/emergencias/${emergenciaId}/atender`, { nota: nota.trim() || null });
      router.refresh();
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="stack g8">
      <label className="stack g4">
        <span className="small">Nota do atendimento (opcional; quem acionou lê)</span>
        <input className="input" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: brigada no local, pessoa socorrida" />
      </label>
      {erro && (
        <Notice tone="blq" icon="alert" role="alert">
          {erro}
        </Notice>
      )}
      <div>
        <Button variant="p" sm onClick={() => void atender()} disabled={enviando} aria-busy={enviando}>
          {enviando ? "Salvando…" : "Dar por atendida"}
        </Button>
      </div>
    </div>
  );
}
