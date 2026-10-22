import { StyleSheet, Text, View } from "react-native";
import { ROTULO_DO_NIVEL, type ClimaRegistrado } from "@shared/api/clima";
import { hora } from "@shared/api/formatar";
import { cores } from "@/tema/tema";
import { tomDoNivel } from "./regras";

/**
 * O clima que ficou guardado na APR ou no encerramento (`apr.clima` e `execucao.clima` do detalhe da OS): o nível, a frase da previsão
 * daquela hora e, na APR, se a pessoa confirmou o aviso. É o que o supervisor vê no relatório; aqui, uma linha só para consulta.
 */
export function ClimaRegistradoLinha({ momento, clima }: { momento: "APR" | "Encerramento"; clima: ClimaRegistrado | null | undefined }) {
  if (!clima) return null;
  const tom = tomDoNivel[clima.nivel];
  return (
    <View style={estilos.linha}>
      <Text style={[estilos.nivel, { color: tom.texto, backgroundColor: tom.fundo, borderColor: tom.borda }]}>{ROTULO_DO_NIVEL[clima.nivel]}</Text>
      <Text style={estilos.texto}>{`${momento === "APR" ? "Clima na APR" : "Clima no encerramento"} (${hora(clima.consultada_em)}): ${clima.titulo}${clima.confirmou_apesar_do_aviso ? ". A pessoa confirmou o aviso" : ""}`}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { gap: 4, alignItems: "flex-start" },
  nivel: { fontSize: 11, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1, overflow: "hidden" },
  texto: { fontSize: 12, lineHeight: 17, color: cores.tinta4 },
});
