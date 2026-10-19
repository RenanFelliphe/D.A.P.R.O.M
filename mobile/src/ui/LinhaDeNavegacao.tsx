import { Pressable, StyleSheet, Text, View } from "react-native";
import { cores, espaco, raio } from "@/tema/tema";
import { Icone, type NomeDeIcone } from "./Icone";

interface LinhaDeNavegacaoProps {
  icone: NomeDeIcone;
  titulo: string;
  /** Uma linha menor abaixo do título (o que a tela tem). */
  detalhe?: string;
  aoPressionar: () => void;
}

/** Uma linha que leva a outra tela (o perfil: ausências, histórico, e-mails): ícone, título e a seta, com 56 dp de toque. */
export function LinhaDeNavegacao({ icone, titulo, detalhe, aoPressionar }: LinhaDeNavegacaoProps) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={titulo} onPress={aoPressionar} style={({ pressed }) => [estilos.linha, { opacity: pressed ? 0.85 : 1 }]}>
      <Icone nome={icone} tamanho={22} cor={cores.marca} />
      <View style={estilos.texto}>
        <Text style={estilos.titulo}>{titulo}</Text>
        {detalhe ? <Text style={estilos.detalhe}>{detalhe}</Text> : null}
      </View>
      <Icone nome="chevron-forward" tamanho={18} cor={cores.tinta4} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  linha: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: espaco.m, paddingHorizontal: espaco.l, paddingVertical: espaco.s, borderRadius: raio.m, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.superficie },
  texto: { flex: 1, gap: 2 },
  titulo: { fontSize: 15, fontWeight: "600", color: cores.tinta },
  detalhe: { fontSize: 12, color: cores.tinta4 },
});
