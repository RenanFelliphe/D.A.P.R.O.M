import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { data, duracao } from "@shared/api/formatar";
import type { ExecucaoDoHistorico } from "@shared/api/os-app";
import { cliente } from "@/api/api";
import { mensagemDoErro } from "@/api/erros";
import { abrirPdfDaOs } from "@/os/detalhe/pdf";
import { rotaDaOs } from "@/os/rotas";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { Cartao } from "@/ui/Cartao";
import { Carregando, Vazio } from "@/ui/Estados";
import { Selo } from "@/ui/Selo";

/** As OS que o técnico encerrou nos últimos 60 dias (`GET /me/historico`), com o PDF de cada uma. */
export default function Historico() {
  const router = useRouter();
  const historico = useQuery({ queryKey: ["me", "historico"], queryFn: async () => (await cliente.chamar<{ execucoes: ExecucaoDoHistorico[] }>("/me/historico")).execucoes });
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  const abrirPdf = async (osId: string) => {
    setFalha(null);
    setAbrindo(osId);
    try {
      await abrirPdfDaOs(osId);
    } catch (e) {
      setFalha(mensagemDoErro(e));
    } finally {
      setAbrindo(null);
    }
  };

  if (historico.isPending) return <Carregando texto="Buscando o histórico…" />;
  if (historico.isError) {
    return <Vazio icone="cloud-offline-outline" titulo="Não foi possível carregar o histórico" texto={mensagemDoErro(historico.error)} acao={{ titulo: "Tentar de novo", aoPressionar: () => void historico.refetch() }} />;
  }

  return (
    <FlatList
      data={historico.data}
      keyExtractor={(e) => e.id}
      ListHeaderComponent={falha ? <Aviso tom="blq">{falha}</Aviso> : undefined}
      ListEmptyComponent={<Vazio icone="document-text-outline" titulo="Nenhuma OS encerrada" texto="As OS que você encerrar nos últimos 60 dias aparecem aqui, com o PDF." />}
      renderItem={({ item: e }) => (
        <Cartao aoPressionar={() => router.push(rotaDaOs(e.os_id))} rotulo={`OS ${e.numero_ordem ?? "sem número"}: ${e.titulo}`}>
          <View style={estilos.topo}>
            <Text style={estilos.numero}>{`OS ${e.numero_ordem ?? "—"}`}</Text>
            <Selo tom="enc">Encerrada</Selo>
          </View>
          <Text style={estilos.titulo}>{e.titulo}</Text>
          <Text style={estilos.nota}>{`${e.local_codigo} · ${data(e.fim)} · ${duracao(e.tempo_liquido_min)} líquidos`}</Text>
          <Botao titulo={e.pdf_pronto ? "Abrir o PDF" : "Abrir o PDF (gerando)"} icone="document-text-outline" variante="secundario" enviando={abrindo === e.os_id} aoPressionar={() => void abrirPdf(e.os_id)} />
        </Cartao>
      )}
      ItemSeparatorComponent={Separador}
      contentContainerStyle={estilos.lista}
      refreshing={historico.isRefetching}
      onRefresh={() => void historico.refetch()}
    />
  );
}

const Separador = () => <View style={{ height: espaco.m }} />;

const estilos = StyleSheet.create({
  lista: { padding: espaco.l, flexGrow: 1, gap: 0 },
  topo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  numero: { fontSize: 13, fontWeight: "700", color: cores.tinta },
  titulo: { fontSize: 15, color: cores.tinta2 },
  nota: { fontSize: 13, color: cores.tinta4 },
});
