import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Vibration, View } from "react-native";
import { contagemDoPedido, restanteDoPedido, ROTULO_DO_PEDIDO, type PedidoParaResponder } from "@shared/api/execucao-pedidos";
import { cliente } from "@/api/api";
import { useConexao } from "@/estado/conexao";
import { rotas } from "@/os/rotas";
import { useSessao } from "@/sessao/SessaoProvider";
import { espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { useAgora } from "./useAgora";

/** De quanto em quanto tempo o app, aberto em qualquer tela, pergunta se um participante pediu algo ao responsável (não há push). */
const PERGUNTAR_A_CADA_MS = 10_000;

/**
 * A faixa no alto de toda tela de campo para o responsável por uma execução: "[nome] pediu para encerrar a OS 123 — 1:42". Tocar nela abre
 * a execução, onde ele aprova ou recusa. O app só pergunta com a tela aberta e com sinal: com o aparelho fechado, sem sinal ou descarregado,
 * o pedido vence e é aprovado sozinho (é o que a funcionalidade pretende: a equipe não depende do aparelho do responsável).
 */
export function FaixaDePedidos() {
  const { fase } = useSessao();
  const online = useConexao() === "online";
  const pedidos = useQuery({
    queryKey: ["me", "pedidos-abertos"],
    queryFn: async () => (await cliente.chamar<{ pedidos: PedidoParaResponder[] }>("/me/pedidos-abertos")).pedidos,
    enabled: fase === "ativa" && online,
    refetchInterval: PERGUNTAR_A_CADA_MS,
    retry: false,
  });
  const caminho = usePathname();
  // O pedido da execução que está aberta na tela já aparece lá, com os botões.
  const lista = useMemo(() => (pedidos.data ?? []).filter((p) => !caminho.includes(`/os/${p.os_id}/execucao`)), [pedidos.data, caminho]);
  const vistos = useRef(new Set<string>());
  useEffect(() => {
    const novo = lista.some((p) => !vistos.current.has(p.id));
    lista.forEach((p) => vistos.current.add(p.id));
    if (novo) Vibration.vibrate([0, 400, 200, 400]);
  }, [lista]);

  if (lista.length === 0) return null;
  return (
    <View style={estilos.faixa}>
      {lista.map((p) => (
        <Pedido key={p.id} pedido={p} recebidoEm={pedidos.dataUpdatedAt} />
      ))}
    </View>
  );
}

function Pedido({ pedido, recebidoEm }: { pedido: PedidoParaResponder; recebidoEm: number }) {
  const router = useRouter();
  const restante = restanteDoPedido(pedido, recebidoEm, useAgora(1000));
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Responder o pedido" onPress={() => router.push(rotas.execucao(pedido.os_id))}>
      <Aviso tom="al" icone="time-outline" titulo={`${pedido.solicitante.nome} pediu para ${ROTULO_DO_PEDIDO[pedido.tipo]} — ${contagemDoPedido(restante)}`}>
        {`OS ${pedido.numero_ordem ?? pedido.titulo}. Toque para aprovar ou recusar; sem resposta, o pedido é aprovado sozinho.`}
      </Aviso>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  faixa: { paddingHorizontal: espaco.l, paddingTop: espaco.m, gap: espaco.s },
});
