import { StyleSheet, Text, View } from "react-native";
import { ROTULO_DO_NIVEL, type PrevisaoDoTempo } from "@shared/api/clima";
import { cores, espaco, raio } from "@/tema/tema";
import { Icone } from "@/ui/Icone";
import { horasParaChips, iconeDoClima, linhaDoLocal, rotuloDaHora, tomDoNivel } from "./regras";

interface CartaoDePrevisaoProps {
  previsao: PrevisaoDoTempo;
  /** O título pequeno do cartão ("Previsão do tempo", "Tempo nas próximas horas"). */
  titulo?: string;
  /** Dentro do modal e do checklist, o cartão fica mais enxuto (sem a orientação, que vem logo abaixo). */
  semOrientacao?: boolean;
}

/**
 * A previsão do tempo, em cartão: o nível (com as cores do tema, sem vermelho puro), a frase da `api`, a orientação, as horas em chips
 * com o ícone, a temperatura e a chance de chuva, e o local com a hora em que foi consultada. Só desenha o que a `api` mandou: quem decide
 * o nível e escreve as frases é a `api`, para o app e a web dizerem a mesma coisa.
 */
export function CartaoDePrevisao({ previsao, titulo = "Previsão do tempo", semOrientacao = false }: CartaoDePrevisaoProps) {
  if (!previsao.disponivel || !previsao.nivel) return null;
  const tom = tomDoNivel[previsao.nivel];
  return (
    <View accessibilityLabel={`${titulo}: ${ROTULO_DO_NIVEL[previsao.nivel]}. ${previsao.titulo}`} style={[estilos.cartao, { backgroundColor: tom.fundo, borderColor: tom.borda }]}>
      <View style={estilos.cabecalho}>
        <Icone nome={previsao.nivel === "sem_risco" ? "checkmark-circle-outline" : "alert-circle-outline"} tamanho={20} cor={tom.texto} />
        <Text style={[estilos.titulo, { color: tom.texto }]}>{titulo}</Text>
        <Text style={[estilos.nivel, { color: tom.texto }]}>{ROTULO_DO_NIVEL[previsao.nivel]}</Text>
      </View>
      <Text style={[estilos.frase, { color: tom.texto }]}>{previsao.titulo}</Text>
      {semOrientacao ? null : <Text style={[estilos.orientacao, { color: tom.texto }]}>{previsao.orientacao}</Text>}
      <View style={estilos.horas}>
        {horasParaChips(previsao.horas).map((h) => (
          <View key={h.hora} accessibilityLabel={`${rotuloDaHora(h)}: ${h.condicao}, ${h.temperatura} graus, chance de chuva ${h.chance_chuva} por cento`} style={estilos.hora}>
            <Text style={estilos.horaRotulo}>{rotuloDaHora(h)}</Text>
            <Icone nome={iconeDoClima[h.icone]} tamanho={22} cor={h.nivel === "sem_risco" ? cores.tinta3 : tomDoNivel[h.nivel].texto} />
            <Text style={estilos.temperatura}>{`${h.temperatura}°`}</Text>
            <Text style={estilos.chuva}>{`${h.chance_chuva}%`}</Text>
          </View>
        ))}
      </View>
      <Text style={[estilos.local, { color: tom.texto }]}>{linhaDoLocal(previsao.local, previsao.consultada_em)}</Text>
    </View>
  );
}

/** O esqueleto do cartão enquanto a previsão carrega (o espaço não pula quando ela chega). */
export function EsqueletoDaPrevisao() {
  return (
    <View accessibilityLabel="Carregando a previsão do tempo" style={[estilos.cartao, { backgroundColor: cores.superficie2, borderColor: cores.linha }]}>
      <View style={[estilos.barra, { width: "45%" }]} />
      <View style={[estilos.barra, { width: "80%", height: 14 }]} />
      <View style={estilos.horas}>
        {Array.from({ length: 5 }, (_, i) => (
          <View key={i} style={[estilos.hora, { backgroundColor: cores.chip }]} />
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { gap: espaco.s, padding: espaco.m, borderRadius: raio.m, borderWidth: 1 },
  cabecalho: { flexDirection: "row", alignItems: "center", gap: espaco.s },
  titulo: { fontSize: 13, fontWeight: "700", flex: 1 },
  nivel: { fontSize: 12, fontWeight: "700" },
  frase: { fontSize: 15, fontWeight: "700", lineHeight: 21 },
  orientacao: { fontSize: 13, lineHeight: 19 },
  horas: { flexDirection: "row", gap: espaco.xs, justifyContent: "space-between" },
  hora: { flex: 1, minWidth: 44, minHeight: 78, alignItems: "center", justifyContent: "center", gap: 2, borderRadius: raio.s, backgroundColor: "rgba(255,255,255,0.7)", paddingVertical: espaco.xs },
  horaRotulo: { fontSize: 11, fontWeight: "700", color: cores.tinta3 },
  temperatura: { fontSize: 13, fontWeight: "700", color: cores.tinta },
  chuva: { fontSize: 11, color: cores.tinta4 },
  local: { fontSize: 11, opacity: 0.85 },
  barra: { height: 10, borderRadius: 5, backgroundColor: cores.chip },
});
