import { useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { cores, espaco, raio } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { ALTURA_DO_DESENHO, caminhoDoTraco, ControleDoDesenho, LARGURA_DO_DESENHO, type Ponto } from "./traco";

interface CaixaDeAssinaturaProps {
  /** Recebe o PNG desenhado, em base64; uma falha vira a mensagem acima dos botões. */
  aoSalvar: (pngEmBase64: string) => Promise<void>;
  rotuloSalvar?: string;
}

const TEMPO_PARA_GERAR_O_PNG_MS = 8000;

/**
 * A área para desenhar a assinatura com o dedo: "Limpar" refaz e "Salvar" entrega um PNG de 600 × 180 com fundo transparente, o mesmo
 * da web. O botão de salvar nunca fica desativado por falta de desenho: sem traço, a mensagem diz o que falta. Enquanto o dedo está
 * na caixa a tela não rola.
 */
export function CaixaDeAssinatura({ aoSalvar, rotuloSalvar = "Salvar assinatura" }: CaixaDeAssinaturaProps) {
  const svg = useRef<Svg>(null);
  const [tracos, setTracos] = useState<Ponto[][]>([]);
  const [salvando, setSalvando] = useState(false);
  const [falta, setFalta] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [controle] = useState(() => new ControleDoDesenho(setTracos));
  const [dedo] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !controle.travado,
      onMoveShouldSetPanResponder: () => !controle.travado,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => {
        setFalta(null);
        controle.comecar(e.nativeEvent.locationX, e.nativeEvent.locationY);
      },
      onPanResponderMove: (e) => controle.mover(e.nativeEvent.locationX, e.nativeEvent.locationY),
    }),
  );

  const limpar = () => {
    setFalta(null);
    setErro(null);
    controle.limpar();
  };

  const salvar = async () => {
    setErro(null);
    if (!controle.temTraco) return setFalta("Desenhe a sua assinatura na caixa antes de salvar.");
    const alvo = svg.current;
    if (!alvo) return;
    setSalvando(true);
    controle.travar(true);
    try {
      const png = await new Promise<string>((ok, falhou) => {
        const relogio = setTimeout(() => falhou(new Error("Não foi possível gerar a imagem da assinatura. Tente de novo.")), TEMPO_PARA_GERAR_O_PNG_MS);
        try {
          alvo.toDataURL(
            (base64) => {
              clearTimeout(relogio);
              ok(base64);
            },
            { width: LARGURA_DO_DESENHO, height: ALTURA_DO_DESENHO },
          );
        } catch (e) {
          clearTimeout(relogio);
          falhou(e);
        }
      });
      await aoSalvar(png);
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não foi possível salvar a assinatura. Tente de novo.");
    } finally {
      controle.travar(false);
      setSalvando(false);
    }
  };

  return (
    <View style={estilos.bloco}>
      <View
        accessibilityLabel="Área para desenhar a assinatura"
        style={[estilos.caixa, falta ? estilos.comFalta : null]}
        onLayout={(e) => {
          controle.medir(e.nativeEvent.layout.width, e.nativeEvent.layout.height);
        }}
        {...dedo.panHandlers}
      >
        {tracos.length === 0 ? <Text style={estilos.dica}>Assine aqui com o dedo</Text> : null}
        <View style={estilos.linha} pointerEvents="none" />
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg ref={svg} width="100%" height="100%" viewBox={`0 0 ${LARGURA_DO_DESENHO} ${ALTURA_DO_DESENHO}`}>
            {tracos.map((t, i) => (
              <Path key={i} d={caminhoDoTraco(t)} stroke={cores.tinta} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            ))}
          </Svg>
        </View>
      </View>
      {falta ? (
        <Text accessibilityRole="alert" style={estilos.falta}>
          {falta}
        </Text>
      ) : null}
      {erro ? <Aviso tom="blq">{erro}</Aviso> : null}
      <View style={estilos.botoes}>
        <Botao titulo="Limpar" variante="secundario" icone="trash-outline" aoPressionar={salvando ? () => undefined : limpar} />
        <Botao titulo={rotuloSalvar} enviando={salvando} aoPressionar={() => void salvar()} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco.m },
  caixa: { aspectRatio: LARGURA_DO_DESENHO / ALTURA_DO_DESENHO, borderWidth: 1.5, borderStyle: "dashed", borderColor: cores.marcaBorda, borderRadius: raio.m, backgroundColor: cores.superficie, overflow: "hidden", justifyContent: "center", alignItems: "center" },
  comFalta: { borderColor: cores.perigo, backgroundColor: cores.perigoFundo },
  dica: { fontSize: 15, color: cores.tinta4 },
  linha: { position: "absolute", left: espaco.l, right: espaco.l, bottom: 36, height: 1, backgroundColor: cores.linha },
  falta: { fontSize: 13, color: cores.perigo },
  botoes: { gap: espaco.s },
});
