import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ListaDeAssinaturasPendentes } from "@/components/assinatura/ListaDeAssinaturasPendentes";
import { LinkButton } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { api, usuarioAtual } from "@/lib/api";
import type { AssinaturaJuridica } from "@/lib/assinatura-juridica";
import { rotas } from "@/lib/rotas";
import { emTreino } from "@/lib/treino-modo";

export const metadata: Metadata = { title: "Atos para assinar" };

/**
 * Os atos feitos sem sinal, que valeram com a assinatura desenhada e esperam a assinatura com validade jurídica (`docs/pessoas-e-equipes.md`,
 * seção 3.3). Só existe com o provedor de assinatura ligado e fora do Campo de treino; a página não decide nada, só leva cada ato ao provedor.
 */
export default async function AssinaturasPendentesPage() {
  const { assinaturaJuridica } = await usuarioAtual();
  if (!assinaturaJuridica.ligada || (await emTreino())) redirect(rotas.app.lista);

  const { assinaturas } = await api<{ assinaturas: AssinaturaJuridica[] }>("/assinaturas-juridicas", { consulta: { situacao: "pendente_offline" } });

  return (
    <Screen>
      <header className="stack g4">
        <span className="lbl">Assinatura</span>
        <h1>Atos para assinar</h1>
        <span className="muted small">
          O que você fez sem sinal valeu com a sua assinatura desenhada. Agora, com sinal, assine cada ato no provedor de assinatura para ele ter validade jurídica.
        </span>
      </header>
      <ListaDeAssinaturasPendentes inicial={assinaturas} />
      <div className="row g8 wrap">
        <LinkButton variant="line" href={rotas.app.lista}>
          Voltar ao quadro de OS
        </LinkButton>
      </div>
    </Screen>
  );
}
