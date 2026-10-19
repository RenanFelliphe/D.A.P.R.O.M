import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { cores, espaco } from "@/tema/tema";
import { Botao } from "./Botao";
import { Icone, type NomeDeIcone } from "./Icone";

/** O carregamento de uma tela ou lista. */
export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <View style={estilos.centro} accessibilityRole="progressbar" accessibilityLabel={texto}>
      <ActivityIndicator size="large" color={cores.marca} />
      <Text style={estilos.texto}>{texto}</Text>
    </View>
  );
}

/** Lista vazia ou erro de carregamento: ícone, título, explicação e, se houver, a ação ("Tentar de novo"). */
export function Vazio({ icone = "file-tray-outline", titulo, texto, acao }: { icone?: NomeDeIcone; titulo: string; texto?: string; acao?: { titulo: string; aoPressionar: () => void } }) {
  return (
    <View style={estilos.centro}>
      <Icone nome={icone} tamanho={40} cor={cores.tinta4} />
      <Text style={estilos.titulo}>{titulo}</Text>
      {texto ? <Text style={estilos.texto}>{texto}</Text> : null}
      {acao ? <Botao titulo={acao.titulo} aoPressionar={acao.aoPressionar} variante="secundario" bloco={false} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { alignItems: "center", justifyContent: "center", gap: espaco.m, padding: espaco.xl },
  titulo: { fontSize: 17, fontWeight: "600", color: cores.tinta, textAlign: "center" },
  texto: { fontSize: 14, color: cores.tinta4, textAlign: "center", lineHeight: 20 },
});
