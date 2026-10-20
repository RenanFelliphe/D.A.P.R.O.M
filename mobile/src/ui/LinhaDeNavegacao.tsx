import { Pressable, StyleSheet, Text, View } from "react-native";
import { cores, espaco, raio } from "@/tema/tema";
import { Icone, type NomeDeIcone } from "./Icone";

interface LinhaDeNavegacaoProps {
  icone: NomeDeIcone;
  titulo: string;
  /** Uma linha menor abaixo do título (o que a tela tem). */
  detalhe?: string;
  /** Um número em destaque à direita (o que espera a pessoa); some quando é zero ou não vem. */
  selo?: number;
  aoPressionar: () => void;
}

/** Uma linha que leva a outra tela (o perfil: ausências, histórico, e-mails): ícone, título e a seta, com 56 dp de toque. */
export function LinhaDeNavegacao({ icone, titulo, detalhe, selo, aoPressionar }: LinhaDeNavegacaoProps) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={titulo} onPress={aoPressionar} style={({ pressed }) => [estilos.linha, { opacity: pressed ? 0.85 : 1 }]}>
      <Icone nome={icone} tamanho={22} cor={cores.marca} />
      <View style={estilos.texto}>
        <Text style={estilos.titulo}>{titulo}</Text>
        {detalhe ? <Text style={estilos.detalhe}>{detalhe}</Text> : null}
      </View>
      {selo ? (
        <View accessibilityLabel={`${selo} pendente(s)`} style={estilos.selo}>
          <Text style={estilos.seloTexto}>{selo > 99 ? "99+" : String(selo)}</Text>
        </View>
      ) : null}
      <Icone nome="chevron-forward" tamanho={18} cor={cores.tinta4} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  linha: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: espaco.m, paddingHorizontal: espaco.l, paddingVertical: espaco.s, borderRadius: raio.m, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.superficie },
  texto: { flex: 1, gap: 2 },
  titulo: { fontSize: 15, fontWeight: "600", color: cores.tinta },
  detalhe: { fontSize: 12, color: cores.tinta4 },
  selo: { minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: raio.pilula, backgroundColor: cores.marca, alignItems: "center", justifyContent: "center" },
  seloTexto: { fontSize: 12, fontWeight: "700", color: cores.branco },
});
