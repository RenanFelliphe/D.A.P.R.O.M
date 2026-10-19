import { useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet } from "react-native";
import { duracaoDaReacao, type Reacao } from "@shared/vitoria/reacoes";
import { ANIMACAO_DA_REACAO, QUADRO_DA_REACAO } from "./imagens";

interface FigurinhaProps {
  reacao: Reacao;
  completa?: boolean;
  /** A animação roda ao aparecer. Falso, a figurinha só mostra o quadro parado (mensagem antiga, painel reaberto, resposta que chegou com o painel fechado). */
  tocar: boolean;
  tamanho?: number;
  /** Avisa quando a animação acaba, para a mensagem não tocar de novo ao reabrir o painel. */
  aoTerminar?: () => void;
}

/**
 * A reação da Vitória como figurinha, parte da própria mensagem (`vitoria.md`, seção 2.8): toca a animação uma vez e fica no quadro
 * parado, como uma figurinha de WhatsApp. Um toque nela toca de novo, inteira. A animação é um WebP animado; cada rodada remonta a
 * imagem (`key`) para recomeçar do primeiro quadro.
 */
export function Figurinha({ reacao, completa = false, tocar, tamanho = 112, aoTerminar }: FigurinhaProps) {
  const [rodada, setRodada] = useState(0);
  /** A rodada cuja animação já acabou: a figurinha mostra o quadro parado até o próximo toque ou a próxima mensagem. */
  const [terminouRodada, setTerminouRodada] = useState<number | null>(null);
  const ativo = tocar || rodada > 0;
  const animando = ativo && terminouRodada !== rodada;
  // O aviso de fim vem de uma função nova a cada render do pai: guardá-la numa ref evita recomeçar a animação.
  const aoTerminarRef = useRef(aoTerminar);
  useEffect(() => {
    aoTerminarRef.current = aoTerminar;
  });

  useEffect(() => {
    if (!ativo) return;
    const relogio = setTimeout(
      () => {
        setTerminouRodada(rodada);
        aoTerminarRef.current?.();
      },
      duracaoDaReacao(reacao, completa || rodada > 0),
    );
    return () => clearTimeout(relogio);
  }, [ativo, reacao, completa, rodada]);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Vitória. Toque para ver a animação de novo" onPress={() => setRodada((r) => r + 1)} style={{ width: tamanho, height: tamanho }}>
      <Image key={`${animando ? "animada" : "quadro"}-${rodada}`} source={animando ? ANIMACAO_DA_REACAO[reacao] : QUADRO_DA_REACAO[reacao]} style={estilos.imagem} resizeMode="contain" />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  imagem: { width: "100%", height: "100%" },
});
