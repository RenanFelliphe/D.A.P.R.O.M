import { StyleSheet, Text, View } from "react-native";
import type { TomDoSelo } from "@shared/api/tipos";
import { raio, tomDoSelo } from "@/tema/tema";
import { Icone, type NomeDeIcone } from "./Icone";

/** Selo arredondado: status, criticidade, tipo da OS, prioridade. O tom é o mesmo da web (`TomDoSelo`). */
export function Selo({ tom = "neu", children, icone }: { tom?: TomDoSelo; children: string; icone?: NomeDeIcone }) {
  const t = tomDoSelo[tom];
  return (
    <View style={[estilos.selo, { backgroundColor: t.fundo }]}>
      {icone && <Icone nome={icone} tamanho={12} cor={t.texto} />}
      <Text style={[estilos.texto, { color: t.texto }]}>{children}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  selo: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: raio.pilula, alignSelf: "flex-start" },
  texto: { fontSize: 12, fontWeight: "600" },
});
