import { redirect } from "next/navigation";
import { rotas } from "@/lib/telas";

/** A entrada do sistema é a tela de login. */
export default function Home() {
  redirect(rotas.app.entrar);
}
