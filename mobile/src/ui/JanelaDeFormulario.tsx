import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cores, espaco, raio } from "@/tema/tema";
import { Icone } from "./Icone";

interface JanelaDeFormularioProps {
  titulo: string;
  children: React.ReactNode;
  /** Fecha pelo X, pelo fundo e pelo botão voltar do Android. Durante o envio, quem chama passa uma função que não faz nada. */
  aoFechar: () => void;
}

/**
 * A janela que sobe de baixo para o que pede campos (o motivo da pausa, a recusa da APR, a assinatura): título, X, o conteúdo
 * rolável e o teclado sempre abaixo do campo em uso. As janelas de só confirmar usam `JanelaDeConfirmacao`.
 */
export function JanelaDeFormulario({ titulo, children, aoFechar }: JanelaDeFormularioProps) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={aoFechar} statusBarTranslucent>
      <View style={estilos.fundo}>
        <Pressable style={estilos.toque} onPress={aoFechar} accessibilityLabel="Fechar" />
        <SafeAreaView edges={["bottom"]} style={estilos.folha}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={estilos.teclado}>
            <View style={estilos.cabecalho}>
              <Text accessibilityRole="header" style={estilos.titulo}>
                {titulo}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={aoFechar} hitSlop={12}>
                <Icone nome="close" tamanho={24} cor={cores.tinta3} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: "rgba(23,33,43,0.55)", justifyContent: "flex-end" },
  toque: { flex: 1 },
  folha: { maxHeight: "92%", backgroundColor: cores.superficie, borderTopLeftRadius: raio.l, borderTopRightRadius: raio.l },
  teclado: { flexShrink: 1 },
  cabecalho: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: espaco.m, paddingHorizontal: espaco.xl, paddingTop: espaco.l, paddingBottom: espaco.s },
  titulo: { flex: 1, fontSize: 18, fontWeight: "700", color: cores.tinta },
  conteudo: { gap: espaco.m, paddingHorizontal: espaco.xl, paddingTop: espaco.s, paddingBottom: espaco.xl },
});
