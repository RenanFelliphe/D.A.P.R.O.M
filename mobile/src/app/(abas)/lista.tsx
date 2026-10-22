import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { rotuloDoStatus, type OsStatus } from "@shared/api/tipos";
import { mensagemDoErro } from "@/api/erros";
import { FaixaDeAssinaturasPendentes } from "@/assinatura/FaixaDeAssinaturasPendentes";
import { PrevisaoNaLista } from "@/clima/PrevisaoNaLista";
import { CartaoDaOs } from "@/os/CartaoDaOs";
import { FaixaDeAusencia } from "@/os/FaixaDeAusencia";
import { AtalhoDeExecucao, FaixaDeAssinaturas } from "@/os/FaixasDaLista";
import { useListaDeOs } from "@/os/consultas";
import { rotaDaOs } from "@/os/rotas";
import { useSessao } from "@/sessao/SessaoProvider";
import { cores, espaco, raio } from "@/tema/tema";
import { Carregando, Vazio } from "@/ui/Estados";
import { Icone } from "@/ui/Icone";
import { useAtrasado } from "@/ui/useAtrasado";

/** Os grupos da lista, na ordem de quem trabalha: o que falta fazer vem primeiro, o que já terminou, por último. */
const STATUS_DA_LISTA: OsStatus[] = ["liberada", "pendente", "em_execucao", "encerrando", "aguardando_supervisor", "encerrada"];

/**
 * A tela inicial do técnico: as OS da equipe, um status por vez, com busca pelo número da ordem e pelo título, e no topo a previsão do
 * tempo do expediente. "Puxar para atualizar" traz a OS nova e a previsão nova (não há push, por decisão do projeto).
 */
export default function Lista() {
  const router = useRouter();
  const consultas = useQueryClient();
  const { eu } = useSessao();
  const [status, setStatus] = useState<OsStatus>("liberada");
  const [texto, setTexto] = useState("");
  const busca = useAtrasado(texto.trim());
  const lista = useListaDeOs(status, busca);

  const itens = lista.data?.pages.flatMap((p) => p.os) ?? [];
  const contagem = lista.data?.pages[0]?.contagem_por_status;
  const atualizando = lista.isRefetching && !lista.isFetchingNextPage;

  const atualizar = () => {
    void lista.refetch();
    void consultas.invalidateQueries({ queryKey: ["me"] });
    void consultas.invalidateQueries({ queryKey: ["clima"] });
  };

  const cabecalho = (
    <View style={estilos.cabecalho}>
      <FaixaDeAusencia />
      <FaixaDeAssinaturas />
      <FaixaDeAssinaturasPendentes />
      <AtalhoDeExecucao />
      <PrevisaoNaLista />
      <View style={estilos.busca}>
        <Icone nome="search" tamanho={18} cor={cores.tinta4} />
        <TextInput
          accessibilityLabel="Buscar OS"
          value={texto}
          onChangeText={setTexto}
          placeholder="Buscar pelo número da ordem ou pelo título"
          placeholderTextColor={cores.tinta4}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          style={estilos.campoBusca}
        />
        {texto ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Limpar a busca" onPress={() => setTexto("")} hitSlop={10}>
            <Icone nome="close-circle" tamanho={18} cor={cores.tinta4} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.filtros}>
        {STATUS_DA_LISTA.map((s) => {
          const ativo = s === status;
          return (
            <Pressable key={s} accessibilityRole="button" accessibilityState={{ selected: ativo }} onPress={() => setStatus(s)} style={[estilos.filtro, ativo && estilos.filtroAtivo]}>
              <Text style={[estilos.filtroTexto, ativo && estilos.filtroTextoAtivo]}>{`${rotuloDoStatus[s]} · ${contagem?.[s] ?? 0}`}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const vazio = lista.isPending ? (
    <Carregando texto="Buscando as OS…" />
  ) : lista.isError ? (
    <Vazio icone="cloud-offline-outline" titulo="Não foi possível carregar as OS" texto={mensagemDoErro(lista.error)} acao={{ titulo: "Tentar de novo", aoPressionar: () => void lista.refetch() }} />
  ) : (
    <Vazio icone="clipboard-outline" titulo={busca ? "Nenhuma OS encontrada" : `Nenhuma OS ${rotuloDoStatus[status].toLowerCase()}`} texto={busca ? "Confira o número da ordem ou tente uma palavra do título." : "Puxe a lista para baixo para atualizar."} />
  );

  return (
    <FlatList
      data={itens}
      keyExtractor={(o) => o.id}
      renderItem={({ item }) => <CartaoDaOs os={item} usuarioId={eu?.usuario.id ?? ""} aoAbrir={() => router.push(rotaDaOs(item.id))} />}
      ListHeaderComponent={cabecalho}
      ListEmptyComponent={vazio}
      ListFooterComponent={lista.isFetchingNextPage ? <Carregando texto="Carregando mais…" /> : undefined}
      onEndReached={() => lista.hasNextPage && !lista.isFetchingNextPage && void lista.fetchNextPage()}
      onEndReachedThreshold={0.4}
      refreshing={atualizando}
      onRefresh={atualizar}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={estilos.lista}
      ItemSeparatorComponent={Separador}
    />
  );
}

const Separador = () => <View style={{ height: espaco.m }} />;

const estilos = StyleSheet.create({
  lista: { padding: espaco.l, flexGrow: 1 },
  cabecalho: { gap: espaco.m, marginBottom: espaco.m },
  busca: { flexDirection: "row", alignItems: "center", gap: espaco.s, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.linha, borderRadius: raio.m, paddingHorizontal: espaco.m, minHeight: 48 },
  campoBusca: { flex: 1, fontSize: 15, color: cores.tinta, paddingVertical: 8 },
  filtros: { gap: espaco.s, paddingRight: espaco.l },
  filtro: { paddingHorizontal: 14, minHeight: 38, justifyContent: "center", borderRadius: raio.pilula, backgroundColor: cores.chip },
  filtroAtivo: { backgroundColor: cores.marca },
  filtroTexto: { fontSize: 13, fontWeight: "600", color: cores.tinta3 },
  filtroTextoAtivo: { color: cores.branco },
});
