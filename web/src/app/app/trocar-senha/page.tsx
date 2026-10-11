import type { Metadata } from "next";
import { EntrarHero } from "@/components/app/entrar/EntrarHero";
import { FormularioTrocarSenha } from "@/components/app/entrar/FormularioTrocarSenha";
import { usuarioAtual } from "@/lib/api";

export const metadata: Metadata = { title: "Defina sua senha" };

export default async function TrocarSenhaPage() {
  await usuarioAtual(); // garante a sessão; sem ela vai para a entrada
  return (
    <div className="login">
      <EntrarHero />
      <div className="login-side">
        <div className="login-card">
          <FormularioTrocarSenha />
        </div>
      </div>
    </div>
  );
}
