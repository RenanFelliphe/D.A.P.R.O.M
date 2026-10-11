"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { alertas as alertasIniciais, alertaSelecionadoInicial, type Alerta } from "@/data/alertas";

interface AlertasContexto {
  alertas: Alerta[];
  selecionado: number;
  naoLidos: number;
  /** Abre o alerta e o marca como lido. */
  selecionar: (indice: number) => void;
  marcarSelecionadoComoLido: () => void;
}

const AlertasContext = createContext<AlertasContexto | null>(null);

function marcarLido(lista: Alerta[], indice: number): Alerta[] {
  return lista.map((alerta, i) => (i === indice ? { ...alerta, naoLido: false } : alerta));
}

/** Alertas do painel: o contador do topo e do menu acompanha o que foi lido na tela de alertas. */
export function AlertasProvider({ children }: { children: ReactNode }) {
  const [alertas, setAlertas] = useState(alertasIniciais);
  const [selecionado, setSelecionado] = useState(alertaSelecionadoInicial);

  const selecionar = useCallback((indice: number) => {
    setSelecionado(indice);
    setAlertas((lista) => marcarLido(lista, indice));
  }, []);

  const marcarSelecionadoComoLido = useCallback(() => {
    setAlertas((lista) => marcarLido(lista, selecionado));
  }, [selecionado]);

  const contexto = useMemo<AlertasContexto>(
    () => ({
      alertas,
      selecionado,
      naoLidos: alertas.filter((alerta) => alerta.naoLido).length,
      selecionar,
      marcarSelecionadoComoLido,
    }),
    [alertas, selecionado, selecionar, marcarSelecionadoComoLido],
  );

  return <AlertasContext value={contexto}>{children}</AlertasContext>;
}

export function useAlertas(): AlertasContexto {
  const contexto = useContext(AlertasContext);
  if (!contexto) throw new Error("useAlertas precisa estar dentro de <AlertasProvider>.");
  return contexto;
}
