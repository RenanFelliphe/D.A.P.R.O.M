import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { cores, espaco, raio } from "@/tema/tema";

interface SegmentosProps<T extends string> {
  opcoes: { id: T; rotulo: string }[];
  valor: T;
  aoMudar: (id: T) => void;
  /** Rola na horizontal quando as opções não cabem (as temporadas). Por padrão as opções dividem a largura. */
  rolavel?: boolean;
}

/** Uma escolha entre poucas opções, em pílulas (as seções de Pontos, os tipos de ranking, as temporadas). */
export function Segmentos<T extends string>({ opcoes, valor, aoMudar, rolavel = false }: SegmentosProps<T>) {
  const itens = opcoes.map((o) => {
    const ativo = o.id === valor;
    return (
      <Pressable key={o.id} accessibilityRole="button" accessibilityState={{ selected: ativo }} onPress={() => aoMudar(o.id)} style={[estilos.opcao, !rolavel && estilos.dividida, ativo && estilos.ativa]}>
        <Text style={[estilos.texto, ativo && estilos.textoAtivo]} numberOfLines={1}>
          {o.rotulo}
        </Text>
      </Pressable>
    );
  });
  return rolavel ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.linha}>
      {itens}
    </ScrollView>
  ) : (
    <View style={[estilos.linha, estilos.cheia]}>{itens}</View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: "row", gap: espaco.s },
  cheia: { alignSelf: "stretch" },
  opcao: { paddingHorizontal: 16, minHeight: 40, justifyContent: "center", alignItems: "center", borderRadius: raio.pilula, backgroundColor: cores.chip },
  dividida: { flex: 1 },
  ativa: { backgroundColor: cores.marca },
  texto: { fontSize: 13, fontWeight: "600", color: cores.tinta3 },
  textoAtivo: { color: cores.branco },
});
