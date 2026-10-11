import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/api";
import { inicioDoPerfil } from "@/lib/inicio";

/** Quem já tem sessão vai para o início do perfil; sem sessão, `usuarioAtual` leva à tela de entrada. */
export default async function Home() {
  const { usuario } = await usuarioAtual();
  redirect(inicioDoPerfil(usuario.perfil));
}
