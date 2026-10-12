import type { Metadata } from "next";
import { PerfilUsuario } from "@/components/perfil/PerfilUsuario";

export const metadata: Metadata = { title: "Perfil" };

export default async function PerfilDeUsuarioPage({ params }: PageProps<"/web/perfil/[id]">) {
  const { id } = await params;
  return <PerfilUsuario area="web" usuarioId={id} />;
}
