import { Image, StyleSheet, Text, View } from "react-native";
import type { SeloDePatente as Patente } from "@shared/api/gamificacao";
import { cores, espaco, raio } from "@/tema/tema";

/**
 * A imagem e o nome da patente, usados no ranking, na pontuação e no perfil. Sem imagem, um círculo com a cor da patente e a inicial;
 * sem patente, "Sem patente" (com a carga inicial ninguém fica sem: Bronze começa em 0).
 */
export function SeloDePatente({ patente, tamanho = 32, semNome = false }: { patente: Pick<Patente, "nome" | "cor" | "imagem_url"> | null; tamanho?: number; semNome?: boolean }) {
  const nome = patente?.nome ?? "Sem patente";
  return (
    <View style={estilos.linha} accessible accessibilityLabel={`Patente ${nome}`}>
      {patente?.imagem_url ? (
        <Image source={{ uri: patente.imagem_url }} style={{ width: tamanho, height: tamanho }} resizeMode="contain" />
      ) : (
        <View style={[estilos.placeholder, { width: tamanho, height: tamanho, backgroundColor: patente?.cor ?? cores.chip }]}>
          <Text style={[estilos.inicial, { fontSize: Math.round(tamanho * 0.45) }]}>{nome.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      {semNome ? null : <Text style={estilos.nome}>{nome}</Text>}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: "row", alignItems: "center", gap: espaco.s },
  placeholder: { borderRadius: raio.pilula, alignItems: "center", justifyContent: "center" },
  inicial: { fontWeight: "700", color: cores.branco },
  nome: { fontSize: 14, fontWeight: "600", color: cores.tinta },
});
