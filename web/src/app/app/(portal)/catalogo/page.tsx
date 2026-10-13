import { redirect } from "next/navigation";
import { rotas } from "@/lib/rotas";

/** `/app/catalogo` sozinho abre a primeira aba da seção: os serviços. */
export default function SecaoCatalogoPage() {
  redirect(rotas.app.catalogo);
}
