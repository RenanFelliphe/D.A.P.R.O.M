"use client";

import { Button } from "@/components/ui/Button";
import { useAlertas } from "@/state/alertas";
import { useToast } from "@/state/toast";

/** Marca o alerta aberto como lido, o que também baixa o contador do sino e do menu. */
export function BotaoMarcarComoLido() {
  const { marcarSelecionadoComoLido } = useAlertas();
  const exibirAviso = useToast();

  function marcar() {
    marcarSelecionadoComoLido();
    exibirAviso("Alerta marcado como lido.");
  }

  return (
    <Button variant="ghost" sm onClick={marcar}>
      Marcar como lido
    </Button>
  );
}
