import { useEffect, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { cores, espaco } from "@/tema/tema";

/** As etapas que a Vitória "conta" enquanto a resposta não chega; trocam a cada poucos segundos. */
const ETAPAS = ["Lendo sua pergunta", "Procurando no manual", "Juntando as informações", "Montando a resposta"];
const INTERVALO_MS = 2200;
/** Depois disso, avisa que está demorando: a pessoa sabe que não travou. */
const DEMORANDO_MS = 10_000;
const MUITO_DEMORADO_MS = 25_000;

export function textoDaEspera(decorridoMs: number): string {
  if (decorridoMs >= MUITO_DEMORADO_MS) return "Ainda trabalhando nisso, obrigado pela paciência";
  if (decorridoMs >= DEMORANDO_MS) return "Está levando um pouco mais que o normal, já estou quase lá";
  return ETAPAS[Math.min(Math.floor(decorridoMs / INTERVALO_MS), ETAPAS.length - 1)]!;
}

/** Um pontinho que sobe e desce; os três juntos, defasados, são o "pensando". */
function Ponto({ atrasoMs }: { atrasoMs: number }) {
  const [subida] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const laco = Animated.loop(
      Animated.sequence([
        Animated.delay(atrasoMs),
        Animated.timing(subida, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(subida, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.delay(400 - atrasoMs),
      ]),
    );
    laco.start();
    return () => laco.stop();
  }, [atrasoMs, subida]);
  return <Animated.View style={[estilos.ponto, { transform: [{ translateY: subida.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] }]} />;
}

/**
 * O balão de "pensando" da Vitória: três pontinhos saltando e uma frase que vai mudando, para a espera nunca parecer travada. Some quando
 * chega o texto da resposta.
 */
export function IndicadorPensando() {
  const [decorrido, setDecorrido] = useState(0);
  useEffect(() => {
    const inicio = Date.now();
    const id = setInterval(() => setDecorrido(Date.now() - inicio), 500);
    return () => clearInterval(id);
  }, []);
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="A Vitória está pensando" style={estilos.linha}>
      <View style={estilos.pontos}>
        <Ponto atrasoMs={0} />
        <Ponto atrasoMs={120} />
        <Ponto atrasoMs={240} />
      </View>
      <Text style={estilos.texto}>{textoDaEspera(decorrido)}…</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: "row", alignItems: "center", gap: espaco.s },
  pontos: { flexDirection: "row", alignItems: "center", gap: 4, height: 14 },
  ponto: { width: 6, height: 6, borderRadius: 3, backgroundColor: cores.marca },
  texto: { flexShrink: 1, fontSize: 13, color: cores.tinta3 },
});
