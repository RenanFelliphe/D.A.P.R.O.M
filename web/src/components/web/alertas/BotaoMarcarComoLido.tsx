"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { chamar } from "@/lib/cliente-api";
import { useToast } from "@/state/toast";

/** Marca o alerta como lido (`PATCH /alertas/{id}`); a tela é atualizada, e com ela o contador do sino e do menu. */
export function BotaoMarcarComoLido({ alertaId }: { alertaId: string }) {
  const roteador = useRouter();
  const exibirAviso = useToast();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function marcar() {
    setEnviando(true);
    setErro(null);
    try {
      await chamar("PATCH", `/alertas/${alertaId}`, { lido: true });
      exibirAviso("Alerta marcado como lido.");
      roteador.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível marcar como lido.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <span className="row g8">
      <Button variant="ghost" sm onClick={marcar} disabled={enviando}>
        Marcar como lido
      </Button>
      {erro && (
        <span className="small" role="alert" style={{ color: "var(--blq)" }}>
          {erro}
        </span>
      )}
    </span>
  );
}
