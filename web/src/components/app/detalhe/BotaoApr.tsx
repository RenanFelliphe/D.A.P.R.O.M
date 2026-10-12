"use client";

import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { rotas } from "@/lib/rotas";
import { useRascunhoApr } from "@/state/rascunho-apr";

interface BotaoAprProps {
  osId: string;
  usuarioId: string;
  /** OS pendente: a APR anterior bloqueou; qualquer um da equipe retoma com APR nova. */
  pendente: boolean;
  /** Já há APR aprovada de hoje: uma nova passa a ser a opção secundária. */
  jaAprovada: boolean;
}

/** "Nova APR" (ou "Continuar APR", se há rascunho neste navegador). Toda tentativa de APR começa do zero. */
export function BotaoApr({ osId, usuarioId, pendente, jaAprovada }: BotaoAprProps) {
  const { rascunho, descartar } = useRascunhoApr(osId, usuarioId);

  if (rascunho) {
    const aprovada = rascunho.concluidaEm !== null;
    return (
      <>
        <LinkButton variant={jaAprovada ? "line" : "p"} block href={aprovada ? rotas.app.aprovada(osId) : rotas.app.checklist(osId)} data-treino="os-nova-apr">
          <Icon name="save" size={18} />
          Continuar APR
        </LinkButton>
        <Button variant="ghost" sm block onClick={descartar}>
          Descartar o rascunho
        </Button>
      </>
    );
  }
  return (
    <LinkButton variant={jaAprovada ? "line" : "p"} block href={rotas.app.apr(osId)} data-treino="os-nova-apr">
      {jaAprovada ? "Fazer uma nova APR" : pendente ? "Retomar com APR nova" : "Nova APR"}
    </LinkButton>
  );
}
