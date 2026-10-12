import { redirect } from "next/navigation";
import { rotas } from "@/lib/rotas";

/** `/web/apr` sozinho abre a primeira aba da seção: os modelos. */
export default function SecaoAprPage() {
  redirect(rotas.web.modelos);
}
