import { redirect } from "next/navigation";
import { rotas } from "@/lib/rotas";

/** `/app/configuracoes` sozinho abre "Minha conta", a primeira aba de todos. */
export default function ConfiguracoesPage() {
  redirect(rotas.app.configuracoesConta);
}
