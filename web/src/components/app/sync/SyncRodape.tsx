import { PainelAcoes } from "@/components/app/AppChrome";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { rotas } from "@/lib/telas";
import type { SituacaoSync } from "@/state/sincronizacao";

interface SyncRodapeProps {
  situacao: SituacaoSync;
  aoSincronizar: () => void;
}

/** Ações da sincronização: enviar agora; ao terminar, atalhos para ver a OS no painel ou voltar à lista. */
export function SyncRodape({ situacao, aoSincronizar }: SyncRodapeProps) {
  if (situacao === "concluida") {
    return (
      <PainelAcoes>
        <LinkButton variant="p" block href={rotas.web.detalhe}>
          <Icon name="grid" size={18} />
          Ver a OS no painel web
        </LinkButton>
        <LinkButton variant="line" block href={rotas.app.lista} sm>
          Voltar às OS
        </LinkButton>
      </PainelAcoes>
    );
  }

  const enviando = situacao === "enviando";
  return (
    <PainelAcoes>
      <Button variant="p" block id="sy-btn" disabled={enviando} onClick={aoSincronizar}>
        <Icon name="refresh" size={18} className={enviando ? "spin" : undefined} />
        {enviando ? "Sincronizando…" : "Sincronizar agora"}
      </Button>
    </PainelAcoes>
  );
}
