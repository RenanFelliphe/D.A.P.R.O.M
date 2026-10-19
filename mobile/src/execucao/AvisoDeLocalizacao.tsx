import { StyleSheet, Text, View } from "react-native";
import { AVISO_DE_LOCALIZACAO } from "@shared/api/localizacao";
import { cores, espaco } from "@/tema/tema";
import { Icone } from "@/ui/Icone";

/** O aviso de privacidade (LGPD) junto dos botões e das janelas que registram a localização: discreto, mas visível. */
export function AvisoDeLocalizacao() {
  return (
    <View style={estilos.linha}>
      <Icone nome="location-outline" tamanho={14} cor={cores.tinta4} />
      <Text style={estilos.texto}>{AVISO_DE_LOCALIZACAO}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: "row", alignItems: "flex-start", gap: espaco.s },
  texto: { flex: 1, fontSize: 12, lineHeight: 17, color: cores.tinta4 },
});
