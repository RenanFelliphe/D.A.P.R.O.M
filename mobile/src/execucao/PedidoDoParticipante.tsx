import { StyleSheet, Text, View } from "react-native";
import { contagemDoPedido, restanteDoPedido, ROTULO_DO_PEDIDO, type PedidoDaApi } from "@shared/api/execucao-pedidos";
import { enviarEvento } from "@/offline/app";
import { useAcao, useAtualizarDepoisDoEvento } from "@/campo/useAcao";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { useAgora } from "./useAgora";

interface PedidoDoParticipanteProps {
  osId: string;
  usuarioId: string;
  /** O responsável pela execução, a quem o pedido foi feito. */
  responsavel: string;
  pedido: PedidoDaApi;
  /** Quando a resposta da `api` que trouxe o pedido chegou (ms): a contagem desconta o tempo que passou desde então. */
  recebidoEm: number;
}

/**
 * O pedido aberto, visto por quem não é o responsável. Para quem pediu: a contagem, a explicação de que sem resposta ele é aprovado
 * sozinho e "Cancelar o pedido". Para os outros participantes: quem pediu o quê, e "Apoiar o pedido" (fica no relatório).
 */
export function PedidoDoParticipante({ osId, usuarioId, responsavel, pedido, recebidoEm }: PedidoDoParticipanteProps) {
  const atualizarDepois = useAtualizarDepoisDoEvento();
  const { ocupado, erro, executar } = useAcao();
  const restante = restanteDoPedido(pedido, recebidoEm, useAgora(1000));
  const meu = pedido.solicitante.id === usuarioId;
  const jaApoiei = pedido.apoios.some((a) => a.id === usuarioId);
  const o = ROTULO_DO_PEDIDO[pedido.tipo];

  const enviar = (tipo: "pedido_cancelado" | "pedido_apoiado") => executar(() => enviarEvento({ tipo, os_id: osId, payload: { pedido_id: pedido.id } }).then(() => atualizarDepois().then(() => undefined)));

  return (
    <View style={estilos.cartao}>
      {meu ? (
        <Aviso tom="al" icone="time-outline" titulo={restante > 0 ? `Aguardando ${responsavel} — ${contagemDoPedido(restante)}` : "O prazo acabou"}>
          {restante > 0 ? `Você pediu para ${o}. Se ${responsavel} não responder em 2 minutos, o pedido é aprovado sozinho.` : "O pedido está sendo aprovado sozinho."}
        </Aviso>
      ) : (
        <Aviso tom="info" icone="time-outline" titulo={`${pedido.solicitante.nome} pediu para ${o}.`}>
          {restante > 0 ? `${responsavel} responde em até 2 minutos (${contagemDoPedido(restante)}); sem resposta, o pedido é aprovado sozinho.` : "O pedido está sendo aprovado sozinho."}
        </Aviso>
      )}
      {pedido.apoios.length > 0 ? <Text style={estilos.suave}>{`Apoiado por ${pedido.apoios.map((a) => a.nome).join(", ")}.`}</Text> : null}
      {erro ? <Aviso tom="blq">{erro.mensagem}</Aviso> : null}
      {restante > 0 && meu ? <Botao titulo="Cancelar o pedido" variante="secundario" enviando={ocupado} aoPressionar={() => void enviar("pedido_cancelado")} /> : null}
      {restante > 0 && !meu && !jaApoiei ? <Botao titulo="Apoiar o pedido" variante="secundario" icone="thumbs-up-outline" enviando={ocupado} aoPressionar={() => void enviar("pedido_apoiado")} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { gap: espaco.s },
  suave: { fontSize: 13, color: cores.tinta4 },
});
