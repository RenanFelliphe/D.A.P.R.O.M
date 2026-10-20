import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trilha } from "@/components/app/AppChrome";
import { ConferenciaScreen } from "@/components/app/conferencia/ConferenciaScreen";
import { LinkButton } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { apiOuNulo } from "@/lib/api";
import { conferenciaParaAbrir, prazoDaConferencia, type ConferenciaDaApi, type ConferenciaDaOs } from "@/lib/conferencia";
import { rotas } from "@/lib/rotas";

export const metadata: Metadata = { title: "Conferência da execução" };

interface DetalheDaOs {
  os: { id: string; numero_ordem: string | null; titulo: string };
  conferencias?: ConferenciaDaOs[];
}

/**
 * A conferência da execução da OS (execução compartilhada, etapa 3): é para onde os avisos levam (`/app/os/{id}/conferencia`). Abre a
 * conferência pedida em `?c=` ou, sem ela, a mais recente da OS; serve ao técnico da equipe e ao supervisor (que escolhe o resultado).
 * Uma OS sem conferência mostra uma mensagem em vez de erro.
 */
export default async function ConferenciaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ c?: string | string[] }> }) {
  const { id } = await params;
  const { c: pedida } = await searchParams;
  const detalhe = await apiOuNulo<DetalheDaOs>(`/os/${id}`);
  if (!detalhe) notFound();

  const escolhida = conferenciaParaAbrir(detalhe.conferencias ?? [], typeof pedida === "string" ? pedida : null);
  const conferencia = escolhida ? await apiOuNulo<ConferenciaDaApi>(`/conferencias/${escolhida.id}`) : null;

  if (!conferencia) {
    return (
      <Screen>
        <Trilha
          passos={[
            { rotulo: "OS da equipe", href: rotas.app.lista },
            { rotulo: detalhe.os.numero_ordem ? `OS ${detalhe.os.numero_ordem}` : "OS sem número", href: rotas.app.os(id) },
            { rotulo: "Conferência" },
          ]}
        />
        <h1>Conferência da execução</h1>
        <div className="panel stack g12" style={{ maxWidth: 560 }}>
          <h2>Esta OS não tem conferência</h2>
          <p className="muted">
            A conferência só existe quando a equipe registra a execução sem sinal, em aparelhos diferentes. Aqui não houve nada para conferir, ou você não participa dela.
          </p>
          <div className="row g8">
            <LinkButton variant="p" href={rotas.app.os(id)}>
              Voltar para a OS
            </LinkButton>
          </div>
        </div>
      </Screen>
    );
  }

  return <ConferenciaScreen conferencia={conferencia} prazo={prazoDaConferencia(conferencia, new Date())} />;
}
