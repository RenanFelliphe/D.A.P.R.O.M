import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { cores, espaco, raio } from "@/tema/tema";
import { Botao } from "./Botao";

interface JanelaDeConfirmacaoProps {
  visivel: boolean;
  titulo: string;
  mensagem: string;
  confirmar: string;
  cancelar?: string;
  /** Ação destrutiva (sair, descartar): o botão de confirmar fica vermelho. */
  perigo?: boolean;
  enviando?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}

/** A janela de confirmação: sempre o título, o que vai acontecer e dois botões claros (o de cancelar vem primeiro). */
export function JanelaDeConfirmacao({ visivel, titulo, mensagem, confirmar, cancelar = "Cancelar", perigo = false, enviando = false, aoConfirmar, aoCancelar }: JanelaDeConfirmacaoProps) {
  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={aoCancelar} statusBarTranslucent>
      <Pressable style={estilos.fundo} onPress={aoCancelar} accessibilityLabel="Fechar">
        <Pressable style={estilos.janela} accessibilityViewIsModal>
          <Text style={estilos.titulo}>{titulo}</Text>
          <Text style={estilos.mensagem}>{mensagem}</Text>
          <View style={estilos.botoes}>
            <Botao titulo={cancelar} aoPressionar={aoCancelar} variante="secundario" />
            <Botao titulo={confirmar} aoPressionar={aoConfirmar} variante={perigo ? "perigo" : "primario"} enviando={enviando} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: "rgba(23,33,43,0.55)", justifyContent: "center", padding: espaco.xl },
  janela: { backgroundColor: cores.superficie, borderRadius: raio.l, padding: espaco.xl, gap: espaco.m },
  titulo: { fontSize: 18, fontWeight: "700", color: cores.tinta },
  mensagem: { fontSize: 15, lineHeight: 22, color: cores.tinta3 },
  botoes: { gap: espaco.s, marginTop: espaco.s },
});
