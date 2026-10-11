"use client";

import { LinkButton } from "@/components/ui/Button";
import { rotas } from "@/lib/telas";
import { useChecklist } from "@/state/checklist";

/** Abre o checklist de uma APR nova: toda tentativa começa do zero, sem respostas herdadas. */
export function IniciarChecklist() {
  const { reiniciar } = useChecklist();
  return (
    <LinkButton variant="p" block href={rotas.app.checklist} onClick={reiniciar}>
      Começar checklist · 18 itens
    </LinkButton>
  );
}
