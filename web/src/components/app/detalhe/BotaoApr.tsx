"use client";

import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { avisoAoDescartar, continuaNasAssinaturas, estaTravada } from "@/lib/apr";
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

/**
 * "Nova APR" (ou "Continuar APR", se há rascunho neste navegador). Toda tentativa de APR começa do zero. O rascunho
 * aprovado continua nas assinaturas; o bloqueado (já registrado), na evidência dos itens reprovados.
 */
export function BotaoApr({ osId, usuarioId, pendente, jaAprovada }: BotaoAprProps) {
  const { rascunho, descartar } = useRascunhoApr(osId, usuarioId);

  if (rascunho) {
    return (
      <>
        <LinkButton
          variant={jaAprovada ? "line" : "p"}
          block
          href={continuaNasAssinaturas(rascunho) ? rotas.app.aprovada(osId) : rotas.app.checklist(osId)}
          data-treino="os-nova-apr"
        >
          <Icon name="save" size={18} />
          {estaTravada(rascunho) ? "Registrar a evidência" : "Continuar APR"}
        </LinkButton>
        <Button variant="ghost" sm block onClick={() => window.confirm(avisoAoDescartar(rascunho)) && descartar()}>
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
