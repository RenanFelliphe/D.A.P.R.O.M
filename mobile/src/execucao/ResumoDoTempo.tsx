import { StyleSheet, Text, View } from "react-native";
import { hora } from "@shared/api/formatar";
import { calcularTempo, cronometro, diaDe, horasMinutos, type PausaDaApi } from "@shared/api/execucao-tempo";
import { cores, espaco, raio } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { useAgora } from "./useAgora";

interface ResumoDoTempoProps {
  inicio: string;
  pausas: PausaDaApi[];
  numeroPessoas: number;
}

/** O cartão com o cronômetro (tempo líquido), o início e os totais da execução, calculados do início e das pausas da `api`. */
export function ResumoDoTempo({ inicio, pausas, numeroPessoas }: ResumoDoTempoProps) {
  // O cartão tem o próprio relógio de um segundo: só ele se redesenha a cada tique, não a tela das ações nem os formulários.
  const agora = useAgora();
  const tempo = calcularTempo(inicio, pausas, agora);
  const aberta = pausas.find((p) => !p.fim);
  const hoje = diaDe(inicio) === diaDe(new Date(agora));
  return (
    <View style={estilos.cartao}>
      <Text style={estilos.rotulo}>Tempo líquido</Text>
      <Text accessibilityRole="timer" accessibilityLabel="Cronômetro" style={[estilos.cronometro, aberta && { color: cores.alerta }]}>
        {cronometro(tempo.liquidoMs)}
      </Text>
      <Text style={estilos.suave}>{`Início ${hoje ? "hoje" : "em outro dia"}, às ${hora(inicio)} (horário do aparelho)`}</Text>
      <View style={estilos.totais}>
        <View style={estilos.total}>
          <Text style={estilos.suave}>Tempo total</Text>
          <Text style={estilos.valor}>{horasMinutos(tempo.totalMs)}</Text>
        </View>
        <View style={estilos.total}>
          <Text style={estilos.suave}>Pausas</Text>
          <Text style={estilos.valor}>{`${horasMinutos(tempo.pausaMs)} · ${pausas.length}`}</Text>
        </View>
        <View style={estilos.total}>
          <Text style={estilos.suave}>Pessoas</Text>
          <Text style={estilos.valor}>{numeroPessoas}</Text>
        </View>
      </View>
      {aberta ? (
        <Aviso tom="al" icone="pause-circle-outline" titulo={`Em pausa desde ${hora(aberta.inicio)}.`}>
          O tempo de pausa não entra no tempo líquido.
        </Aviso>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { gap: espaco.s, padding: espaco.l, borderRadius: raio.l, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.linha, alignItems: "center" },
  rotulo: { fontSize: 12, fontWeight: "700", color: cores.tinta3, textTransform: "uppercase" },
  cronometro: { fontSize: 48, fontWeight: "700", color: cores.tinta, fontVariant: ["tabular-nums"] },
  suave: { fontSize: 12, color: cores.tinta4, textAlign: "center" },
  totais: { flexDirection: "row", alignSelf: "stretch", justifyContent: "space-between", marginTop: espaco.s },
  total: { flex: 1, alignItems: "center", gap: 2 },
  valor: { fontSize: 16, fontWeight: "700", color: cores.tinta, fontVariant: ["tabular-nums"] },
});
