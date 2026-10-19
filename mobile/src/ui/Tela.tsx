import { useEffect, useRef } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, type ScrollViewInstance } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { FaixaDeSincronizacao } from "@/offline/FaixaDeSincronizacao";
import { cores, espaco } from "@/tema/tema";

interface TelaProps {
  children: React.ReactNode;
  /** Quais bordas respeitam a área segura; as telas com cabeçalho do navegador usam só a de baixo. */
  bordas?: Edge[];
  /** Padrão: rolável, com 16 dp de margem e 12 dp entre os blocos. Telas com lista própria (`FlatList`) passam `false`. */
  rolavel?: boolean;
  atualizando?: boolean;
  aoAtualizar?: () => void;
  /** Centraliza o conteúdo na vertical (a entrada, os avisos de uma ação só). */
  centralizada?: boolean;
  /** Quando este valor muda, a tela volta ao topo (do checklist para a revisão, da pergunta para a evidência). */
  voltarAoTopoQuando?: unknown;
}

/** A moldura de toda tela: fundo da marca, área segura, teclado que não cobre o campo e "puxar para atualizar" quando há `aoAtualizar`. */
export function Tela({ children, bordas = ["top", "bottom"], rolavel = true, atualizando = false, aoAtualizar, centralizada = false, voltarAoTopoQuando }: TelaProps) {
  const rolagem = useRef<ScrollViewInstance>(null);
  useEffect(() => {
    rolagem.current?.scrollTo({ y: 0, animated: false });
  }, [voltarAoTopoQuando]);
  return (
    <SafeAreaView edges={bordas} style={estilos.tela}>
      <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FaixaDeSincronizacao />
        {rolavel ? (
          <ScrollView
            ref={rolagem}
            contentContainerStyle={[estilos.conteudo, centralizada && estilos.centralizada]}
            keyboardShouldPersistTaps="handled"
            refreshControl={aoAtualizar ? <RefreshControl refreshing={atualizando} onRefresh={aoAtualizar} colors={[cores.marca]} /> : undefined}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={estilos.tela}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.l, gap: espaco.m, flexGrow: 1 },
  centralizada: { justifyContent: "center" },
});
