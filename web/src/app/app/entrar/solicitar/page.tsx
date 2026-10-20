import type { Metadata } from "next";
import { EntrarHero } from "@/components/app/entrar/EntrarHero";
import { FormularioSolicitarConta } from "@/components/app/entrar/FormularioSolicitarConta";
import { apiUrl } from "@/lib/sessao-comum";

export const metadata: Metadata = { title: "Solicitar uma conta" };

/** As equipes para escolher no pedido (rota aberta da `api`); fora do ar, o pedido segue sem a lista. */
async function equipesDoPedido(): Promise<{ id: string; nome: string }[]> {
  try {
    const r = await fetch(`${apiUrl()}/solicitacoes-conta/equipes`, { cache: "no-store" });
    if (!r.ok) return [];
    return ((await r.json()) as { equipes: { id: string; nome: string }[] }).equipes;
  } catch {
    return [];
  }
}

/** "Ainda não tem uma conta? Solicite": o pedido de conta, aberto sem login, com a mesma moldura da tela de entrada. */
export default async function SolicitarContaPage() {
  return (
    <div className="login">
      <EntrarHero />
      <div className="login-side">
        <div className="login-card">
          <FormularioSolicitarConta equipes={await equipesDoPedido()} />
        </div>
      </div>
    </div>
  );
}
