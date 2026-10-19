import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ItemDoModelo, Resposta } from "@shared/api/apr";
import { cores, espaco, raio } from "@/tema/tema";
import { Botao } from "@/ui/Botao";
import { Campo } from "@/ui/Campo";
import { Icone } from "@/ui/Icone";

/** A posição atual ("Pergunta 3 de 18" ou "Revisão · 18 de 18"), a seção da pergunta e a barra de progresso. */
export function Progresso({ titulo, secao, respondidas, total }: { titulo: string; secao: string; respondidas: number; total: number }) {
  const largura = respondidas > 0 && total > 0 ? `${Math.min(100, (respondidas / total) * 100).toFixed(1)}%` : "0%";
  return (
    <View style={estilos.progresso}>
      <View style={estilos.linha}>
        <Text style={estilos.progressoTitulo}>{titulo}</Text>
        <Text style={estilos.suave}>{secao}</Text>
      </View>
      <View accessibilityRole="progressbar" accessibilityLabel="Progresso do checklist" accessibilityValue={{ min: 0, max: total, now: respondidas }} style={estilos.barra}>
        <View style={[estilos.preenchimento, { width: largura as `${number}%` }]} />
      </View>
    </View>
  );
}

const botaoDeResposta = (valor: Resposta, rotulo: string, icone: "checkmark" | "close" | null, resposta: Resposta | undefined, aoResponder: (r: Resposta) => void) => {
  const marcada = resposta === valor;
  return (
    <Pressable
      key={valor}
      accessibilityRole="button"
      accessibilityState={{ selected: marcada }}
      onPress={() => aoResponder(valor)}
      style={({ pressed }) => [estilos.resposta, marcada && estilos.respostaMarcada, { opacity: pressed ? 0.85 : 1 }]}
    >
      {icone ? <Icone nome={icone} tamanho={26} cor={marcada ? cores.branco : cores.tinta2} /> : null}
      <Text style={[estilos.respostaTexto, marcada && { color: cores.branco }]}>{rotulo}</Text>
    </Pressable>
  );
};

/**
 * O cartão da pergunta atual: o texto e os botões Sim/Não (e NA, só nos itens que o permitem). Todas as perguntas têm a mesma
 * aparência: o técnico não pode saber quais são eliminatórias.
 */
export function PerguntaDaApr({ numero, item, resposta, aoResponder }: { numero: number; item: ItemDoModelo; resposta?: Resposta; aoResponder: (r: Resposta) => void }) {
  return (
    <View accessibilityLabel="Pergunta atual" style={estilos.pergunta}>
      <Text style={estilos.numero}>{`Pergunta ${numero}`}</Text>
      <Text style={estilos.texto}>{item.texto}</Text>
      <View style={estilos.respostas}>
        {botaoDeResposta("sim", "Sim", "checkmark", resposta, aoResponder)}
        {botaoDeResposta("nao", "Não", "close", resposta, aoResponder)}
        {item.permite_na ? botaoDeResposta("na", "NA", null, resposta, aoResponder) : null}
      </View>
    </View>
  );
}

/** "NA" passa, mas pede o motivo. */
export function ObservacaoDoNa({ observacao, aoObservar }: { observacao: string; aoObservar: (texto: string) => void }) {
  return (
    <Campo rotulo="Observação · obrigatória para NA" placeholder="Explique por que este item não se aplica" multiline numberOfLines={3} textAlignVertical="top" style={estilos.areaDeTexto} value={observacao} onChangeText={aoObservar} />
  );
}

interface NavegacaoProps {
  /** Índice (base 0) da pergunta atual. */
  indice: number;
  total: number;
  /** Só avança depois de responder; sem resposta, o toque diz o que falta em vez de ficar parado. */
  respondida: boolean;
  aoVoltar: () => void;
  aoAvancar: () => void;
  aoFaltarResposta: () => void;
}

/** Os botões Anterior / Próxima (na última pergunta: "Revisar e concluir"). */
export function NavegacaoDoChecklist({ indice, total, respondida, aoVoltar, aoAvancar, aoFaltarResposta }: NavegacaoProps) {
  return (
    <View style={estilos.navegacao}>
      <Botao titulo="Anterior" variante="secundario" estilo={estilos.metade} bloco={false} aoPressionar={indice === 0 ? () => undefined : aoVoltar} />
      <Botao titulo={indice === total - 1 ? "Revisar e concluir" : "Próxima"} estilo={estilos.metade} bloco={false} aoPressionar={respondida ? aoAvancar : aoFaltarResposta} />
    </View>
  );
}

interface GradeProps {
  total: number;
  /** Índice (base 0) da pergunta atual. */
  atual: number;
  respondida: (indice: number) => boolean;
  /** Quais perguntas (base 0) ainda pedem observação (NA sem motivo). */
  pendente: (indice: number) => boolean;
  aoSelecionar: (indice: number) => void;
}

/** Um chip por pergunta, para ir a qualquer uma; o contorno vermelho marca a que ainda pede observação. */
export function GradeDePerguntas({ total, atual, respondida, pendente, aoSelecionar }: GradeProps) {
  return (
    <View style={estilos.grade}>
      <Text style={estilos.gradeTitulo}>Todas as perguntas · toque para ir a uma</Text>
      <View style={estilos.chips}>
        {Array.from({ length: total }, (_, i) => {
          const feita = respondida(i);
          const falta = pendente(i);
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Pergunta ${i + 1}${feita ? ", respondida" : ""}${falta ? ", falta observação" : ""}`}
              onPress={() => aoSelecionar(i)}
              style={[estilos.chip, feita && estilos.chipFeito, i === atual && estilos.chipAtual, falta && i !== atual && { borderColor: cores.perigo }]}
            >
              <Text style={[estilos.chipTexto, (i === atual || feita) && { color: i === atual ? cores.branco : cores.marcaTinta }, falta && i !== atual && { color: cores.perigo }]}>{i + 1}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  progresso: { gap: espaco.s, padding: espaco.m, borderRadius: raio.m, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.linha },
  linha: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: espaco.m },
  progressoTitulo: { fontSize: 15, fontWeight: "700", color: cores.tinta },
  suave: { flex: 1, textAlign: "right", fontSize: 12, color: cores.tinta4 },
  barra: { height: 8, borderRadius: 4, backgroundColor: cores.chip, overflow: "hidden" },
  preenchimento: { height: "100%", backgroundColor: cores.marca },
  pergunta: { gap: espaco.l, padding: espaco.l, borderRadius: raio.l, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.linha },
  numero: { fontSize: 13, fontWeight: "700", color: cores.marca },
  texto: { fontSize: 19, lineHeight: 27, fontWeight: "600", color: cores.tinta },
  respostas: { flexDirection: "row", gap: espaco.s },
  resposta: { flex: 1, minHeight: 68, borderRadius: raio.m, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.superficie2, alignItems: "center", justifyContent: "center", gap: 4 },
  respostaMarcada: { backgroundColor: cores.marca, borderColor: cores.marca },
  respostaTexto: { fontSize: 17, fontWeight: "700", color: cores.tinta2 },
  areaDeTexto: { minHeight: 88, paddingTop: espaco.m },
  navegacao: { flexDirection: "row", gap: espaco.s },
  metade: { flex: 1 },
  grade: { gap: espaco.s, padding: espaco.m, borderRadius: raio.m, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.linha },
  gradeTitulo: { fontSize: 12, fontWeight: "700", color: cores.tinta3, textTransform: "uppercase" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: espaco.s },
  chip: { width: 44, height: 44, borderRadius: raio.s, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.superficie2, alignItems: "center", justifyContent: "center" },
  chipFeito: { backgroundColor: cores.marcaFundo, borderColor: cores.marcaBorda },
  chipAtual: { backgroundColor: cores.marca, borderColor: cores.marca },
  chipTexto: { fontSize: 14, fontWeight: "700", color: cores.tinta3 },
});
