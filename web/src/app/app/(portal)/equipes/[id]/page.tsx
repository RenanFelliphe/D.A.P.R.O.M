import type { Metadata } from "next";
import { PerfilEquipe } from "@/components/perfil/PerfilEquipe";

export const metadata: Metadata = { title: "Equipe" };

export default async function EquipePage({ params }: PageProps<"/app/equipes/[id]">) {
  const { id } = await params;
  return <PerfilEquipe equipeId={id} />;
}
