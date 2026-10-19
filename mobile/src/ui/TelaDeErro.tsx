import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { mensagemDoErro } from "@/api/erros";
import { cores, espaco } from "@/tema/tema";
import { Botao } from "./Botao";
import { Icone } from "./Icone";

/** A tela de erro geral: um erro que ninguém previu nunca deixa o app em branco. */
export function TelaDeErro({ erro, tentarDeNovo }: { erro: unknown; tentarDeNovo: () => void }) {
  return (
    <SafeAreaView style={estilos.tela}>
      <View style={estilos.centro}>
        <Icone nome="warning-outline" tamanho={48} cor={cores.perigo} />
        <Text style={estilos.titulo}>Algo deu errado</Text>
        <Text style={estilos.texto}>{mensagemDoErro(erro)}</Text>
        <Botao titulo="Tentar de novo" aoPressionar={tentarDeNovo} />
      </View>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: espaco.l, padding: espaco.xl },
  titulo: { fontSize: 20, fontWeight: "700", color: cores.tinta },
  texto: { fontSize: 15, color: cores.tinta3, textAlign: "center", lineHeight: 22 },
});
