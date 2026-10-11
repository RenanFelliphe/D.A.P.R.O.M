"use client";

import type { ReactNode } from "react";
import { AlertasProvider } from "./alertas";
import { ChecklistProvider } from "./checklist";
import { ExportacaoProvider } from "./exportacao";
import { SincronizacaoProvider } from "./sincronizacao";
import { ToastProvider } from "./toast";

/**
 * Estado que atravessa as telas do protótipo (no original, as variáveis soltas de app.js).
 * Fica no layout raiz, que não é remontado ao navegar, e por isso sobrevive à troca de tela.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ChecklistProvider>
        <AlertasProvider>
          <ExportacaoProvider>
            <SincronizacaoProvider>{children}</SincronizacaoProvider>
          </ExportacaoProvider>
        </AlertasProvider>
      </ChecklistProvider>
    </ToastProvider>
  );
}
