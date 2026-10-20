"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { enviarEvento } from "@/lib/cliente-api";
import { ROTULO_DO_PEDIDO, type PedidoDaApi } from "@/lib/execucao-pedidos";
import { ContagemDoPedido, useRestanteDoPedido } from "./ContagemDoPedido";
import { useAcao } from "./useAcao";

interface Props {
  osId: string;
  usuarioId: string;
  /** O responsável pela execução, a quem o pedido foi feito. */
  responsavel: string;
  pedido: PedidoDaApi;
}

/**
 * O pedido aberto, visto por quem não é o responsável. Para quem pediu: a contagem, a explicação de que sem resposta ele é aprovado
 * sozinho e "Cancelar o pedido". Para os outros participantes: quem pediu o quê, e "Apoiar o pedido" (fica no relatório).
 */
export function PedidoDoParticipante({ osId, usuarioId, responsavel, pedido }: Props) {
  const router = useRouter();
  const { ocupado, erro, executar } = useAcao();
  const restante = useRestanteDoPedido(pedido.restante_ms ?? 0);
  const meu = pedido.solicitante.id === usuarioId;
  const jaApoiei = pedido.apoios.some((a) => a.id === usuarioId);
  const o = ROTULO_DO_PEDIDO[pedido.tipo];

  const enviar = (tipo: "pedido_cancelado" | "pedido_apoiado") =>
    executar(async () => {
      await enviarEvento({ tipo, os_id: osId, payload: { pedido_id: pedido.id } });
      router.refresh();
    });

  return (
    <div className="stack g8">
      {meu ? (
        <Notice tone="al" icon="clock" role="status">
          <strong>
            {restante > 0 ? (
              <>
                Aguardando {responsavel} — <ContagemDoPedido restanteMs={pedido.restante_ms ?? 0} />
              </>
            ) : (
              "O prazo acabou"
            )}
          </strong>
          <br />
          {restante > 0 ? `Você pediu para ${o}. Se ${responsavel} não responder em 2 minutos, o pedido é aprovado sozinho.` : "O pedido está sendo aprovado sozinho."}
        </Notice>
      ) : (
        <Notice tone="info" icon="clock" role="status">
          <strong>
            {pedido.solicitante.nome} pediu para {o}.
          </strong>{" "}
          {restante > 0 ? (
            <>
              {responsavel} responde em até 2 minutos (<ContagemDoPedido restanteMs={pedido.restante_ms ?? 0} />); sem resposta, o pedido é aprovado sozinho.
            </>
          ) : (
            "O pedido está sendo aprovado sozinho."
          )}
        </Notice>
      )}
      {pedido.apoios.length > 0 && <p className="small">Apoiado por {pedido.apoios.map((a) => a.nome).join(", ")}.</p>}
      {erro && (
        <Notice tone="blq" icon="alert" role="alert">
          {erro.mensagem}
        </Notice>
      )}
      {restante > 0 && meu && (
        <Button variant="line" onClick={() => void enviar("pedido_cancelado")} disabled={ocupado} aria-busy={ocupado}>
          Cancelar o pedido
        </Button>
      )}
      {restante > 0 && !meu && !jaApoiei && (
        <Button variant="line" onClick={() => void enviar("pedido_apoiado")} disabled={ocupado} aria-busy={ocupado}>
          <Icon name="check" size={18} />
          Apoiar o pedido
        </Button>
      )}
    </div>
  );
}
