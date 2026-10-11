"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "./toast";

/** Estado que atravessa as telas: hoje só os avisos (toast), que sobrevivem à navegação entre telas. */
export function Providers({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
