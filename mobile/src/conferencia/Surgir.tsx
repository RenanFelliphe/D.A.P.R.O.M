import { useEffect, useState } from "react";
import { Animated } from "react-native";

/** Faz o bloco surgir de baixo com um fade curto (cada cartão da conferência entra um pouco depois do anterior), sem prender a tela. */
export function Surgir({ children, atraso = 0 }: { children: React.ReactNode; atraso?: number }) {
  const [valor] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(valor, { toValue: 1, duration: 240, delay: atraso, useNativeDriver: true }).start();
  }, [valor, atraso]);
  return <Animated.View style={{ opacity: valor, transform: [{ translateY: valor.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>{children}</Animated.View>;
}
