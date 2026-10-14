"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { chamar } from "@/lib/cliente-api";
import { textoDosPontosGanhos, type RespostaComPontos } from "@/lib/gamificacao";
import { useToast } from "@/state/toast";

/** "Dar ciência" do supervisor da equipe, na OS encerrada (`POST /os/{id}/ciencia`). Depois a tela recarrega com "Ciente em…". */
export function BotaoCiencia({ osId }: { osId: string }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  async function darCiencia() {
    setErro(null);
    setEnviando(true);
    try {
      const resposta = await chamar<RespostaComPontos>("POST", `/os/${osId}/ciencia`);
      // Ciência até 72 h depois do encerramento pontua o supervisor.
      const pontos = textoDosPontosGanhos(resposta);
      if (pontos) exibirAviso(`Ciência registrada · ${pontos}`);
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
