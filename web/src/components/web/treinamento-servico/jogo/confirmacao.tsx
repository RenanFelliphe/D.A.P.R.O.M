"use client";

import { createContext, useContext, useId } from "react";
import { Button } from "@/components/ui/Button";

/** Uma ação que pede confirmação antes (recomeçar, avançar sem confirmar a fase, jogar de novo...). */
export interface PedidoDeConfirmacao {
  titulo: string;
  texto: string;
  /** O botão que confirma ("Recomeçar a fase"); o outro sempre volta ao jogo como estava. */
  confirmar: string;
  /** O botão que desiste; padrão "Voltar ao jogo". */
  voltar?: string;
  aoConfirmar: () => void;
}

const ContextoDaConfirmacao = createContext<(pedido: PedidoDeConfirmacao) => void>((pedido) => pedido.aoConfirmar());

/** A janela do jogo mostra a caixa; as telas só pedem (fora da janela, a ação segue sem perguntar). */
export const ProvedorDaConfirmacao = ContextoDaConfirmacao.Provider;
export const useConfirmacao = () => useContext(ContextoDaConfirmacao);

/**
 * A caixa de confirmação por cima de tudo, dentro da janela do jogo (sair, finalizar com fase pendente, recomeçar...). O
 * foco começa em "Voltar ao jogo": Enter por engano não faz nada que não dê para desfazer.
 */
export function CaixaDeConfirmacao({
  titulo,
  texto,
  confirmar,
  voltar = "Voltar ao jogo",
  ocupado,
  aoConfirmar,
  aoVoltar,
}: {
  titulo: string;
  texto: string;
  confirmar: string;
  voltar?: string;
  ocupado?: boolean;
  aoConfirmar: () => void;
  aoVoltar: () => void;
}) {
  const id = useId();
  return (
    <div className="ts-sair" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-titulo`} aria-describedby={`${id}-texto`}>
      <div className="ts-sair-caixa">
        <h3 id={`${id}-titulo`}>{titulo}</h3>
        <p id={`${id}-texto`} className="muted">
          {texto}
        </p>
        <div className="row g8 wrap">
          <Button variant="p" onClick={aoVoltar} autoFocus>
            {voltar}
          </Button>
          <Button variant="line" onClick={aoConfirmar} disabled={ocupado}>
            {confirmar}
          </Button>
        </div>
      </div>
    </div>
  );
}
