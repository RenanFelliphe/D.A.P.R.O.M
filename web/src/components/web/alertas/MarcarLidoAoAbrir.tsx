"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { chamar } from "@/lib/cliente-api";

/**
 * Marca o alerta como lido (`PATCH /alertas/{id}`) assim que ele é aberto no painel; em seguida a tela é atualizada, e com
 * ela o contador do sino e a lista. Não desenha nada. Se a chamada falhar o alerta segue não lido, e abrir de novo tenta outra vez.
 */
export function MarcarLidoAoAbrir({ alertaId }: { alertaId: string }) {
  const roteador = useRouter();
  const enviado = useRef(false);

  useEffect(() => {
    if (enviado.current) return;
    enviado.current = true;
    chamar("PATCH", `/alertas/${alertaId}`, { lido: true })
      .then(() => roteador.refresh())
      .catch(() => {});
  }, [alertaId, roteador]);

  return null;
}
