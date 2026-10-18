import type { Metadata } from "next";
import { PerfilDaVitoria } from "@/components/vitoria/PerfilDaVitoria";

export const metadata: Metadata = { title: "Vitória" };

/** O perfil da Vitória (`vitoria.md`, seção 2.8.7): fica antes de `[id]`, que é o perfil de uma pessoa de verdade. */
export default function PerfilDaVitoriaPage() {
  return <PerfilDaVitoria />;
}
