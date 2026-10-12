"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { BoasVindasTreino } from "./BoasVindasTreino";
import { BotaoRoteiro } from "./BotaoRoteiro";
import { estadoDoTreino, useModoDoTreino } from "./estado";
import { TutorialDirecionado } from "./TutorialDirecionado";

interface TreinoRaizProps {
  /** O cookie do modo treino está ligado (o servidor leu `emTreino()`). */
  emTreino: boolean;
  /** Sistema real, técnico com treinamento `nao_iniciado` e sem "Fazer depois" nesta sessão: abre as boas-vindas. */
  primeiroAcesso: boolean;
  /** Técnico cadastrado por supervisor e ainda não liberado: ao concluir o tutorial o destino é "Ver situação do meu acesso". */
  pendente?: boolean;
}

const semAssinatura = () => () => {};
/** `false` no servidor e na hidratação, `true` depois: evita abrir diálogo antes de o navegador conhecer o estado do treino. */
const useHidratado = () => useSyncExternalStore(semAssinatura, () => true, () => false);

/**
 * Orquestra o treino no navegador, dentro da casca do técnico: lê a modalidade que a rota `/app/treino/entrar` deixa na
 * URL (`?treino=`), abre as boas-vindas (primeiro acesso ou escolha da modalidade), mostra o tutorial direcionado ou o botão
 * "Roteiro" do modo livre e limpa o estado local quando o treino está desligado.
 */
export function TreinoRaiz({ emTreino, primeiroAcesso, pendente = false }: TreinoRaizProps) {
  const hidratado = useHidratado();
  const modo = useModoDoTreino();
  const [boasVindasFechadas, setBoasVindasFechadas] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const parametro = url.searchParams.get("treino");
    if (parametro === "direcionado" || parametro === "livre") {
      estadoDoTreino.definirModo(parametro);
      estadoDoTreino.definirPasso(0);
    } else if (parametro === "escolher") {
      estadoDoTreino.limpar();
    } else if (parametro === "fim") {
      estadoDoTreino.limpar();
    } else if (!emTreino) {
      estadoDoTreino.limpar();
    }
    if (parametro) {
      url.searchParams.delete("treino");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [emTreino]);

  // Enquanto a URL ainda carrega a modalidade escolhida, o diálogo espera o efeito acima guardá-la.
  const aguardandoParametro = hidratado && /[?&]treino=(direcionado|livre)\b/.test(window.location.search);

  if (emTreino) {
    if (!hidratado || aguardandoParametro) return null;
    // Fechar sem escolher equivale a explorar sem roteiro (o botão "Roteiro" segue à mão).
    if (modo === null) return <BoasVindasTreino contexto="treino" aoFechar={() => estadoDoTreino.definirModo("livre")} />;
    return modo === "direcionado" ? <TutorialDirecionado pendente={pendente} /> : <BotaoRoteiro />;
  }

  if (primeiroAcesso && hidratado && !boasVindasFechadas) {
    return <BoasVindasTreino contexto="primeiro-acesso" aoFechar={() => setBoasVindasFechadas(true)} />;
  }
  return null;
}
