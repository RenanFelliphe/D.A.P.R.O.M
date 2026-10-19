import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Conquistas } from "@/gamificacao/Conquistas";
import { MinhaPontuacao } from "@/gamificacao/MinhaPontuacao";
import { Ranking } from "@/gamificacao/Ranking";
import { FaixaDeAusencia } from "@/os/FaixaDeAusencia";
import { Segmentos } from "@/ui/Segmentos";
import { Tela } from "@/ui/Tela";

type Secao = "minha" | "ranking" | "conquistas";

const SECOES: { id: Secao; rotulo: string }[] = [
  { id: "minha", rotulo: "Minha pontuação" },
  { id: "ranking", rotulo: "Ranking" },
  { id: "conquistas", rotulo: "Conquistas" },
];

const ehSecao = (v: unknown): v is Secao => SECOES.some((s) => s.id === v);

/**
 * Pontos: a gamificação do técnico, só de consulta: a pontuação com o extrato, o ranking de pessoas e de equipes e as conquistas. Os
 * cadastros de pontos, patentes e conquistas ficam só na web. A Vitória leva a cada seção pelo parâmetro `aba`.
 */
export default function Pontos() {
  const consultas = useQueryClient();
  const { aba } = useLocalSearchParams<{ aba?: string }>();
  const [escolhida, setEscolhida] = useState<Secao | null>(null);
  // A Vitória leva a outra seção mudando o parâmetro `aba`: a escolha feita no toque dá lugar a ele.
  const [abaVista, setAbaVista] = useState(aba);
  if (aba !== abaVista) {
    setAbaVista(aba);
    setEscolhida(null);
  }
  const [atualizando, setAtualizando] = useState(false);
  const secao: Secao = escolhida ?? (ehSecao(aba) ? aba : "minha");

  const atualizar = async () => {
    setAtualizando(true);
    try {
      await consultas.invalidateQueries({ queryKey: ["gamificacao"] });
    } finally {
      setAtualizando(false);
    }
  };

  return (
    <Tela bordas={[]} aoAtualizar={() => void atualizar()} atualizando={atualizando}>
      <FaixaDeAusencia />
      <Segmentos opcoes={SECOES} valor={secao} aoMudar={setEscolhida} />
      {secao === "minha" ? <MinhaPontuacao /> : secao === "ranking" ? <Ranking /> : <Conquistas />}
    </Tela>
  );
}
