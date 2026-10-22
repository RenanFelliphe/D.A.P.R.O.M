import { redirect } from "next/navigation";
import { rotas } from "@/lib/rotas";

/**
 * A antiga fila "Para validar" (só treinamentos) virou a página Validações (`rotas.app.validacoes`), que reúne tudo o que espera o
 * supervisor. O endereço fica só para os avisos e e-mails já enviados, que ainda o trazem.
 */
export default function TreinamentosParaValidarPage() {
  redirect(rotas.app.treinamentosParaValidar);
}
