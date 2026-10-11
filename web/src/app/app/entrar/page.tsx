import type { Metadata } from "next";
import { EntrarHero } from "@/components/app/entrar/EntrarHero";
import { FormularioEntrar } from "@/components/app/entrar/FormularioEntrar";

export const metadata: Metadata = { title: "Entrar" };

export default function EntrarPage() {
  return (
    <div className="login">
      <EntrarHero />
      <div className="login-side">
        <div className="login-card">
          <FormularioEntrar />
        </div>
        <div className="login-foot">
          <span>Esqueceu a senha? Procure o administrador.</span>
        </div>
      </div>
    </div>
  );
}
