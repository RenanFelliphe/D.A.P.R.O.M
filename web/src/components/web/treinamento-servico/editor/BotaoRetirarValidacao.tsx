"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mensagemDoErro } from "@/components/app/execucao/useAcao";
import { Button } from "@/components/ui/Button";
import { MensagemDeErro } from "@/components/ui/Field";
import { chamar } from "@/lib/cliente-api";
import { useToast } from "@/state/toast";

/** Retira o treinamento da validação (`POST .../validacao/retirar`): o rascunho volta a ser editável e a rodada termina sem publicar. Pede um segundo toque. */
export function BotaoRetirarValidacao({ codigo }: { codigo: string }) {
  const roteador = useRouter();
  const exibirAviso = useToast();
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function retirar() {
    setOcupado(true);
    setErro(null);
    try {
      await chamar("POST", `/treinamentos/${encodeURIComponent(codigo)}/validacao/retirar`);
      exibirAviso("Treinamento retirado da validação. Você já pode editar.");
      roteador.refresh();
    } catch (e) {
      setErro(mensagemDoErro(e));
      setOcupado(false);
    }
  }

  return (
    <span className="stack g4">
      {confirmando ? (
        <span className="row g8 wrap">
          <Button variant="d" sm onClick={() => void retirar()} disabled={ocupado} aria-busy={ocupado}>
            {ocupado ? "Retirando…" : "Retirar mesmo"}
          </Button>
          <Button variant="ghost" sm onClick={() => setConfirmando(false)} disabled={ocupado}>
            Manter na validação
          </Button>
        </span>
      ) : (
        <Button variant="line" sm onClick={() => setConfirmando(true)}>
          Retirar da validação
        </Button>
      )}
      {erro && <MensagemDeErro>{erro}</MensagemDeErro>}
    </span>
  );
}
