"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import { registrosFila, totalArquivos } from "@/data/sincronizacao";
import { useToast } from "./toast";

const PASSO_MS = 650;

export type SituacaoSync = "parada" | "enviando" | "concluida";

export interface EstadoSync {
  situacao: SituacaoSync;
  arquivos: number;
  registros: number;
}

const estadoInicial: EstadoSync = { situacao: "parada", arquivos: 0, registros: 0 };

type Acao = { tipo: "iniciar" } | { tipo: "passo" } | { tipo: "reiniciar" };

/** Envia primeiro os arquivos, depois os registros; ao esgotar os dois, conclui. */
function reduzir(estado: EstadoSync, acao: Acao): EstadoSync {
  switch (acao.tipo) {
    case "iniciar":
      return estado.situacao === "parada" ? { ...estado, situacao: "enviando" } : estado;
    case "passo":
      if (estado.situacao !== "enviando") return estado;
      if (estado.arquivos < totalArquivos) return { ...estado, arquivos: estado.arquivos + 1 };
      if (estado.registros < registrosFila.length) return { ...estado, registros: estado.registros + 1 };
      return { ...estado, situacao: "concluida" };
    case "reiniciar":
      return estadoInicial;
  }
}

interface SincronizacaoContexto {
  estado: EstadoSync;
  sincronizar: () => void;
  reiniciar: () => void;
}

const SincronizacaoContext = createContext<SincronizacaoContexto | null>(null);

/** Sincronização simulada: o progresso continua mesmo se a pessoa sair da tela. */
export function SincronizacaoProvider({ children }: { children: ReactNode }) {
  const exibirAviso = useToast();
  const [estado, despachar] = useReducer(reduzir, estadoInicial);

  useEffect(() => {
    if (estado.situacao !== "enviando") return;
    const temporizador = setTimeout(() => despachar({ tipo: "passo" }), PASSO_MS);
    return () => clearTimeout(temporizador);
  }, [estado]);

  useEffect(() => {
    if (estado.situacao === "concluida") exibirAviso("Sincronização concluída. O painel web já mostra a OS.");
  }, [estado.situacao, exibirAviso]);

  const sincronizar = useCallback(() => despachar({ tipo: "iniciar" }), []);
  const reiniciar = useCallback(() => despachar({ tipo: "reiniciar" }), []);
  const contexto = useMemo(() => ({ estado, sincronizar, reiniciar }), [estado, sincronizar, reiniciar]);

  return <SincronizacaoContext value={contexto}>{children}</SincronizacaoContext>;
}

export function useSincronizacao(): SincronizacaoContexto {
  const contexto = useContext(SincronizacaoContext);
  if (!contexto) throw new Error("useSincronizacao precisa estar dentro de <SincronizacaoProvider>.");
  return contexto;
}
