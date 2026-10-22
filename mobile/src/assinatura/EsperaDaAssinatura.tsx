import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";

interface EsperaDaAssinaturaProps {
  /** A assinatura é simulada: a página é da própria `api`, sem validade jurídica. */
  simulada?: boolean;
  aoAbrirDeNovo: () => void;
  aoCancelar: () => void;
}

/**
 * O que a janela mostra depois de abrir a página do provedor: a espera pela assinatura. A consulta é automática (a cada poucos segundos e
 * quando o app volta para a frente); "Abrir de novo" serve a quem fechou a página sem assinar.
 */
export function EsperaDaAssinatura({ simulada = false, aoAbrirDeNovo, aoCancelar }: EsperaDaAssinaturaProps) {
  return (
    <View style={estilos.caixa}>
      <View style={estilos.linha} accessibilityRole="progressbar" accessibilityLabel="Aguardando a assinatura">
        <ActivityIndicator color={cores.marca} />
        <Text style={estilos.texto}>Aguardando a sua assinatura na página que abriu…</Text>
      </View>
      <Text style={estilos.dica}>Assine lá e volte para o app: ele continua sozinho assim que a assinatura for confirmada.</Text>
      {simulada ? <Aviso tom="al">Assinatura simulada: a página é de demonstração e não tem validade jurídica.</Aviso> : null}
      <Botao titulo="Abrir de novo" icone="open-outline" variante="secundario" aoPressionar={aoAbrirDeNovo} />
      <Botao titulo="Cancelar" variante="texto" aoPressionar={aoCancelar} />
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { gap: espaco.m },
  linha: { flexDirection: "row", alignItems: "center", gap: espaco.m },
  texto: { flex: 1, fontSize: 15, fontWeight: "600", color: cores.tinta },
  dica: { fontSize: 13, color: cores.tinta3, lineHeight: 19 },
});
