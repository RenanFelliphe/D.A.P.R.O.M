import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { rotuloDaAcao } from "@shared/api/conferencia-execucao";
import { prazoDaConferencia } from "@shared/api/conferencia-texto";
import { rotas } from "@/os/rotas";
import { cores, espaco, raio } from "@/tema/tema";
import { Cartao, TituloDeCartao } from "@/ui/Cartao";
import { Icone } from "@/ui/Icone";
import { Selo } from "@/ui/Selo";
import { useParaConferir } from "./consultas";
import { conferenciasQuePedemAcao, descricaoDoResumo } from "./regras";

/**
 * "Para conferir" no perfil: as conferências da execução em aberto da pessoa, cada uma com a OS, o estado, o prazo e o que falta dela.
 * Some quando não há nenhuma ou quando não há sinal (a lista vem da `api`).
 */
export function CartaoParaConferir() {
  const router = useRouter();
  const { data } = useParaConferir();
  if (!data || data.length === 0) return null;
  const agora = new Date();
  const pedem = new Set(conferenciasQuePedemAcao(data).map((c) => c.id));
  return (
    <Cartao>
      <TituloDeCartao>Para conferir</TituloDeCartao>
      {data.map((c) => {
        const prazo = prazoDaConferencia(c, agora);
        return (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={`Conferência da OS ${c.os.numero_ordem ?? c.os.titulo}: ${rotuloDaAcao(c.minha_acao)}`}
            onPress={() => router.push(rotas.conferencia(c.os.id, c.id))}
            style={({ pressed }) => [estilos.linha, { opacity: pressed ? 0.85 : 1 }]}
          >
            <View style={estilos.texto}>
              <Text style={estilos.titulo}>{`OS ${c.os.numero_ordem ?? "—"}`}</Text>
              <Text style={estilos.detalhe} numberOfLines={1}>
                {c.os.titulo}
              </Text>
              <Text style={estilos.detalhe}>{[descricaoDoResumo(c), prazo].filter(Boolean).join(" · ")}</Text>
              <Selo tom={pedem.has(c.id) ? "al" : "neu"}>{rotuloDaAcao(c.minha_acao)}</Selo>
            </View>
            <Icone nome="chevron-forward" tamanho={18} cor={cores.tinta4} />
          </Pressable>
        );
      })}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: "row", alignItems: "center", gap: espaco.m, padding: espaco.m, borderRadius: raio.s, backgroundColor: cores.superficie2 },
  texto: { flex: 1, gap: espaco.xs },
  titulo: { fontSize: 15, fontWeight: "700", color: cores.tinta },
  detalhe: { fontSize: 12, lineHeight: 17, color: cores.tinta4 },
});
