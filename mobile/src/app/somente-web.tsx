import { StyleSheet, Text, View } from "react-native";
import { useSessao } from "@/sessao/SessaoProvider";
import { cores, espaco, raio } from "@/tema/tema";
import { Botao } from "@/ui/Botao";
import { Icone } from "@/ui/Icone";
import { Tela } from "@/ui/Tela";

/** O administrador não usa o app: ele é das telas de campo (APR e execução), e a gestão fica na web. */
export default function SomenteWeb() {
  const { eu, sair } = useSessao();
  return (
    <Tela centralizada>
      <View style={estilos.cartao}>
        <Icone nome="desktop-outline" tamanho={40} cor={cores.marca} />
        <Text style={estilos.titulo}>A gestão fica na web</Text>
        <Text style={estilos.texto}>
          {eu ? `${eu.usuario.nome}, o` : "O"} aplicativo é das telas de campo: aplicar a APR e executar a OS. O seu perfil (administrador) usa o painel da web, que também abre no navegador do celular.
        </Text>
        <Botao titulo="Sair" variante="secundario" aoPressionar={() => void sair()} />
      </View>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cartao: { backgroundColor: cores.superficie, borderRadius: raio.l, borderWidth: 1, borderColor: cores.linha, padding: espaco.xl, gap: espaco.l, alignItems: "center" },
  titulo: { fontSize: 20, fontWeight: "700", color: cores.tinta, textAlign: "center" },
  texto: { fontSize: 15, lineHeight: 22, color: cores.tinta3, textAlign: "center" },
});
