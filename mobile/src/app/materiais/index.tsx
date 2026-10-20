import { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { ehSupervisor } from "@shared/api/tipos";
import { mensagemDoErro } from "@/api/erros";
import { CartaoDaSugestao } from "@/materiais/CartaoDaSugestao";
import { useListaDeSugestoes, useParaAvaliar, type EscopoDeSugestoes } from "@/materiais/consultas";
import { useSessao } from "@/sessao/SessaoProvider";
import { espaco } from "@/tema/tema";
import { Carregando, Vazio } from "@/ui/Estados";
import { Segmentos } from "@/ui/Segmentos";

const TEXTO_VAZIO: Record<EscopoDeSugestoes, { titulo: string; texto: string }> = {
  minhas: { titulo: "Nenhuma sugestão ainda", texto: "No detalhe de uma OS, toque em “Sugerir lista” ou “Contestar lista” para melhorar os materiais recomendados do serviço." },
  avaliar: { titulo: "Nada para avaliar", texto: "As sugestões e contestações dos serviços que a sua equipe mais faz aparecem aqui." },
};

/**
 * Sugestões de materiais: as que a pessoa enviou ("Minhas") e, para quem supervisiona uma equipe, as que esperam a sua avaliação
 * ("Para avaliar", com o número). Tocar numa sugestão abre o detalhe.
 */
export default function Sugestoes() {
  const { eu } = useSessao();
  const avalia = eu ? ehSupervisor(eu.usuario) : false;
  const [escopo, setEscopo] = useState<EscopoDeSugestoes>("minhas");
  const paraAvaliar = useParaAvaliar(avalia);
  const lista = useListaDeSugestoes(avalia ? escopo : "minhas");
  const itens = lista.data?.pages.flatMap((p) => p.sugestoes) ?? [];
  const atualizando = lista.isRefetching && !lista.isFetchingNextPage;

  const cabecalho = avalia ? (
    <View style={estilos.cabecalho}>
      <Segmentos
        opcoes={[
          { id: "minhas", rotulo: "Minhas" },
          { id: "avaliar", rotulo: paraAvaliar.data ? `Para avaliar · ${paraAvaliar.data}` : "Para avaliar" },
        ]}
        valor={escopo}
        aoMudar={setEscopo}
      />
    </View>
  ) : undefined;

  const vazio = lista.isPending ? (
    <Carregando texto="Buscando as sugestões…" />
  ) : lista.isError ? (
    <Vazio icone="cloud-offline-outline" titulo="Não foi possível carregar as sugestões" texto={mensagemDoErro(lista.error)} acao={{ titulo: "Tentar de novo", aoPressionar: () => void lista.refetch() }} />
  ) : (
    <Vazio icone="list-outline" titulo={TEXTO_VAZIO[escopo].titulo} texto={TEXTO_VAZIO[escopo].texto} />
  );

  return (
    <FlatList
      data={itens}
      keyExtractor={(s) => s.id}
      renderItem={({ item }) => <CartaoDaSugestao sugestao={item} />}
      ListHeaderComponent={cabecalho}
      ListEmptyComponent={vazio}
      ListFooterComponent={lista.isFetchingNextPage ? <Carregando texto="Carregando mais…" /> : undefined}
      onEndReached={() => lista.hasNextPage && !lista.isFetchingNextPage && void lista.fetchNextPage()}
      onEndReachedThreshold={0.4}
      refreshing={atualizando}
      onRefresh={() => {
        void lista.refetch();
        void paraAvaliar.refetch();
      }}
      contentContainerStyle={estilos.lista}
      ItemSeparatorComponent={Separador}
    />
  );
}

const Separador = () => <View style={{ height: espaco.m }} />;

const estilos = StyleSheet.create({
  lista: { padding: espaco.l, flexGrow: 1 },
  cabecalho: { marginBottom: espaco.m },
});
