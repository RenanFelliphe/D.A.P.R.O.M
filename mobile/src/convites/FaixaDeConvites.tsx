import { usePathname, useRouter } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Vibration, View } from "react-native";
import { useAgora } from "@/execucao/useAgora";
import { espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { useConvitesRecebidos } from "./consultas";
import { restanteDoConvite } from "./regras";

/**
 * A faixa no alto de toda tela de campo para quem foi convidado a uma APR e ainda não respondeu: "Tiago convidou você para a APR da OS 123 —
 * 12 min". Tocar nela abre os convites. É o aviso de quem está com o app aberto; com o app fechado, quem avisa é a notificação push.
 */
export function FaixaDeConvites() {
  const router = useRouter();
  const caminho = usePathname();
  const convites = useConvitesRecebidos();
  const agora = useAgora(15_000);
  const esperando = useMemo(() => (convites.data ?? []).filter((c) => c.situacao === "aguardando" && Date.parse(c.expira_em) > agora), [convites.data, agora]);
  const vistos = useRef(new Set<string>());
  useEffect(() => {
    const novo = esperando.some((c) => !vistos.current.has(c.id));
    esperando.forEach((c) => vistos.current.add(c.id));
    if (novo) Vibration.vibrate([0, 300, 150, 300]);
  }, [esperando]);

  // Na tela dos convites a resposta já está à vista.
  if (esperando.length === 0 || caminho === "/convites") return null;
  const primeiro = esperando[0]!;
  const resto = restanteDoConvite(primeiro.expira_em, agora);
  return (
    <View style={estilos.faixa}>
      <Pressable accessibilityRole="button" accessibilityLabel="Responder ao convite para a APR" onPress={() => router.push("/convites")}>
        <Aviso tom="al" icone="people-outline" titulo={`${primeiro.convidado_por.nome} convidou você para a APR da OS ${primeiro.os.numero_ordem ?? primeiro.os.titulo}${resto ? ` — ${resto}` : ""}`}>
          {esperando.length > 1 ? `Há ${esperando.length} convites esperando. Toque para aceitar ou recusar.` : "Toque para aceitar ou recusar."}
        </Aviso>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  faixa: { paddingHorizontal: espaco.l, paddingTop: espaco.m, gap: espaco.s },
});
