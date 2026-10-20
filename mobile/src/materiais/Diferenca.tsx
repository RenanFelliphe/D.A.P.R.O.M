import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { textoDaQuantidade, type MudancaDeItem } from "@shared/api/sugestao-materiais";
import { cores, espaco, raio } from "@/tema/tema";
import { Icone } from "@/ui/Icone";
import { linhasDaMudanca, resumoDoTotal, SINAL_DA_MUDANCA } from "./regras-da-diferenca";

const COR_DO_SINAL: Record<MudancaDeItem["tipo"], { fundo: string; texto: string }> = {
  adicionado: { fundo: cores.okFundo, texto: cores.ok },
  removido: { fundo: cores.perigoFundo, texto: cores.perigo },
  alterado: { fundo: cores.alertaFundo, texto: cores.alerta },
  igual: { fundo: cores.chip, texto: cores.tinta4 },
};

/** Uma linha da diferença: o sinal, o item e o que mudou nele. */
function LinhaDaMudanca({ m }: { m: MudancaDeItem }) {
  const cor = COR_DO_SINAL[m.tipo];
  return (
    <View style={estilos.linha}>
      <View accessibilityLabel={m.tipo} style={[estilos.sinal, { backgroundColor: cor.fundo }]}>
        <Text style={[estilos.sinalTexto, { color: cor.texto }]}>{SINAL_DA_MUDANCA[m.tipo]}</Text>
      </View>
      <View style={estilos.texto}>
        <Text style={[estilos.descricao, m.tipo === "removido" && estilos.riscado]}>{m.descricao}</Text>
        {linhasDaMudanca(m).map((l) => (
          <Text key={l} style={estilos.detalhe}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

/**
 * O que a lista proposta muda na lista de base: primeiro os itens que entram, saem ou mudam, e, num bloco que abre e fecha, os que
 * ficam iguais. O cálculo é o de `diferencaDeListas` (o mesmo da `api` e da web).
 */
export function DiferencaDeListas({ mudancas }: { mudancas: MudancaDeItem[] }) {
  const [iguaisAbertos, setIguaisAbertos] = useState(false);
  const mudou = mudancas.filter((m) => m.tipo !== "igual");
  const iguais = mudancas.filter((m) => m.tipo === "igual");
  return (
    <View style={estilos.bloco}>
      <Text style={estilos.resumo}>{resumoDoTotal(mudancas)}</Text>
      {mudou.map((m) => (
        <LinhaDaMudanca key={m.chave} m={m} />
      ))}
      {iguais.length > 0 ? (
        <>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: iguaisAbertos }} onPress={() => setIguaisAbertos((a) => !a)} style={estilos.alternar} hitSlop={8}>
            <Text style={estilos.alternarTexto}>{iguais.length === 1 ? "1 item continua igual" : `${iguais.length} itens continuam iguais`}</Text>
            <Icone nome={iguaisAbertos ? "chevron-up" : "chevron-down"} tamanho={16} cor={cores.marca} />
          </Pressable>
          {iguaisAbertos ? iguais.map((m) => <LinhaDaMudanca key={m.chave} m={m} />) : null}
        </>
      ) : null}
    </View>
  );
}

/** Uma lista simples (a lista de base, a de agora): o item e a quantidade, sem comparar. */
export function ListaSimples({ itens }: { itens: { descricao: string; unidade: string; quantidade: number | null; observacao: string | null }[] }) {
  if (itens.length === 0) return <Text style={estilos.detalhe}>A lista estava vazia.</Text>;
  return (
    <View style={estilos.bloco}>
      {itens.map((i, n) => (
        <View key={`${n}|${i.descricao}|${i.unidade}`} style={estilos.simples}>
          <View style={estilos.texto}>
            <Text style={estilos.descricao}>{i.descricao}</Text>
            {i.observacao ? <Text style={estilos.detalhe}>{i.observacao}</Text> : null}
          </View>
          <Text style={estilos.quantidade}>{textoDaQuantidade(i.quantidade, i.unidade)}</Text>
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco.s },
  resumo: { fontSize: 13, fontWeight: "700", color: cores.tinta3 },
  linha: { flexDirection: "row", alignItems: "flex-start", gap: espaco.m, paddingVertical: 6, borderTopWidth: 1, borderTopColor: cores.linha2 },
  sinal: { width: 28, height: 28, borderRadius: raio.pilula, alignItems: "center", justifyContent: "center" },
  sinalTexto: { fontSize: 16, fontWeight: "700", lineHeight: 20 },
  texto: { flex: 1, gap: 2 },
  descricao: { fontSize: 14, color: cores.tinta, lineHeight: 20 },
  riscado: { textDecorationLine: "line-through", color: cores.tinta4 },
  detalhe: { fontSize: 12, color: cores.tinta4, lineHeight: 17 },
  alternar: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: espaco.xs, alignSelf: "flex-start" },
  alternarTexto: { fontSize: 13, fontWeight: "600", color: cores.marca },
  simples: { flexDirection: "row", alignItems: "flex-start", gap: espaco.s, paddingVertical: 6, borderTopWidth: 1, borderTopColor: cores.linha2 },
  quantidade: { fontSize: 13, color: cores.tinta3, textAlign: "right", maxWidth: 120 },
});
