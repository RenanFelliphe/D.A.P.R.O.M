import type { Metadata } from "next";
import { EntrarHero } from "@/components/app/entrar/EntrarHero";
import { FormularioEntrar } from "@/components/app/entrar/FormularioEntrar";
import { destinoInterno } from "@/lib/sessao-comum";

export const metadata: Metadata = { title: "Entrar" };

/** `?para=`: o endereço que a pessoa pediu sem sessão (o link do e-mail de alerta); depois do login, ela volta a ele. */
export default async function EntrarPage({ searchParams }: PageProps<"/app/entrar">) {
  const pedido = (await searchParams).para;
  const para = destinoInterno(Array.isArray(pedido) ? pedido[0] : pedido);
  return (
    <div className="login">
      <EntrarHero />
      <div className="login-side">
        <div className="login-card">
          <FormularioEntrar para={para} />
        </div>
        <div className="login-foot">
          <span>Esqueceu a senha? Procure o administrador.</span>
        </div>
      </div>
    </div>
  );
}
