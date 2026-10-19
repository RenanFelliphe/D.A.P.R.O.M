"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { itemSemRevisao, type MetaIA } from "@/lib/treinamento-servico";

type ItemComMeta = { ia?: MetaIA | null };

/** A situação de um item: feito à mão, da Vitória sem pendência, com pendência, editado depois ou conferido como está. */
export function situacaoDoItem(item: ItemComMeta): "manual" | "pendente" | "vitoria" | "editado" | "conferido" {
  if (!item.ia) return "manual";
  if (item.ia.conferido) return "conferido";
  if (!itemSemRevisao(item)) return "editado";
  return item.ia.pendencias.length > 0 ? "pendente" : "vitoria";
}

const SELOS = {
  manual: { tom: "neu", texto: "Feito à mão" },
  vitoria: { tom: "brand", texto: "Da Vitória" },
  pendente: { tom: "al", texto: "Pendente" },
  editado: { tom: "lib", texto: "Editado" },
  conferido: { tom: "enc", texto: "Conferido" },
} as const;

/** O selo do item na lista (o mesmo na revisão e nos editores). */
export function SeloDoItem({ item }: { item: ItemComMeta }) {
  const selo = SELOS[situacaoDoItem(item)];
  return <Badge tone={selo.tom}>{selo.texto}</Badge>;
}

interface OrigemDaVitoriaProps {
  item: ItemComMeta;
  aoConfirmar: () => void;
  /** Botões extras ("Regerar com a Vitória", "Editar"). */
  acoes?: ReactNode;
  desabilitado?: boolean;
}

/**
 * O que a Vitória diz de um passo ou de uma fase que ela montou (seção 3.6 do `vitoria.md`): o trecho do procedimento de onde
 * saiu e as pendências das conferências. Uma pendência some quando o admin edita o item ou o confirma como está.
 */
export function OrigemDaVitoria({ item, aoConfirmar, acoes, desabilitado }: OrigemDaVitoriaProps) {
  if (!item.ia) return acoes ? <div className="row g8 wrap">{acoes}</div> : null;
  const situacao = situacaoDoItem(item);
  const pendencias = situacao === "pendente" ? item.ia.pendencias : [];

  return (
    <div className="ts-origem" data-estado={situacao}>
      <span className="ts-origem-rotulo">
        <Icon name="sparkle" size={13} />
        De onde a Vitória tirou
      </span>
      <blockquote className="ts-origem-trecho">{item.ia.origem || "A Vitória não indicou o trecho."}</blockquote>
      {pendencias.length > 0 && (
        <ul className="ts-pendencias">
          {pendencias.map((p) => (
            <li key={p.codigo}>
              <Icon name="alert" size={13} />
              {p.mensagem}
            </li>
          ))}
        </ul>
      )}
      {(pendencias.length > 0 || acoes) && (
        <div className="row g8 wrap">
          {pendencias.length > 0 && (
            <Button variant="line" sm onClick={aoConfirmar} disabled={desabilitado}>
              <Icon name="check" size={13} />
              Confirmar como está
            </Button>
          )}
          {acoes}
        </div>
      )}
    </div>
  );
}
