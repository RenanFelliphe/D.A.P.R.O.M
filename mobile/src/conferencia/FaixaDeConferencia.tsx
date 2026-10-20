import { usePathname, useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { rotas } from "@/os/rotas";
import { espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { PERGUNTAR_A_CADA_MS, useParaConferir } from "./consultas";
import { faixaDeConferencia } from "./regras";

/**
 * A faixa discreta no alto das telas de campo quando uma conferência da execução espera a vez da pessoa (escolher, dar a ciência ou
 * assinar): "Falta assinar a conferência da execução. OS 123". Tocar abre a conferência. É só um lembrete, então o app pergunta devagar
 * (a cada minuto), só com sinal e só com a tela aberta, e a faixa não aparece na própria conferência.
 */
export function FaixaDeConferencia() {
  const router = useRouter();
  const caminho = usePathname();
  const lista = useParaConferir({ atualizarACadaMs: PERGUNTAR_A_CADA_MS });
  const faixa = useMemo(() => faixaDeConferencia(lista.data), [lista.data]);

  if (!faixa || caminho.includes(`/os/${faixa.conferencia.os.id}/conferencia`)) return null;
  return (
    <View style={estilos.faixa}>
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir a conferência da execução" onPress={() => router.push(rotas.conferencia(faixa.conferencia.os.id, faixa.conferencia.id))}>
        <Aviso tom="al" icone="git-compare-outline" titulo={faixa.titulo}>
          {faixa.texto}
        </Aviso>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  faixa: { paddingHorizontal: espaco.l, paddingTop: espaco.m },
});
