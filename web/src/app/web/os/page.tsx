import { redirect } from "next/navigation";
import { rotas } from "@/lib/rotas";

/** `/web/os` sozinho abre a primeira aba da seção: o quadro. */
export default function SecaoOsPage() {
  redirect(rotas.web.quadro);
}
