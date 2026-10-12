import type { Metadata } from "next";
import { EmBreve } from "@/components/web/EmBreve";

export const metadata: Metadata = { title: "Perfil" };

export default function PerfilGestaoPage() {
  return <EmBreve titulo="Perfil" descricao="Seus dados, sua assinatura e a troca de senha." />;
}
