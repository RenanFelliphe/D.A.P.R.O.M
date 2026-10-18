"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { itemSemRevisao, type MetaIA } from "@/lib/treinamento-servico";

interface MetaIADoItemProps {
  item: { ia?: MetaIA | null };
  aoConfirmar: () => void;
  /** Botões extras do item (ex.: "Regerar esta fase"). */
  acoes?: ReactNode;
}

/**
 * O que a IA diz de um passo ou de uma fase (seção 3.6 do `vitoria.md`): o trecho do texto de onde saiu e as pendências das
 * conferências. A pendência some quando o admin edita o item ou o confirma como está; as duas coisas ficam marcadas.
 */
export function MetaIADoItem({ item, aoConfirmar, acoes }: MetaIADoItemProps) {
  if (!item.ia) return acoes ? <div className="row g6 wrap">{acoes}</div> : null;
  const semRevisao = itemSemRevisao(item);
  const pendencias = semRevisao ? item.ia.pendencias : [];
  return (
    <div className="stack g6" style={{ borderLeft: "3px solid var(--brand)", paddingLeft: 10 }}>
      <span className="small muted">
        Feito pela Vitória a partir de: <q>{item.ia.origem || "(sem trecho indicado)"}</q>
      </span>
      {pendencias.length > 0 && (
        <Notice tone="al" icon="alert">
          <span className="stack g4">
            {pendencias.map((p) => (
              <span key={p.codigo}>{p.mensagem}</span>
            ))}
            <span className="small">Edite o item ou confirme-o como está.</span>
          </span>
        </Notice>
      )}
      <div className="row g6 wrap" style={{ alignItems: "center" }}>
        {pendencias.length > 0 && (
          <Button variant="line" sm onClick={aoConfirmar}>
            Confirmar como está
          </Button>
        )}
        {item.ia.conferido ? <Badge tone="enc">Conferido</Badge> : !semRevisao ? <Badge tone="neu">Editado</Badge> : null}
        {acoes}
      </div>
    </div>
  );
}
