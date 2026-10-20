import { StyleSheet, Text, View } from "react-native";
import { cores, espaco, raio } from "@/tema/tema";

/** O "Passo 2 de 3": uma barra por etapa (as já feitas e a atual em cor) e o nome da etapa de agora. */
export function Etapas({ atual, titulos }: { atual: number; titulos: string[] }) {
  return (
    <View style={estilos.bloco} accessibilityLabel={`Passo ${atual + 1} de ${titulos.length}: ${titulos[atual]}`}>
      <View style={estilos.barras}>
        {titulos.map((t, i) => (
          <View key={t} style={[estilos.barra, i <= atual && estilos.feita]} />
        ))}
      </View>
      <Text style={estilos.passo}>{`Passo ${atual + 1} de ${titulos.length}`}</Text>
      <Text accessibilityRole="header" style={estilos.titulo}>
        {titulos[atual]}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco.xs },
  barras: { flexDirection: "row", gap: espaco.xs, marginBottom: espaco.xs },
  barra: { flex: 1, height: 5, borderRadius: raio.pilula, backgroundColor: cores.linha },
  feita: { backgroundColor: cores.marca },
  passo: { fontSize: 12, color: cores.tinta4 },
  titulo: { fontSize: 20, fontWeight: "700", color: cores.tinta },
});
