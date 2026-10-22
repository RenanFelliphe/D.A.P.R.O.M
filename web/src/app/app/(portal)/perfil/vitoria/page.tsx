import type { Metadata } from "next";
import { PerfilDaVitoria } from "@/components/vitoria/PerfilDaVitoria";

export const metadata: Metadata = { title: "Vitória" };

/** O perfil da Vitória (`docs/ia-e-vitoria.md`, seção 4.14): fica antes de `[id]`, que é o perfil de uma pessoa de verdade. */
export default function PerfilDaVitoriaPage() {
  return <PerfilDaVitoria />;
}
