"use client";

import { useCallback } from "react";
import { Icon } from "@/components/ui/Icon";
import { numero, pontos, textoDosPontosGanhos, type RespostaComPontos } from "@/lib/gamificacao";
import { useToast } from "@/state/toast";

/**
 * O aviso "+N pontos" depois de uma ação (APR, execução, ciência, intervalo da preventiva, assinatura, treino), com o que gerou
 * os pontos. Não mostra nada sem pontos (o campo de treino e o reenvio de um evento não pontuam).
 */
export function PontosGanhos({ resposta, className }: { resposta: RespostaComPontos | null | undefined; className?: string }) {
  const total = resposta?.pontos_ganhos ?? 0;
  if (total <= 0) return null;
  const ganhos = (resposta?.ganhos ?? []).filter((g) => g.pontos > 0);
  return (
    <div className={className ? `pontos-ganhos ${className}` : "pontos-ganhos"} role="status">
      <span className="pg-linha">
        <Icon name="trophy" size={18} />+{pontos(total)}
      </span>
      {ganhos.length > 0 && <span className="pg-detalhe">{ganhos.map((g) => `${g.nome} +${numero(g.pontos)}`).join(" · ")}</span>}
    </div>
  );
}

/** A função que mostra o "+N pontos" como aviso rápido (para as ações que levam a outra tela logo em seguida). Sem pontos, não faz nada. */
export function useAvisoDePontos() {
  const exibirAviso = useToast();
  return useCallback(
    (resposta: RespostaComPontos | null | undefined) => {
      const texto = textoDosPontosGanhos(resposta);
      if (texto) exibirAviso(texto);
    },
    [exibirAviso],
  );
}
