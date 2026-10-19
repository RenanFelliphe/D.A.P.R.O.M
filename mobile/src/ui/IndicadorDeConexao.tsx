import { StyleSheet, Text, View } from "react-native";
import { useConexao } from "@/estado/conexao";
import { rotuloDoIndicador } from "@/offline/faixa";
import { useEstadoDaSincronizacao } from "@/offline/estado";
import { cores, raio } from "@/tema/tema";

/** "Sem conexão", "Sincronizado hh:mm" ou "Online", no cabeçalho das abas: o indicador que saiu da web e ficou para o app. */
export function IndicadorDeConexao() {
  const online = useConexao() === "online";
  const estado = useEstadoDaSincronizacao();
  const rotulo = rotuloDoIndicador(online && !estado.semSinal, estado.sincronizadoEm, estado.aplicavel);
  const ligado = rotulo !== "Sem conexão";
  return (
    <View accessibilityRole="text" accessibilityLabel={rotulo} style={[estilos.pilula, { backgroundColor: ligado ? cores.okFundo : cores.alertaFundo }]}>
      <View style={[estilos.ponto, { backgroundColor: ligado ? cores.ok : cores.alerta }]} />
      <Text style={[estilos.texto, { color: ligado ? cores.ok : cores.alerta }]}>{rotulo}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  pilula: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: raio.pilula, marginRight: 12 },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  texto: { fontSize: 12, fontWeight: "700" },
});
