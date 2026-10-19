import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { cores, espaco, raio } from "@/tema/tema";

/** Cartão branco com borda, o contêiner de cada bloco de informação. Com `aoPressionar` vira um toque inteiro (a lista de OS). */
export function Cartao({ children, aoPressionar, estilo, rotulo }: { children: React.ReactNode; aoPressionar?: () => void; estilo?: StyleProp<ViewStyle>; rotulo?: string }) {
  if (aoPressionar) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={rotulo} onPress={aoPressionar} style={({ pressed }) => [estilos.cartao, { opacity: pressed ? 0.9 : 1 }, estilo]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[estilos.cartao, estilo]}>{children}</View>;
}

/** Título de um cartão ("Dados", "Materiais recomendados"). */
export function TituloDeCartao({ children }: { children: string }) {
  return <Text style={estilos.titulo}>{children}</Text>;
}

const estilos = StyleSheet.create({
  cartao: { backgroundColor: cores.superficie, borderRadius: raio.m, borderWidth: 1, borderColor: cores.linha, padding: espaco.l, gap: espaco.s },
  titulo: { fontSize: 15, fontWeight: "600", color: cores.tinta },
});
