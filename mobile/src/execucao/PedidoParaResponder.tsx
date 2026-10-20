import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, Vibration, View } from "react-native";
import { z } from "zod";
import { contagemDoPedido, restanteDoPedido, ROTULO_DO_PEDIDO, type PedidoDaApi } from "@shared/api/execucao-pedidos";
import { descreverMotivo, rotuloDoMotivoDaSuspensao } from "@shared/api/motivos-de-parada";
import { enviarEvento } from "@/offline/app";
import { useAcao, useAtualizarDepoisDoEvento } from "@/campo/useAcao";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { CampoDeFormulario } from "@/ui/Campo";
import { JanelaDeFormulario } from "@/ui/JanelaDeFormulario";
import { useFormulario } from "@/ui/useFormulario";
import { useAgora } from "./useAgora";

interface PedidoParaResponderProps {
  osId: string;
  pedido: PedidoDaApi;
  /** Quando a resposta da `api` que trouxe o pedido chegou (ms): a contagem desconta o tempo que passou desde então. */
  recebidoEm: number;
}

const esquemaDaRecusa = z.object({ motivo: z.string().trim().max(200, "No máximo 200 caracteres.") });

/**
 * O pedido de um participante ao responsável pela execução (encerrar a OS ou suspendê-la por um motivo comum): a contagem dos 2 minutos,
 * "Aprovar" e "Recusar" (com um motivo curto, opcional). Sem resposta, a `api` aprova sozinha ao fim da contagem. O aparelho vibra quando
 * o pedido aparece.
 */
export function PedidoParaResponder({ osId, pedido, recebidoEm }: PedidoParaResponderProps) {
  const atualizarDepois = useAtualizarDepoisDoEvento();
  const { ocupado, erro, limparErro, executar } = useAcao();
  const agora = useAgora(1000);
  const [recusando, setRecusando] = useState(false);
  const restante = restanteDoPedido(pedido, recebidoEm, agora);
  const { form, enviar, enviando, erroEnvio } = useFormulario(esquemaDaRecusa, { motivo: "" });

  useEffect(() => {
    Vibration.vibrate([0, 400, 200, 400]);
  }, [pedido.id]);

  // Acabou o prazo: a `api` aprova sozinha; a tela relê a execução para mostrar o que aconteceu.
  const venceu = useRef(false);
  useEffect(() => {
    if (restante > 0 || venceu.current) return;
    venceu.current = true;
    void atualizarDepois();
  }, [restante, atualizarDepois]);

  const decidir = (decisao: "aprovar" | "recusar", motivo?: string) =>
    enviarEvento({ tipo: "pedido_decidido", os_id: osId, payload: { pedido_id: pedido.id, decisao, ...(motivo ? { motivo } : {}) } }).then(async () => {
      await atualizarDepois();
    });

  const o = `${pedido.solicitante.nome} pediu para ${ROTULO_DO_PEDIDO[pedido.tipo]}`;
  return (
    <View style={estilos.cartao}>
      <Aviso tom="al" icone="time-outline" titulo={restante > 0 ? `${o} — ${contagemDoPedido(restante)}` : `${o} — o prazo acabou`}>
        {restante > 0
          ? `Responda em até 2 minutos. Sem resposta, o pedido é aprovado sozinho${pedido.tipo === "suspender" ? ` (motivo: ${descreverMotivo(rotuloDoMotivoDaSuspensao, pedido.motivo, pedido.complemento)})` : ""}.`
          : "O pedido está sendo aprovado sozinho."}
      </Aviso>
      {pedido.apoios.length > 0 ? <Text style={estilos.suave}>{`Apoiado por ${pedido.apoios.map((a) => a.nome).join(", ")}.`}</Text> : null}
      {erro ? <Aviso tom="blq">{erro.mensagem}</Aviso> : null}
      {restante > 0 ? (
        <View style={estilos.linha}>
          <Botao titulo="Aprovar" icone="checkmark" bloco={false} estilo={estilos.metade} enviando={ocupado} aoPressionar={() => void executar(() => decidir("aprovar"))} />
          <Botao
            titulo="Recusar"
            variante="perigo"
            bloco={false}
            estilo={estilos.metade}
            aoPressionar={() => {
              limparErro();
              setRecusando(true);
            }}
          />
        </View>
      ) : null}
      {recusando ? (
        <JanelaDeFormulario titulo="Recusar o pedido" aoFechar={enviando ? () => undefined : () => setRecusando(false)}>
          <Text style={estilos.texto}>{`A execução continua. ${pedido.solicitante.nome} vê a sua resposta; se quiser, diga o motivo.`}</Text>
          <CampoDeFormulario control={form.control} nome="motivo" rotulo="Motivo (opcional)" placeholder="Ex.: falta só uma peça, já vem" multiline numberOfLines={3} textAlignVertical="top" style={estilos.area} />
          {erroEnvio ? <Aviso tom="blq">{erroEnvio}</Aviso> : null}
          <Botao
            titulo={enviando ? "Recusando…" : "Recusar o pedido"}
            variante="perigo"
            enviando={enviando}
            aoPressionar={() =>
              void enviar(async (valores) => {
                await decidir("recusar", valores.motivo.trim() || undefined);
                setRecusando(false);
              })()
            }
          />
          <Botao titulo="Voltar" variante="texto" aoPressionar={enviando ? () => undefined : () => setRecusando(false)} />
        </JanelaDeFormulario>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { gap: espaco.s },
  linha: { flexDirection: "row", gap: espaco.s },
  metade: { flex: 1 },
  texto: { fontSize: 15, lineHeight: 22, color: cores.tinta2 },
  suave: { fontSize: 13, color: cores.tinta4 },
  area: { minHeight: 80, paddingTop: espaco.m },
});
