import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { dataHora } from "@shared/api/formatar";
import { mensagemDoErro } from "@/api/erros";
import { listarRecusados } from "@/offline/app";
import { rotuloDoEvento } from "@/offline/rotulos";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Cartao } from "@/ui/Cartao";
import { Carregando, Vazio } from "@/ui/Estados";
import { Selo } from "@/ui/Selo";

/**
 * Os registros que o servidor não aceitou ao receber o que foi feito sem sinal (a OS mudou, a APR deixou de valer…). Eles saíram da fila
 * mas ficam guardados aqui, com o motivo, para o técnico mostrar ao supervisor: a sincronização nunca descarta dado de campo.
 */
export default function Recusados() {
  const recusados = useQuery({ queryKey: ["recusados"], queryFn: listarRecusados, networkMode: "always" });

  if (recusados.isPending) return <Carregando texto="Buscando os registros…" />;
  if (recusados.isError) return <Vazio icone="alert-circle-outline" titulo="Não foi possível abrir os registros" texto={mensagemDoErro(recusados.error)} acao={{ titulo: "Tentar de novo", aoPressionar: () => void recusados.refetch() }} />;

  return (
    <FlatList
      data={recusados.data}
      keyExtractor={(e) => e.id}
      ListHeaderComponent={recusados.data.length > 0 ? <Aviso tom="al" titulo="Mostre estes registros ao seu supervisor.">O servidor não os aceitou, e eles não vão subir de novo. O motivo de cada um está abaixo.</Aviso> : undefined}
      ListEmptyComponent={<Vazio icone="checkmark-circle-outline" titulo="Nenhum registro recusado" texto="Tudo o que você fez foi aceito pelo servidor." />}
      renderItem={({ item: e }) => (
        <Cartao rotulo={`${rotuloDoEvento(e.tipo)}: ${e.mensagem}`}>
          <View style={estilos.topo}>
            <Text style={estilos.titulo}>{rotuloDoEvento(e.tipo)}</Text>
            <Selo tom="blq">Recusado</Selo>
          </View>
          <Text style={estilos.mensagem}>{e.mensagem}</Text>
          <Text style={estilos.nota}>{`${e.numeroOrdem ? `OS ${e.numeroOrdem} · ` : ""}feito em ${dataHora(e.ocorridoEm)} · recusado em ${dataHora(e.recusadoEm)}`}</Text>
        </Cartao>
      )}
      ItemSeparatorComponent={Separador}
      contentContainerStyle={estilos.lista}
      refreshing={recusados.isRefetching}
      onRefresh={() => void recusados.refetch()}
    />
  );
}

const Separador = () => <View style={{ height: espaco.m }} />;

const estilos = StyleSheet.create({
  lista: { padding: espaco.l, flexGrow: 1, gap: 0 },
  topo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: espaco.s },
  titulo: { fontSize: 15, fontWeight: "700", color: cores.tinta, flex: 1 },
  mensagem: { fontSize: 14, lineHeight: 20, color: cores.tinta2 },
  nota: { fontSize: 12, color: cores.tinta4 },
});
