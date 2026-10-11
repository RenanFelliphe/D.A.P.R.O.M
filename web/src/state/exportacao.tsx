"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { totalPendentesExportacao } from "@/data/indicadores";
import { useToast } from "./toast";

interface ExportacaoContexto {
  /** A planilha de baixa já foi gerada: não há mais OS pendentes de exportação. */
  exportado: boolean;
  gerarPlanilha: () => void;
}

const ExportacaoContext = createContext<ExportacaoContexto | null>(null);

/** Situação da exportação para o SAP, mantida enquanto a demonstração está aberta. */
export function ExportacaoProvider({ children }: { children: ReactNode }) {
  const exibirAviso = useToast();
  const [exportado, setExportado] = useState(false);

  const gerarPlanilha = useCallback(() => {
    if (exportado) {
      exibirAviso("Nenhuma OS nova para exportar.");
      return;
    }
    setExportado(true);
    exibirAviso(`Planilha gerada: ${totalPendentesExportacao} OS marcadas como exportadas para baixa no SAP.`);
  }, [exportado, exibirAviso]);

  const contexto = useMemo(() => ({ exportado, gerarPlanilha }), [exportado, gerarPlanilha]);

  return <ExportacaoContext value={contexto}>{children}</ExportacaoContext>;
}

export function useExportacao(): ExportacaoContexto {
  const contexto = useContext(ExportacaoContext);
  if (!contexto) throw new Error("useExportacao precisa estar dentro de <ExportacaoProvider>.");
  return contexto;
}
