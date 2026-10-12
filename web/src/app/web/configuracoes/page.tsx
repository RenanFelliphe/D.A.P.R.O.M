import type { Metadata } from "next";
import { EmBreve } from "@/components/web/EmBreve";

export const metadata: Metadata = { title: "Configurações" };

export default function ConfiguracoesPage() {
  return <EmBreve titulo="Configurações" descricao="Preferências da sua conta e do painel." />;
}
