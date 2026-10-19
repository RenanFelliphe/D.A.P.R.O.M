import { Image, StyleSheet } from "react-native";
import { raio } from "@/tema/tema";
import { FOTO_DA_VITORIA } from "./imagens";

/** A foto de perfil da Vitória: sempre o mesmo rosto, no botão flutuante, no cabeçalho do painel e ao lado das mensagens. */
export function Avatar({ tamanho = 40 }: { tamanho?: number }) {
  return <Image accessibilityLabel="Vitória" source={FOTO_DA_VITORIA} style={[estilos.imagem, { width: tamanho, height: tamanho }]} />;
}

const estilos = StyleSheet.create({
  imagem: { borderRadius: raio.pilula },
});
