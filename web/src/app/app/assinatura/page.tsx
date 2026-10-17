import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EntrarHero } from "@/components/app/entrar/EntrarHero";
import { FormularioAssinatura } from "@/components/app/entrar/FormularioAssinatura";
import { sair } from "@/lib/acoes-sessao";
import { usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";

export const metadata: Metadata = { title: "Cadastre sua assinatura" };

export default async function AssinaturaPage() {
  const { usuario } = await usuarioAtual(); // garante a sessão; sem ela vai para a entrada
  // Quem já tem a assinatura (ou ainda aguarda a liberação, que vem antes) não fica nesta tela.
  if (usuario.assinatura_path) redirect(rotas.app.lista);
  return (
    <div className="login">
      <EntrarHero />
      <div className="login-side">
        <div className="login-card">
          <FormularioAssinatura />
        </div>
        <form action={sair} className="login-foot">
          <button className="btn btn-ghost btn-sm" type="submit">
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
