"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface BotaoExcluirProps {
  /** Texto do botão ("Excluir equipe"). */
  rotulo: string;
  /** Pergunta mostrada no segundo passo, antes de apagar de vez. */
  pergunta: string;
  /** Apaga o registro; o erro lançado (mensagem da `api`) aparece sob o botão. */
  aoExcluir: () => Promise<void>;
  desabilitado?: boolean;
}

/** Exclusão em dois passos: o primeiro clique pede a confirmação, o segundo apaga. */
export function BotaoExcluir({ rotulo, pergunta, aoExcluir, desabilitado }: BotaoExcluirProps) {
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function excluir() {
    setOcupado(true);
    setErro(null);
    try {
      await aoExcluir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir");
      setConfirmando(false);
    } finally {
      setOcupado(false);
    }
  }

  if (!confirmando) {
    return (
      <span className="stack g4">
        <Button variant="line" sm style={{ height: 32, color: "var(--blq)" }} onClick={() => setConfirmando(true)} disabled={desabilitado || ocupado}>
          {rotulo}
        </Button>
        {erro && (
          <span role="alert" className="small" style={{ color: "var(--blq)", whiteSpace: "normal" }}>
            {erro}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="stack g4">
      <span className="small" style={{ whiteSpace: "normal" }}>
        {pergunta}
      </span>
      <span className="row g6">
        <Button variant="line" sm style={{ height: 32, color: "var(--blq)" }} onClick={excluir} disabled={ocupado}>
          {ocupado ? "Excluindo…" : "Sim, excluir"}
        </Button>
        <Button variant="line" sm style={{ height: 32 }} onClick={() => setConfirmando(false)} disabled={ocupado}>
          Voltar
        </Button>
      </span>
    </span>
  );
}
