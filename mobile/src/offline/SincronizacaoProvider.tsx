import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { mensagemDoErro } from "@/api/erros";
import { useSessao } from "@/sessao/SessaoProvider";
import { atualizarEstadoDaFila, definirConexao, definirPessoaLogada, sincronizador } from "./app";
import { estadoDaSincronizacao, mudarEstado } from "./estado";
import { desligarEnvioEmSegundoPlano, ligarEnvioEmSegundoPlano } from "./segundo-plano-nativo";

const INTERVALO_COM_PENDENCIA_MS = 60_000;
const INTERVALO_MINIMO_AO_VOLTAR_MS = 30_000;

const Contexto = createContext<{ sincronizar(): Promise<void> } | null>(null);

/** O botão "Sincronizar" e quem mais precisar sincronizar na hora. */
export function useSincronizar(): () => Promise<void> {
  const c = useContext(Contexto);
  if (!c) throw new Error("useSincronizar fora da SincronizacaoProvider");
  return c.sincronizar;
}

/**
 * Liga o modo offline ao ciclo de vida do app. Diz ao `offline/app` quem está logado e qual é a conexão, e sincroniza (sobe a fila e
 * baixa a cópia da equipe): ao abrir o app, quando o sinal volta, quando o app volta para a frente, de minuto em minuto enquanto houver
 * registro esperando e quando a pessoa toca em "Sincronizar". Só o técnico de uma equipe, com a conta pronta, tem fila e cópia.
 */
export function SincronizacaoProvider({ children }: { children: React.ReactNode }) {
  const { eu, destino, fase, entrouSemSinal } = useSessao();
  const consultas = useQueryClient();
  const usuario = eu?.usuario;
  const elegivel = fase === "ativa" && destino === "abas" && usuario?.perfil === "tecnico" && Boolean(eu?.equipe);
  const elegivelRef = useRef(false);
  const ultimaVez = useRef(0);

  useEffect(() => {
    definirPessoaLogada(usuario ? { id: usuario.id, nome: usuario.nome, matricula: usuario.matricula } : null);
    void atualizarEstadoDaFila();
  }, [usuario?.id, usuario?.nome, usuario?.matricula]); // eslint-disable-line react-hooks/exhaustive-deps

  const sincronizar = useCallback(async () => {
    if (!elegivelRef.current) return;
    ultimaVez.current = Date.now();
    mudarEstado({ sincronizando: true });
    try {
      const r = await sincronizador.sincronizar();
      mudarEstado({
        sincronizando: false,
        semSinal: r.semSinal,
        erro: r.erro,
        ...(!r.semSinal && !r.erro ? { sincronizadoEm: new Date().toISOString() } : {}),
      });
      // O que subiu mudou o que o servidor sabe: as telas, que liam da cópia local, passam a ler dele.
      if (r.confirmados > 0 || r.recusados > 0) await Promise.all([consultas.invalidateQueries({ queryKey: ["os"] }), consultas.invalidateQueries({ queryKey: ["me"] }), consultas.invalidateQueries({ queryKey: ["eu"] })]);
    } catch (e) {
      mudarEstado({ sincronizando: false, erro: mensagemDoErro(e) });
    }
  }, [consultas]);

  // Ao abrir o app (e quando a conta passa a estar pronta).
  useEffect(() => {
    elegivelRef.current = elegivel;
    mudarEstado({ aplicavel: elegivel });
    if (elegivel) void sincronizar();
  }, [elegivel, sincronizar]);

  // O envio com o app fechado: o Android acorda o app de tempos em tempos enquanto houver alguém com fila no aparelho; quem saiu, não.
  useEffect(() => {
    if (elegivel) void ligarEnvioEmSegundoPlano();
    else if (fase === "sem-sessao") void desligarEnvioEmSegundoPlano();
  }, [elegivel, fase]);

  // Quem entrou sem sinal ganhou a sessão no servidor (o sinal voltou): sobe a fila e baixa a cópia.
  const estavaSemSessao = useRef(false);
  useEffect(() => {
    if (estavaSemSessao.current && !entrouSemSinal && elegivelRef.current) void sincronizar();
    estavaSemSessao.current = entrouSemSinal;
  }, [entrouSemSinal, sincronizar]);

  // A conexão do aparelho: vale para o app inteiro (`lerDeOndeDer`, a fila). Quando o sinal volta, sincroniza.
  useEffect(() => {
    let anterior: "online" | "offline" | null = null;
    return NetInfo.addEventListener((estado) => {
      const atual = estado.isConnected === false || estado.isInternetReachable === false ? "offline" : "online";
      definirConexao(atual);
      if (atual === "online" && anterior === "offline") void sincronizar();
      anterior = atual;
    });
  }, [sincronizar]);

  // Voltar para o app: sincroniza, no máximo a cada 30 s.
  useEffect(() => {
    const assinatura = AppState.addEventListener("change", (s) => {
      if (s === "active" && Date.now() - ultimaVez.current > INTERVALO_MINIMO_AO_VOLTAR_MS) void sincronizar();
    });
    return () => assinatura.remove();
  }, [sincronizar]);

  // Com registro esperando, tenta de novo de minuto em minuto (o evento adiado pode ter perdido a causa).
  useEffect(() => {
    const relogio = setInterval(() => {
      if (elegivelRef.current && estadoDaSincronizacao().pendentes > 0 && !estadoDaSincronizacao().sincronizando) void sincronizar();
    }, INTERVALO_COM_PENDENCIA_MS);
    return () => clearInterval(relogio);
  }, [sincronizar]);

  return <Contexto.Provider value={{ sincronizar }}>{children}</Contexto.Provider>;
}
