"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { chamar, ErroCliente } from "@/lib/cliente-api";

/** Marca uma pergunta sem resposta como tratada (`PATCH /vitoria/sem-resposta/{id}`); admin, depois de melhorar o manual. */
export function BotaoTratarPergunta({ id }: { id: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function tratar() {
    setOcupado(true);
    setErro(null);
    try {
      await chamar("PATCH", `/vitoria/sem-resposta/${id}`);
      router.refresh();
    } catch (e) {
      setErro(e instanceof ErroCliente ? e.message : "Não foi possível agora. Tente de novo.");
      setOcupado(false);
    }
  }

  return (
    <div className="stack g4">
      <Button sm variant="line" onClick={() => void tratar()} disabled={ocupado}>
        {ocupado ? "Marcando…" : "Marcar como tratada"}
      </Button>
      {erro && (
        <span className="small" style={{ color: "var(--blq)" }}>
          {erro}
        </span>
      )}
    </div>
  );
}
