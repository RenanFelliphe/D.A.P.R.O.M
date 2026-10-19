import { StyleSheet, Text, View } from "react-native";
import { espaco, raio, tomDoAviso, type TomDoAviso } from "@/tema/tema";
import { Icone, type NomeDeIcone } from "./Icone";

const iconePadrao: Record<TomDoAviso, NomeDeIcone> = { info: "information-circle-outline", al: "alert-circle-outline", ok: "checkmark-circle-outline", blq: "alert-circle-outline" };

interface AvisoProps {
  tom?: TomDoAviso;
  /** A frase em negrito que abre o aviso. */
  titulo?: string;
  children?: React.ReactNode;
  icone?: NomeDeIcone;
  /** O que vem abaixo do texto: a lista de APRs, o botão da ação. */
  rodape?: React.ReactNode;
}

/** Faixa colorida com ícone (os `.notice` da web): o texto em negrito vem em `titulo`, o resto em `children`. */
export function Aviso({ tom = "info", titulo, children, icone, rodape }: AvisoProps) {
  const t = tomDoAviso[tom];
  return (
    <View accessibilityRole="alert" style={[estilos.aviso, { backgroundColor: t.fundo, borderColor: t.borda }]}>
      <Icone nome={icone ?? iconePadrao[tom]} tamanho={20} cor={t.texto} />
      <View style={estilos.corpo}>
        <Text style={[estilos.texto, { color: t.texto }]}>
          {titulo ? <Text style={estilos.titulo}>{titulo} </Text> : null}
          {children}
        </Text>
        {rodape}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  aviso: { flexDirection: "row", alignItems: "flex-start", gap: espaco.m, padding: espaco.m, borderRadius: raio.m, borderWidth: 1 },
  corpo: { flex: 1, gap: espaco.s },
  texto: { fontSize: 14, lineHeight: 20 },
  titulo: { fontWeight: "700" },
});
