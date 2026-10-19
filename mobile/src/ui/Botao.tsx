import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { cores, raio } from "@/tema/tema";
import { Icone, type NomeDeIcone } from "./Icone";

type Variante = "primario" | "secundario" | "perigo" | "texto";

interface BotaoProps {
  titulo: string;
  aoPressionar: () => void;
  variante?: Variante;
  icone?: NomeDeIcone;
  /** Enquanto envia: mostra o carregamento e ignora toques. É o único motivo para o botão não responder (nunca por campo faltando). */
  enviando?: boolean;
  /** Ocupa a largura toda (o padrão nas telas de uma ação só). */
  bloco?: boolean;
  estilo?: StyleProp<ViewStyle>;
}

const aparencia: Record<Variante, { fundo: string; texto: string; borda: string }> = {
  primario: { fundo: cores.marca, texto: cores.branco, borda: cores.marca },
  secundario: { fundo: cores.superficie, texto: cores.marca, borda: cores.marcaBorda },
  perigo: { fundo: cores.perigo, texto: cores.branco, borda: cores.perigo },
  texto: { fundo: "transparent", texto: cores.marca, borda: "transparent" },
};

/** Botão com área de toque de 48 dp. */
export function Botao({ titulo, aoPressionar, variante = "primario", icone, enviando = false, bloco = true, estilo }: BotaoProps) {
  const a = aparencia[variante];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: enviando }}
      onPress={enviando ? undefined : aoPressionar}
      style={({ pressed }) => [estilos.base, { backgroundColor: a.fundo, borderColor: a.borda, opacity: pressed ? 0.85 : 1 }, bloco && estilos.bloco, estilo]}
    >
      {enviando ? <ActivityIndicator color={a.texto} /> : icone ? <Icone nome={icone} tamanho={18} cor={a.texto} /> : null}
      <Text style={[estilos.texto, { color: a.texto }]}>{titulo}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: { minHeight: 48, paddingHorizontal: 18, borderRadius: raio.m, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  bloco: { alignSelf: "stretch" },
  texto: { fontSize: 16, fontWeight: "600" },
});
