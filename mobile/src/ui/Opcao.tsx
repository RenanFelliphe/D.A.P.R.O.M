import { Pressable, StyleSheet, Text, View } from "react-native";
import { cores, espaco, raio } from "@/tema/tema";
import { Icone } from "./Icone";

interface OpcaoProps {
  rotulo: string;
  /** Uma linha menor abaixo do rótulo (matrícula, quantas medidas). */
  detalhe?: string;
  marcada: boolean;
  /** `radio` escolhe uma entre várias; `caixa` marca vários. */
  tipo?: "radio" | "caixa";
  aoPressionar: () => void;
  desabilitada?: boolean;
  /** O que fica à direita (o selo "Responsável", um botão pequeno). */
  direita?: React.ReactNode;
}

/** Uma linha de escolha com área de toque de 52 dp: o participante da APR, o risco, o motivo da pausa, a pergunta do checklist de inspeção. */
export function Opcao({ rotulo, detalhe, marcada, tipo = "caixa", aoPressionar, desabilitada = false, direita }: OpcaoProps) {
  const icone = tipo === "radio" ? (marcada ? "radio-button-on" : "radio-button-off") : marcada ? "checkbox" : "square-outline";
  return (
    <Pressable
      accessibilityRole={tipo === "radio" ? "radio" : "checkbox"}
      accessibilityState={{ checked: marcada, disabled: desabilitada }}
      onPress={desabilitada ? undefined : aoPressionar}
      style={({ pressed }) => [estilos.linha, marcada && estilos.marcada, { opacity: pressed ? 0.85 : 1 }]}
    >
      <Icone nome={icone} tamanho={24} cor={desabilitada ? cores.tinta4 : marcada ? cores.marca : cores.tinta3} />
      <View style={estilos.texto}>
        <Text style={[estilos.rotulo, !marcada && tipo === "caixa" && { color: cores.tinta3 }]}>{rotulo}</Text>
        {detalhe ? <Text style={estilos.detalhe}>{detalhe}</Text> : null}
      </View>
      {direita}
    </Pressable>
  );
}

/** O agrupamento visual das linhas de escolha: uma caixa com bordas, uma linha sob a outra. */
export function ListaDeOpcoes({ children }: { children: React.ReactNode }) {
  return <View style={estilos.lista}>{children}</View>;
}

const estilos = StyleSheet.create({
  lista: { gap: espaco.s },
  linha: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: espaco.m, paddingHorizontal: espaco.m, paddingVertical: espaco.s, borderRadius: raio.m, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.superficie },
  marcada: { borderColor: cores.marcaBorda, backgroundColor: cores.marcaFundo },
  texto: { flex: 1, gap: 2 },
  rotulo: { fontSize: 15, color: cores.tinta, lineHeight: 21 },
  detalhe: { fontSize: 12, color: cores.tinta4 },
});
