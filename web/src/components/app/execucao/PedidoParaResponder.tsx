"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { descreverMotivo, rotuloDoMotivoDaSuspensao } from "@/lib/motivos-de-parada";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { JanelaSobreposta } from "@/components/ui/JanelaSobreposta";
import { Notice } from "@/components/ui/Notice";
import { ErroDeEnvio } from "@/components/ui/useFormulario";
import { enviarEvento } from "@/lib/cliente-api";
import { ROTULO_DO_PEDIDO, type PedidoDaApi } from "@/lib/execucao-pedidos";
import { ContagemDoPedido, useRestanteDoPedido } from "./ContagemDoPedido";
import { useAcao } from "./useAcao";

interface Props {
  osId: string;
  pedido: PedidoDaApi;
}

/**
 * O pedido de um participante ao responsável pela execução (encerrar a OS ou suspendê-la por um motivo comum): a contagem dos 2 minutos,
 * "Aprovar" e "Recusar" (com um motivo curto, opcional). Sem resposta, a `api` aprova sozinha ao fim da contagem.
 */
export function PedidoParaResponder({ osId, pedido }: Props) {
  const router = useRouter();
  const { ocupado, erro, limparErro, executar } = useAcao();
  const restante = useRestanteDoPedido(pedido.restante_ms ?? 0);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const o = `${pedido.solicitante.nome} pediu para ${ROTULO_DO_PEDIDO[pedido.tipo]}`;

  // Acabou o prazo: a `api` aprova sozinha; a tela relê a execução para mostrar o que aconteceu.
  const venceu = useRef(false);
  useEffect(() => {
    if (restante > 0 || venceu.current) return;
    venceu.current = true;
    router.refresh();
  }, [restante, router]);

  const decidir = (decisao: "aprovar" | "recusar", texto?: string) =>
    executar(async () => {
      await enviarEvento({ tipo: "pedido_decidido", os_id: osId, payload: { pedido_id: pedido.id, decisao, ...(texto ? { motivo: texto } : {}) } });
      setRecusando(false);
      router.refresh();
    });

  return (
    <div className="stack g8">
      <Notice tone="al" icon="clock" role="status">
        <strong>
          {o} — <ContagemDoPedido restanteMs={pedido.restante_ms ?? 0} />
        </strong>
        <br />
        {restante > 0
          ? `Responda em até 2 minutos. Sem resposta, o pedido é aprovado sozinho${pedido.tipo === "suspender" ? ` (motivo: ${descreverMotivo(rotuloDoMotivoDaSuspensao, pedido.motivo, pedido.complemento)})` : ""}.`
          : "O prazo acabou: o pedido está sendo aprovado sozinho."}
        {pedido.apoios.length > 0 && <> Apoiado por {pedido.apoios.map((a) => a.nome).join(", ")}.</>}
      </Notice>
      {erro && (
        <Notice tone="blq" icon="alert" role="alert">
          {erro.mensagem}
        </Notice>
      )}
      {restante > 0 && (
        <div className="row g8 wrap">
          <Button variant="p" onClick={() => void decidir("aprovar")} disabled={ocupado} aria-busy={ocupado} data-treino="pedido-aprovar">
            <Icon name="check" size={18} />
            Aprovar
          </Button>
          <Button
            variant="d"
            onClick={() => {
              limparErro();
              setRecusando(true);
            }}
            disabled={ocupado}
          >
            Recusar
          </Button>
        </div>
      )}
      {recusando && (
        <JanelaSobreposta titulo="Recusar o pedido" aoFechar={ocupado ? () => undefined : () => setRecusando(false)}>
          <div className="stack g12">
            <p>A execução continua. {pedido.solicitante.nome} vê a sua resposta; se quiser, diga o motivo.</p>
            <label className="stack g6">
              <span className="lbl">Motivo (opcional)</span>
              <textarea className="input" rows={3} maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: falta só uma peça, já vem" />
            </label>
            <ErroDeEnvio mensagem={erro?.mensagem ?? null} />
            <div className="row g8 wrap">
              <Button variant="d" onClick={() => void decidir("recusar", motivo.trim() || undefined)} disabled={ocupado} aria-busy={ocupado}>
                {ocupado ? "Recusando…" : "Recusar o pedido"}
              </Button>
              <Button variant="ghost" onClick={() => setRecusando(false)} disabled={ocupado}>
                Voltar
              </Button>
            </div>
          </div>
        </JanelaSobreposta>
      )}
    </div>
  );
}
