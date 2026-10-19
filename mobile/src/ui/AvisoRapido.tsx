import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cores, espaco, raio } from "@/tema/tema";

type Ouvinte = (texto: string) => void;
const ouvintes = new Set<Ouvinte>();

/**
 * O aviso de uma linha que some sozinho depois de uns segundos ("Execução cancelada", "+15 pontos"): o resultado de uma ação que
 * levou a pessoa para outra tela. Funciona de qualquer lugar; quem o desenha é o `AvisoRapidoHost`, na raiz do app.
 */
export function mostrarAviso(texto: string) {
  ouvintes.forEach((o) => o(texto));
}

const DURACAO_MS = 4500;

export function AvisoRapidoHost() {
  const margens = useSafeAreaInsets();
  const [texto, setTexto] = useState<string | null>(null);
  const [opacidade] = useState(() => new Animated.Value(0));
  const relogio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const ouvinte: Ouvinte = (novo) => {
      if (relogio.current) clearTimeout(relogio.current);
      setTexto(novo);
      Animated.timing(opacidade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      relogio.current = setTimeout(() => Animated.timing(opacidade, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => setTexto(null)), DURACAO_MS);
    };
    ouvintes.add(ouvinte);
    return () => {
      ouvintes.delete(ouvinte);
      if (relogio.current) clearTimeout(relogio.current);
    };
  }, [opacidade]);

  if (!texto) return null;
  return (
    <View pointerEvents="none" style={[estilos.area, { bottom: margens.bottom + 72 }]}>
      <Animated.View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[estilos.aviso, { opacity: opacidade }]}>
        <Text style={estilos.texto}>{texto}</Text>
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  area: { position: "absolute", left: espaco.l, right: espaco.l, alignItems: "center" },
  aviso: { backgroundColor: cores.escuro, borderRadius: raio.m, paddingHorizontal: espaco.l, paddingVertical: espaco.m },
  texto: { color: cores.branco, fontSize: 14, lineHeight: 20, textAlign: "center" },
});
