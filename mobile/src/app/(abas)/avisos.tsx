import { useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { Alerta } from "@shared/api/alertas";
import { mensagemDoErro } from "@/api/erros";
import { CartaoDeAviso } from "@/avisos/CartaoDeAviso";
import { useListaDeAvisos, useMarcarAvisoComoLido, type FiltroDeAvisos } from "@/avisos/consultas";
import { destinoDoAvisoNoApp } from "@/avisos/destino";
import { useSessao } from "@/sessao/SessaoProvider";
import { cores, espaco, raio } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Carregando, Vazio } from "@/ui/Estados";

const FILTROS: { id: FiltroDeAvisos; rotulo: string }[] = [
  { id: "nao-lidos", rotulo: "Não lidos" },
  { id: "todos", rotulo: "Todos" },
];

/**
 * Avisos: o sino da web, no app. A lista dos avisos de quem está logado, com o que ainda não foi lido primeiro; tocar num aviso o
 * marca como lido e, se ele tem tela no app (a OS, as assinaturas da APR, as ausências), leva a ela. Não há push: "puxar para
 * atualizar" traz o aviso novo, e o número na aba se atualiza sozinho.
 */
export default function Avisos() {
  const router = useRouter();
  const consultas = useQueryClient();
  const { eu } = useSessao();
  const [filtro, setFiltro] = useState<FiltroDeAvisos>("nao-lidos");
  const lista = useListaDeAvisos(filtro);
  const marcarComoLido = useMarcarAvisoComoLido();
  const [falha, setFalha] = useState<string | null>(null);

  const itens = lista.data?.pages.flatMap((p) => p.alertas) ?? [];
  const atualizando = lista.isRefetching && !lista.isFetchingNextPage;

  const abrir = async (aviso: Alerta) => {
    setFalha(null);
    const destino = destinoDoAvisoNoApp(aviso);
    // O admin vê o aviso dos outros sem marcá-lo; o técnico só recebe os dele.
    if (aviso.lido_em === null && aviso.destinatario_id === eu?.usuario.id) {
      try {
        await marcarComoLido(aviso.id);
      } catch (e) {
        setFalha(mensagemDoErro(e));
      }
    }
    if (destino) router.push(destino as Href);
  };

  const cabecalho = (
    <View style={estilos.cabecalho}>
      {falha ? <Aviso tom="blq">{falha}</Aviso> : null}
      <View style={estilos.filtros}>
        {FILTROS.map((f) => {
          const ativo = f.id === filtro;
          return (
            <Pressable key={f.id} accessibilityRole="button" accessibilityState={{ selected: ativo }} onPress={() => setFiltro(f.id)} style={[estilos.filtro, ativo && estilos.filtroAtivo]}>
              <Text style={[estilos.filtroTexto, ativo && estilos.filtroTextoAtivo]}>{f.rotulo}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const vazio = lista.isPending ? (
    <Carregando texto="Buscando os avisos…" />
  ) : lista.isError ? (
    <Vazio icone="cloud-offline-outline" titulo="Não foi possível carregar os avisos" texto={mensagemDoErro(lista.error)} acao={{ titulo: "Tentar de novo", aoPressionar: () => void lista.refetch() }} />
  ) : (
    <Vazio icone="notifications-off-outline" titulo={filtro === "nao-lidos" ? "Nenhum aviso novo" : "Nenhum aviso"} texto="Quando algo precisar da sua atenção (uma APR para assinar, uma OS reservada para você), aparece aqui. Puxe a lista para baixo para atualizar." />
  );

  return (
    <FlatList
      data={itens}
      keyExtractor={(a) => a.id}
      renderItem={({ item }) => <CartaoDeAviso aviso={item} aoAbrir={() => void abrir(item)} />}
      ListHeaderComponent={cabecalho}
      ListEmptyComponent={vazio}
      ListFooterComponent={lista.isFetchingNextPage ? <Carregando texto="Carregando mais…" /> : undefined}
      onEndReached={() => lista.hasNextPage && !lista.isFetchingNextPage && void lista.fetchNextPage()}
      onEndReachedThreshold={0.4}
      refreshing={atualizando}
      onRefresh={() => {
        void lista.refetch();
        void consultas.invalidateQueries({ queryKey: ["avisos", "nao-lidos"] });
      }}
      contentContainerStyle={estilos.lista}
      ItemSeparatorComponent={Separador}
    />
  );
}

const Separador = () => <View style={{ height: espaco.m }} />;

const estilos = StyleSheet.create({
  lista: { padding: espaco.l, flexGrow: 1 },
  cabecalho: { gap: espaco.m, marginBottom: espaco.m },
  filtros: { flexDirection: "row", gap: espaco.s },
  filtro: { paddingHorizontal: 16, minHeight: 38, justifyContent: "center", borderRadius: raio.pilula, backgroundColor: cores.chip },
  filtroAtivo: { backgroundColor: cores.marca },
  filtroTexto: { fontSize: 13, fontWeight: "600", color: cores.tinta3 },
  filtroTextoAtivo: { color: cores.branco },
});
