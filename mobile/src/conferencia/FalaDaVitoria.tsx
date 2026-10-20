import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { EXPLICACAO_DA_CONFERENCIA, EXPLICACAO_DA_TOLERANCIA } from "@shared/api/conferencia-texto";
import { bancoDoAparelho } from "@/offline/banco-nativo";
import { useSessao } from "@/sessao/SessaoProvider";
import { cores, espaco, raio } from "@/tema/tema";
import { Botao } from "@/ui/Botao";
import { Figurinha } from "@/vitoria/Figurinha";
import { guardarQueViAExplicacao, jaViAExplicacao } from "./ja-vi";
import { Surgir } from "./Surgir";

/**
 * A Vitória explica a conferência na primeira vez que a pessoa chega nela: a figurinha dela e duas frases (como a conferência funciona e
 * a tolerância dos horários). "Entendi" guarda o "já vi" no aparelho; sem o armazenamento a tela segue sem a explicação, nunca quebra.
 */
export function FalaDaVitoria() {
  const { eu } = useSessao();
  const usuarioId = eu?.usuario.id ?? null;
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (!usuarioId) return;
    let ativo = true;
    jaViAExplicacao(bancoDoAparelho, usuarioId).then((jaVi) => {
      if (ativo && !jaVi) setVisivel(true);
    });
    return () => {
      ativo = false;
    };
  }, [usuarioId]);

  if (!visivel || !usuarioId) return null;
  const entendi = () => {
    setVisivel(false);
    void guardarQueViAExplicacao(bancoDoAparelho, usuarioId, new Date());
  };
  return (
    <Surgir>
      <View style={estilos.cartao}>
        <View style={estilos.topo}>
          <Figurinha reacao="ola" tocar tamanho={84} />
          <View style={estilos.fala}>
            <Text style={estilos.nome}>Vitória</Text>
            <Text style={estilos.texto}>{EXPLICACAO_DA_CONFERENCIA}</Text>
          </View>
        </View>
        <Text style={estilos.suave}>{EXPLICACAO_DA_TOLERANCIA}</Text>
        <Botao titulo="Entendi" variante="secundario" aoPressionar={entendi} />
      </View>
    </Surgir>
  );
}

const estilos = StyleSheet.create({
  cartao: { gap: espaco.m, padding: espaco.l, borderRadius: raio.m, borderWidth: 1, borderColor: cores.marcaBorda, backgroundColor: cores.marcaFundo },
  topo: { flexDirection: "row", alignItems: "center", gap: espaco.m },
  fala: { flex: 1, gap: espaco.xs },
  nome: { fontSize: 13, fontWeight: "700", color: cores.marcaTinta },
  texto: { fontSize: 14, lineHeight: 20, color: cores.marcaTinta },
  suave: { fontSize: 13, lineHeight: 19, color: cores.marcaTinta },
});
